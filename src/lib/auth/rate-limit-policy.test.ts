import test from "node:test";
import assert from "node:assert/strict";
import { authRateKeys, configFor, createLimiter, memoryStore, type Store } from "./rate-limit-core";
import { normalizeIp, resolveClientIp } from "./client-ip";

const clock = (start = 0) => {
  const c = { t: start, now: () => c.t };
  return c;
};
const setup = () => {
  const c = clock(1_000_000);
  return { c, l: createLimiter(null, memoryStore(configFor, c.now), undefined, c.now) };
};
type Limiter = ReturnType<typeof setup>["l"];

// One login attempt as the action does it; returns true if admitted.
const attempt = async (l: Limiter, email: string, ip: string | null) =>
  !(await l.consumeAll(authRateKeys("login", email, ip).consume)).limited;

test("password spraying: one IP across many accounts is capped by the IP layer", async () => {
  const { l } = setup();
  let admitted = 0;
  for (let i = 0; i < 200; i++) if (await attempt(l, `user${i}@x.com`, "1.1.1.1")) admitted++;
  assert.equal(admitted, configFor("loginip:").maxAttempts); // 30, not 200
  // A different client is unaffected by that IP's exhaustion.
  assert.equal(await attempt(l, "user0@x.com", "2.2.2.2"), true);
});

test("distributed guessing: many IPs against one account is capped by the account layer", async () => {
  const { l } = setup();
  let admitted = 0;
  for (let ip = 0; ip < 40; ip++)
    for (let i = 0; i < 5; i++) if (await attempt(l, "victim@x.com", `10.0.0.${ip}`)) admitted++;
  assert.equal(admitted, configFor("loginacct:").maxAttempts); // 15 across 40 IPs
});

test("victim lockout: one attacker IP cannot lock the victim out from their own IP", async () => {
  const { l } = setup();
  for (let i = 0; i < 50; i++) await attempt(l, "victim@x.com", "6.6.6.6");
  assert.equal(await attempt(l, "victim@x.com", "6.6.6.6"), false); // attacker blocked
  // Attacker added at most 5 to the shared account budget, so the victim
  // still gets in from their own IP; their own typos lock only their pair.
  for (let i = 0; i < 5; i++) assert.equal(await attempt(l, "victim@x.com", "9.9.9.9"), true);
  assert.equal(await attempt(l, "victim@x.com", "9.9.9.9"), false);
  // A success clears the pair + account counters.
  await l.clearAttempts(...authRateKeys("login", "victim@x.com", "9.9.9.9").clear);
  assert.equal(await attempt(l, "victim@x.com", "9.9.9.9"), true);
});

test("victim lockout needs 3+ distinct IPs (documented residual risk); other accounts unaffected", async () => {
  const { l } = setup();
  for (const ip of ["6.0.0.1", "6.0.0.2", "6.0.0.3"])
    for (let i = 0; i < 5; i++) await attempt(l, "victim@x.com", ip);
  assert.equal(await attempt(l, "victim@x.com", "9.9.9.9"), false);
  assert.equal(await attempt(l, "other@x.com", "9.9.9.9"), true);
});

test("a successful login never resets the IP budget (attacker with own account)", async () => {
  const { l } = setup();
  let admitted = 0;
  for (let round = 0; round < 20; round++) {
    for (let i = 0; i < 5; i++)
      if (await attempt(l, `target${round}-${i}@x.com`, "7.7.7.7")) admitted++;
    if (await attempt(l, "mine@x.com", "7.7.7.7")) {
      admitted++;
      await l.clearAttempts(...authRateKeys("login", "mine@x.com", "7.7.7.7").clear);
    }
  }
  assert.equal(admitted, configFor("loginip:").maxAttempts);
});

test("window passing restores access (no permanent lockout)", async () => {
  const { c, l } = setup();
  for (let i = 0; i < 10; i++) await attempt(l, "a@x.com", "3.3.3.3");
  assert.equal(await attempt(l, "a@x.com", "3.3.3.3"), false);
  c.t += 15 * 60 * 1000 + 1;
  assert.equal(await attempt(l, "a@x.com", "3.3.3.3"), true);
});

