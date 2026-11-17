import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { clearSlidingWindow, slidingWindowKeys } from "./rate-limit-core";

// Fake Redis that (a) emulates the sliding-window Lua script the library
// sends, (b) records every command, and (c) THROWS on SCAN/KEYS/FLUSH* and
// on any unknown script, so a reset that scans the keyspace fails the test.
class FakeRedis {
  data = new Map<string, number>();
  commands: string[] = [];

  private script(keys: string[], args: unknown[]) {
    this.commands.push("script");
    const [cur, prev] = keys;
    const [tokens, now, window, inc] = args.map(Number);
    if (keys.length !== 2) throw new Error("unexpected script keys: " + keys.join(","));
    const c = this.data.get(cur) ?? 0;
    const p = Math.floor((1 - (now % window) / window) * (this.data.get(prev) ?? 0));
    if (inc > 0 && p + c >= tokens) return [-1, tokens];
    const next = c + inc;
    this.data.set(cur, next);
    return [tokens - (next + p), tokens];
  }
  async evalsha(_hash: string, keys: string[], args: unknown[]) {
    return this.script(keys, args);
  }
  async eval(_script: string, keys: string[], args: unknown[]) {
    return this.script(keys, args);
  }
  async del(...keys: string[]) {
    this.commands.push("del");
    assert.ok(keys.length <= 3, "DEL must be bounded");
    let n = 0;
    for (const k of keys) n += this.data.delete(k) ? 1 : 0;
    return n;
  }
  async scan() {
    throw new Error("SCAN is forbidden");
  }
  async keys() {
    throw new Error("KEYS is forbidden");
  }
  async flushall() {
    throw new Error("FLUSHALL is forbidden");
  }
  async flushdb() {
    throw new Error("FLUSHDB is forbidden");
  }
}

const MAX = 3;
const WINDOW = 60_000;
const PREFIX = `ratelimit:${MAX}/${WINDOW}`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function setup() {
  const redis = new FakeRedis();
  const localBlocks = new Map<string, number>();
  const rl = new Ratelimit({
    // The fake only implements the commands the sliding window uses.
    redis: redis as unknown as ConstructorParameters<typeof Ratelimit>[0]["redis"],
    limiter: Ratelimit.slidingWindow(MAX, `${WINDOW} ms`),
    prefix: PREFIX,
    ephemeralCache: localBlocks,
    timeout: 3000,
  });
  return { redis, localBlocks, rl };
}

test("slidingWindowKeys matches the keys the real library writes", async () => {
  const { redis, rl } = setup();
  const id = hash("login:a@x.com|1.1.1.1");
  const before = Date.now();
  await rl.limit(id);
  const after = Date.now();
  const written = [...redis.data.keys()];
  assert.equal(written.length, 1);
  const candidates = new Set(
    [before, after].flatMap((t) => slidingWindowKeys(PREFIX, id, WINDOW, t).counters)
  );
  assert.ok(candidates.has(written[0]), `${written[0]} not in ${[...candidates].join(" | ")}`);
});

test("clear removes only this identifier's counters, with DEL and no SCAN", async () => {
  const { redis, localBlocks, rl } = setup();
  const mine = hash("login:victim@x.com|9.9.9.9");
  const other = hash("login:other@x.com|9.9.9.9");
  const now = Date.now();
  const w = Math.floor(now / WINDOW);

  // Real attempts (via the library) for two identifiers.
  for (let i = 0; i < MAX; i++) await rl.limit(mine);
  for (let i = 0; i < 2; i++) await rl.limit(other);
  // Unrelated keys that a wildcard / prefix-based delete would catch.
  const unrelated = [
    `${PREFIX}:${mine}x:${w}`, // hash with extra suffix
    `${PREFIX}:${mine.slice(0, 32)}:${w}`, // hash prefix
    `${PREFIX}:${mine}:${w - 2}`, // older window of the same identifier
    `${PREFIX}:${mine}:${w + 2}`, // far-future window
    `ratelimit:5/900000:${mine}:${w}`, // same hash, different limiter config
    `other-app:session:${w}`,
    `${PREFIX}:${other}:${w}`,
  ];
  for (const k of unrelated) redis.data.set(k, 7);
  // The library blocked `mine` locally after hitting the limit.
  assert.equal((await rl.limit(mine)).success, false);
  assert.ok(localBlocks.has(`${PREFIX}:${mine}`));

  const snapshot = new Map(redis.data);
  redis.commands.length = 0;
  await clearSlidingWindow(redis, localBlocks, PREFIX, mine, WINDOW, now);

  assert.deepEqual(redis.commands, ["del"]); // exactly one DEL, nothing else
  for (const k of slidingWindowKeys(PREFIX, mine, WINDOW, now).counters) {
    assert.equal(redis.data.has(k), false, `${k} should be gone`);
  }
  // Every other key is byte-for-byte untouched.
  for (const [k, v] of snapshot) {
    if (!slidingWindowKeys(PREFIX, mine, WINDOW, now).counters.includes(k)) {
      assert.equal(redis.data.get(k), v, `${k} must survive`);
    }
  }
  assert.equal(localBlocks.has(`${PREFIX}:${mine}`), false);
});

test("after clear the identifier gets a fresh budget; neighbours keep theirs", async () => {
  const { redis, localBlocks, rl } = setup();
  const mine = hash("login:v@x.com|1.1.1.1");
  const other = hash("login:o@x.com|1.1.1.1");
  for (let i = 0; i < MAX; i++) await rl.limit(mine);
  for (let i = 0; i < MAX; i++) await rl.limit(other);
  assert.equal((await rl.limit(mine)).success, false);

  await clearSlidingWindow(redis, localBlocks, PREFIX, mine, WINDOW, Date.now());

  for (let i = 0; i < MAX; i++) assert.equal((await rl.limit(mine)).success, true);
  assert.equal((await rl.limit(mine)).success, false);
  assert.equal((await rl.limit(other)).success, false); // still exhausted
});

test("concurrent attempts and clears never throw or scan; limit still caps", async () => {
  const { redis, localBlocks, rl } = setup();
  const id = hash("login:c@x.com|2.2.2.2");
  const results = await Promise.all([
    ...Array.from({ length: 20 }, () => rl.limit(id)),
    clearSlidingWindow(redis, localBlocks, PREFIX, id, WINDOW, Date.now()),
    ...Array.from({ length: 20 }, () => rl.limit(id)),
  ]);
  const admitted = results.filter((r) => typeof r === "object" && r && "success" in r && r.success);
  // One clear in the middle can at most grant one extra budget.
  assert.ok(admitted.length >= MAX && admitted.length <= MAX * 2, `admitted ${admitted.length}`);
  assert.ok(!redis.commands.includes("scan"));
});

test("new counters written after a clear still carry the library's TTL path (untouched)", async () => {
  // clear only DELs; the next limit() recreates the key through the library's
  // own script (which sets PEXPIRE on first write), so TTL handling is the
  // library's, not ours.
  const { redis, localBlocks, rl } = setup();
  const id = hash("login:t@x.com|3.3.3.3");
  await rl.limit(id);
  await clearSlidingWindow(redis, localBlocks, PREFIX, id, WINDOW, Date.now());
  assert.equal(redis.data.size, 0);
  await rl.limit(id);
  assert.equal(redis.data.size, 1);
});
