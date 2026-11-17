import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logError } from "@/lib/logger";
import { headers } from "next/headers";
import { clearSlidingWindow, createLimiter, configFor, memoryStore, type Store } from "./rate-limit-core";
import { resolveClientIp } from "./client-ip";

// Distributed limiter backed by Upstash Redis (UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN). Budgets per key prefix live in rate-limit-core.ts;
// login and password reset layer IP, (account, IP) and account keys.
//
// Sliding window (no fixed-window boundary burst). In production there is NO
// in-memory fallback: if Redis is unconfigured or a call fails, operations
// report `unavailable` and callers refuse the request (503 semantics) rather
// than run unthrottled on an unshared per-instance counter. Outside
// production (local dev, e2e) an in-memory limiter is used. Production boot
// requires the Upstash vars (see lib/env.ts).
function createUpstashStore(): Store | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  type Entry = { limiter: Ratelimit; prefix: string; windowMs: number; localBlocks: Map<string, number> };
  const entries = new Map<string, Entry>();
  const entryFor = (key: string): Entry => {
    const { maxAttempts, windowMs } = configFor(key);
    const cacheKey = `${maxAttempts}/${windowMs}`;
    let entry = entries.get(cacheKey);
    if (!entry) {
      const prefix = `ratelimit:${cacheKey}`;
      // Our own Map (the library's default is a private one) so clear() can
      // drop a cleared identifier's local "blocked until" entry.
      const localBlocks = new Map<string, number>();
      entry = {
        limiter: new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(maxAttempts, `${windowMs} ms`),
          prefix,
          ephemeralCache: localBlocks,
          timeout: 3000,
        }),
        prefix,
        windowMs,
        localBlocks,
      };
      entries.set(cacheKey, entry);
    }
    return entry;
  };
  // Hash the identifier so emails never sit in Redis keys.
  const id = (key: string) => createHash("sha256").update(key).digest("hex");

  return {
    async check(key) {
      const { remaining, reset } = await entryFor(key).limiter.getRemaining(id(key));
      return remaining > 0 ? { limited: false } : { limited: true, resetAt: reset };
    },
    async consume(key) {
      const { success, reset, reason } = await entryFor(key).limiter.limit(id(key));
      // On timeout the library resolves success=true (fail-open); treat it
      // as a failure instead so the call is reported unavailable.
      if (reason === "timeout") throw new Error("Upstash rate limit call timed out");
      return success ? { limited: false } : { limited: true, resetAt: reset };
    },
    async clear(key) {
      // Not limiter.resetUsedTokens(): that SCANs the whole keyspace.
      const { prefix, windowMs, localBlocks } = entryFor(key);
      await clearSlidingWindow(redis, localBlocks, prefix, id(key), windowMs, Date.now());
    },
  };
}

const limiter = createLimiter(
  createUpstashStore(),
  process.env.NODE_ENV === "production" ? null : memoryStore(configFor),
  (err) => logError("Rate limiter Redis call failed.", err)
);

// Read-only check: does NOT count as an attempt.
export const isRateLimited = limiter.isRateLimited;
// Atomic count-and-check in one round trip: use before the guarded work.
export const consumeAttempt = limiter.consumeAttempt;
export const consumeAll = limiter.consumeAll;
export const clearAttempts = limiter.clearAttempts;

// Client IP from trusted-proxy headers only (see client-ip.ts); null when the
// deployment hasn't declared a trusted proxy.
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return resolveClientIp((name) => h.get(name), {
    VERCEL: process.env.VERCEL,
    TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
  });
}

export { RATE_LIMIT_UNAVAILABLE_MESSAGE } from "./rate-limit-core";