test("unknown IP: per-IP layer skipped, pair degrades to per-account 5", async () => {
  const k = authRateKeys("login", " A@X.com ", null);
  assert.deepEqual(k.consume, ["login:a@x.com|unknown", "loginacct:a@x.com"]);
  const { l } = setup();
  let admitted = 0;
  for (let i = 0; i < 20; i++) if (await attempt(l, "a@x.com", null)) admitted++;
  assert.equal(admitted, 5);
});

test("password reset layers: IP and per-address email-bomb ceiling", async () => {
  const { l } = setup();
  let a = 0;
  for (let i = 0; i < 40; i++)
    if (!(await l.consumeAll(authRateKeys("reset", `u${i}@x.com`, "5.5.5.5").consume)).limited) a++;
  assert.equal(a, 10);
  let b = 0;
  for (let ip = 0; ip < 20; ip++)
    for (let i = 0; i < 5; i++)
      if (!(await l.consumeAll(authRateKeys("reset", "v@x.com", `8.8.8.${ip}`).consume)).limited) b++;
  assert.equal(b, 10);
});

test("production fail-closed: Redis outage or missing config reports unavailable", async () => {
  const boom = async () => {
    throw new Error("redis down");
  };
  const down: Store = { check: boom, consume: boom, clear: boom };
  for (const l of [createLimiter(down, null), createLimiter(null, null)]) {
    assert.deepEqual(await l.consumeAll(authRateKeys("login", "a@x.com", "1.1.1.1").consume), {
      limited: true,
      unavailable: true,
    });
  }
});

test("retry-after follows the blocking layer and rounds the Upstash reset up", async () => {
  // Upstash sliding window reports reset = next window boundary: an upper
  // bound on when the budget frees up (rejected requests are never recorded).
  const resetAt = new Map<string, number>([
    ["loginip:1.1.1.1", 30_000],
    ["login:a@x.com|1.1.1.1", 14 * 60_000 + 1000],
  ]);
  const store: Store = {
    check: async () => ({ limited: false }),
    consume: async (k) =>
      resetAt.has(k) ? { limited: true, resetAt: resetAt.get(k)! } : { limited: false },
    clear: async () => {},
  };
  const l = createLimiter(store, null, undefined, () => 0);
  assert.deepEqual(await l.consumeAll(["loginip:1.1.1.1", "login:a@x.com|1.1.1.1"]), {
    limited: true,
    retryAfterMinutes: 1,
  });
  assert.deepEqual(await l.consumeAll(["login:a@x.com|1.1.1.1"]), {
    limited: true,
    retryAfterMinutes: 15,
  });
});

test("client IP: headers are ignored without a declared trusted proxy", () => {
  const h = (n: string) => ({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6" })[n] ?? null;
  assert.equal(resolveClientIp(h, {}), null);
  assert.equal(resolveClientIp(h, { TRUSTED_PROXY_HOPS: "0" }), null);
});

test("client IP: Vercel headers; spoofed XFF prefix cannot rotate the IP", () => {
  const vercel = (n: string) =>
    ({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "6.6.6.6, 203.0.113.9" })[n] ??
    null;
  assert.equal(resolveClientIp(vercel, { VERCEL: "1" }), "203.0.113.9");
  const xff = (n: string) => (n === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8, 203.0.113.9" : null);
  assert.equal(resolveClientIp(xff, { TRUSTED_PROXY_HOPS: "1" }), "203.0.113.9");
  assert.equal(resolveClientIp(xff, { TRUSTED_PROXY_HOPS: "2" }), "5.6.7.8");
  assert.equal(resolveClientIp(xff, { TRUSTED_PROXY_HOPS: "9" }), null);
  assert.equal(resolveClientIp(() => "not-an-ip", { VERCEL: "1" }), null);
});

test("IPv6 collapses to /64; v4-mapped becomes v4", () => {
  assert.equal(normalizeIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
  assert.equal(normalizeIp("2001:DB8:1:2::1"), "2001:db8:1:2::/64");
  assert.equal(normalizeIp("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(normalizeIp("::ffff:1.2.3.4"), "1.2.3.4");
  assert.equal(normalizeIp("garbage"), null);
});
