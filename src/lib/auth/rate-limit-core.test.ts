import test from "node:test";
import assert from "node:assert/strict";
import { createLimiter, memoryStore, type Store } from "./rate-limit-core";

const cfg = () => ({ maxAttempts: 3, windowMs: 60_000 });
const clock = (start = 0) => {
  const c = { t: start, now: () => c.t };
  return c;
};

test("blocks after max attempts, retryAfter rounds up, clear resets", async () => {
  const c = clock();
  const l = createLimiter(null, memoryStore(cfg, c.now), undefined, c.now);
  for (let i = 0; i < 3; i++) await l.consumeAttempt("login:a");
  const r = await l.consumeAttempt("login:a");
  assert.deepEqual(r, { limited: true, retryAfterMinutes: 1 });
  assert.equal((await l.isRateLimited("login:b")).limited, false);
  await l.clearAttempts("login:a");
  assert.equal((await l.isRateLimited("login:a")).limited, false);
});

test("sliding window: no 2x burst across a window boundary", async () => {
  const c = clock();
  const l = createLimiter(null, memoryStore(cfg, c.now), undefined, c.now);
  // Fill the budget just before the window would roll over.
  c.t = 59_000;
  for (let i = 0; i < 3; i++) assert.equal((await l.consumeAttempt("k:a")).limited, false);
  // A fixed window would reset at t=60_000 and allow 3 more immediately.
  c.t = 61_000;
  assert.equal((await l.consumeAttempt("k:a")).limited, true);
  // Allowed again only once the oldest attempts age out (59_000 + 60_000).
  c.t = 119_001;
  assert.equal((await l.consumeAttempt("k:a")).limited, false);
});

test("rejected attempts are not recorded (no self-extending lockout)", async () => {
  const c = clock();
  const l = createLimiter(null, memoryStore(cfg, c.now), undefined, c.now);
  for (let i = 0; i < 3; i++) await l.consumeAttempt("k:a");
  for (let i = 0; i < 10; i++) await l.consumeAttempt("k:a");
  c.t = 60_001;
  assert.equal((await l.consumeAttempt("k:a")).limited, false);
});

test("concurrency: 50 parallel attempts admit exactly max", async () => {
  const l = createLimiter(null, memoryStore(cfg));
  const results = await Promise.all(
    Array.from({ length: 50 }, () => l.consumeAttempt("login:a"))
  );
  assert.equal(results.filter((r) => !r.limited).length, 3);
});

test("concurrency: atomic primary store with async latency still caps at max", async () => {
  // Simulates Redis: each op is atomic server-side but callers interleave.
  const inner = memoryStore(cfg);
  const delay = () => new Promise((r) => setTimeout(r, Math.random() * 5));
  const primary: Store = {
    check: async (k) => (await delay(), inner.check(k)),
    consume: async (k) => (await delay(), inner.consume(k)),
    clear: async (k) => (await delay(), inner.clear(k)),
  };
  const l = createLimiter(primary, null);
  const results = await Promise.all(
    Array.from({ length: 30 }, () => l.consumeAttempt("login:a"))
  );
  assert.equal(results.filter((r) => !r.limited).length, 3);
});

const boom = async () => {
  throw new Error("redis down");
};
const broken: Store = { check: boom, consume: boom, clear: boom };

test("outage with no fallback (production): unavailable, never allowed", async () => {
  const errors: unknown[] = [];
  const l = createLimiter(broken, null, (e) => errors.push(e));
  assert.deepEqual(await l.consumeAttempt("login:a"), { limited: true, unavailable: true });
  assert.deepEqual(await l.isRateLimited("login:a"), { limited: true, unavailable: true });
  await l.clearAttempts("login:a"); // best effort: must not throw
  assert.equal(errors.length, 3);
});

test("unconfigured Redis with no fallback (production): unavailable", async () => {
  const l = createLimiter(null, null);
  assert.deepEqual(await l.consumeAttempt("login:a"), { limited: true, unavailable: true });
});

test("outage with fallback (non-production): memory limiter applies", async () => {
  const l = createLimiter(broken, memoryStore(cfg));
  for (let i = 0; i < 3; i++) assert.equal((await l.consumeAttempt("k:a")).limited, false);
  assert.equal((await l.consumeAttempt("k:a")).limited, true);
});

test("healthy primary is used and reports retryAfter", async () => {
  const calls: string[] = [];
  const primary: Store = {
    check: async () => ({ limited: true, resetAt: 120_000 }),
    consume: async (k) => (calls.push(k), { limited: true, resetAt: 90_001 }),
    clear: async () => {},
  };
  const l = createLimiter(primary, null, undefined, () => 0);
  assert.deepEqual(await l.isRateLimited("k:a"), { limited: true, retryAfterMinutes: 2 });
  assert.deepEqual(await l.consumeAttempt("k:a"), { limited: true, retryAfterMinutes: 2 });
  assert.deepEqual(calls, ["k:a"]);
});
