// Pure limiter logic (no server-only / Redis imports) so it can be unit tested.

export type LimitResult = { limited: false } | { limited: true; resetAt: number };

// All three operations must be atomic per key (Redis: one Lua script each).
export interface Store {
  check(key: string): Promise<LimitResult>;
  consume(key: string): Promise<LimitResult>;
  clear(key: string): Promise<void>;
}

// `unavailable`: the limiter backend failed and no fallback is allowed. The
// caller must refuse the protected operation (HTTP 503 semantics) — never
// proceed unthrottled.
export type RateLimitStatus = {
  limited: boolean;
  retryAfterMinutes?: number;
  unavailable?: boolean;
};

export const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "Service temporarily unavailable. Please try again in a few minutes.";

export type Config = { maxAttempts: number; windowMs: number };

// Budgets by key prefix (the text before the first ":"). Shared by login,
// forgot-password, change-password and uploads, so none share a budget.
// Upload throttles one account hammering the endpoint, not auth failures, and
// a legitimate multi-document form (e.g. the administrator form's 4 files)
// must never trip it in one submission.
//
// Login/reset use three layers (see authRateKeys) so that a single attacker
// can neither spray many accounts nor lock one victim out:
//   <name>ip    per client IP, across all accounts (never cleared by a login)
//   <name>      per (account, client IP)  - the original 5 per 15 minutes
//   <name>acct  per account, all IPs      - ceiling for distributed guessing
export const CONFIGS: Record<string, Config> = {
  upload: { maxAttempts: 20, windowMs: 10 * 60 * 1000 },
  loginip: { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
  loginacct: { maxAttempts: 15, windowMs: 15 * 60 * 1000 },
  resetip: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  resetacct: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
};
export const DEFAULT_CONFIG: Config = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

export function configFor(key: string): Config {
  const prefix = key.slice(0, key.indexOf(":"));
  return CONFIGS[prefix] ?? DEFAULT_CONFIG;
}

// Redis keys @upstash/ratelimit 2.2.1 writes for ONE identifier with
// Ratelimit.slidingWindow (verified against its source, and by a test that
// drives the real library against a fake Redis):
//   identifier = `${config.prefix}:${id}`                (Ratelimit.getKey)
//   counters   = `${identifier}:${floor(now / windowMs)}` (current window)
// and the script only ever reads the current and previous window counters
// (older ones just expire: PEXPIRE 2*window+1s). The library's own
// resetUsedTokens() instead runs a Lua SCAN over the WHOLE keyspace, which
// blocks Redis in proportion to every key anyone has created, so we delete
// the exact keys instead. w-1/w/w+1 covers the previous window, the current
// one and clock skew between app instances (the window index comes from the
// calling instance's clock); a request landing in w+1 only loses this one
// identifier's own count, which is what a reset means.
export function slidingWindowKeys(prefix: string, hash: string, windowMs: number, now: number) {
  const identifier = `${prefix}:${hash}`;
  const w = Math.floor(now / windowMs);
  return { identifier, counters: [w - 1, w, w + 1].map((i) => `${identifier}:${i}`) };
}

// Resets one identifier: a single DEL of at most 3 exact keys (O(1), no
// SCAN, no Lua, no wildcard), then drops the library's local "blocked until"
// entry so this instance does not keep rejecting a cleared identifier.
export async function clearSlidingWindow(
  redis: { del(...keys: string[]): Promise<unknown> },
  localBlocks: Map<string, number>,
  prefix: string,
  hash: string,
  windowMs: number,
  now: number
): Promise<void> {
  const { identifier, counters } = slidingWindowKeys(prefix, hash, windowMs, now);
  await redis.del(...counters);
  localBlocks.delete(identifier);
}

// Keys for one login / password-reset attempt. `ip` null means no trusted
// proxy header was available: the per-IP layer is skipped and the pair layer
// degrades to per-account (the pre-IP behavior) rather than lumping every
// unknown client into one shared bucket that anyone could exhaust.
//
// `consume` is counted in order, ip first, and a rejected attempt is not
// recorded by later layers, so one IP can push at most 5 per window into an
// account's shared budget. `clear` (on success) deliberately omits the IP key:
// otherwise an attacker holding any valid account could reset their own IP
// budget by logging in between sprays.
export function authRateKeys(kind: "login" | "reset", email: string, ip: string | null) {
  const e = email.trim().toLowerCase();
  const pair = `${kind}:${e}|${ip ?? "unknown"}`;
  const acct = `${kind}acct:${e}`;
  return {
    consume: ip ? [`${kind}ip:${ip}`, pair, acct] : [pair, acct],
    clear: [pair, acct],
  };
}

// Exact sliding-window log, used for local dev/tests and as the reference
// behavior for the Redis sliding window. A rejected attempt is not recorded.
export function memoryStore(
  configFor: (key: string) => Config,
  now: () => number = Date.now
): Store {
  const logs = new Map<string, number[]>();

  function live(key: string, t: number): number[] {
    const { windowMs } = configFor(key);
    const kept = (logs.get(key) ?? []).filter((at) => at > t - windowMs);
    if (kept.length > 0) logs.set(key, kept);
    else logs.delete(key);
    return kept;
  }

  // Unbounded growth guard.
  function sweep(t: number) {
    if (logs.size < 1000) return;
    for (const key of [...logs.keys()]) live(key, t);
  }

  const blocked = (key: string, kept: number[]): LimitResult =>
    kept.length >= configFor(key).maxAttempts
      ? { limited: true, resetAt: kept[0] + configFor(key).windowMs }
      : { limited: false };

  return {
    async check(key) {
      return blocked(key, live(key, now()));
    },
    async consume(key) {
      const t = now();
      sweep(t);
      const kept = live(key, t);
      const result = blocked(key, kept);
      if (!result.limited) logs.set(key, [...kept, t]);
      return result;
    },
    async clear(key) {
      logs.delete(key);
    },
  };
}

// `fallback` null = fail closed: when `primary` is missing or throws, every
// operation reports `unavailable` instead of degrading to an unshared store.
export function createLimiter(
  primary: Store | null,
  fallback: Store | null,
  onError: (err: unknown) => void = () => {},
  now: () => number = Date.now
) {
  const UNAVAILABLE: RateLimitStatus = { limited: true, unavailable: true };

  async function run<T>(op: (s: Store) => Promise<T>): Promise<T | null> {
    if (primary) {
      try {
        return await op(primary);
      } catch (err) {
        onError(err);
      }
    }
    return fallback ? op(fallback) : null;
  }

  const toStatus = (r: LimitResult | null): RateLimitStatus => {
    if (r === null) return UNAVAILABLE;
    return r.limited
      ? { limited: true, retryAfterMinutes: Math.max(1, Math.ceil((r.resetAt - now()) / 60000)) }
      : { limited: false };
  };

  return {
    // Read-only: does not count as an attempt. Racy by design — to gate an
    // operation, use consumeAttempt.
    async isRateLimited(key: string): Promise<RateLimitStatus> {
      return toStatus(await run((s) => s.check(key)));
    },
    // Atomically counts one attempt and reports whether it was over the
    // limit. Call BEFORE the guarded work and clearAttempts on success:
    // concurrent requests then can't all pass a stale check.
    async consumeAttempt(key: string): Promise<RateLimitStatus> {
      return toStatus(await run((s) => s.consume(key)));
    },
    // Consumes keys in order, stopping at the first limited/unavailable one.
    async consumeAll(keys: string[]): Promise<RateLimitStatus> {
      for (const key of keys) {
        const status = toStatus(await run((s) => s.consume(key)));
        if (status.limited) return status;
      }
      return { limited: false };
    },
    // Best effort: failing to clear must never fail a successful login; the
    // counter just ages out of the window.
    async clearAttempts(...keys: string[]): Promise<void> {
      await Promise.allSettled(
        keys.flatMap((key) => [
          primary?.clear(key).catch((err) => onError(err)),
          fallback?.clear(key),
        ])
      );
    },
  };
}
