import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createSessionCookieAdapter, resolveSupabaseAuth, updateSession } from "./middleware";

const ANON = "anon-key";
const SECRET = "sb_secret_test";
const env = { NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, SUPABASE_SECRET_KEY: SECRET };

test("forwards trusted Vercel client IP with the secret key", () => {
  const get = (n: string) => (n === "x-vercel-forwarded-for" ? "203.0.113.9" : null);
  const auth = resolveSupabaseAuth(get, { ...env, VERCEL: "1" });
  assert.equal(auth.key, SECRET);
  assert.deepEqual(auth.headers, { "Sb-Forwarded-For": "203.0.113.9" });
});

test("ignores spoofed x-forwarded-for when no proxy is trusted", () => {
  const get = (n: string) => (n === "x-forwarded-for" ? "6.6.6.6" : null);
  const auth = resolveSupabaseAuth(get, env);
  assert.equal(auth.key, ANON);
  assert.deepEqual(auth.headers, {});
});

test("uses trusted hop from x-forwarded-for, not the client-controlled left entry", () => {
  const get = (n: string) => (n === "x-forwarded-for" ? "6.6.6.6, 203.0.113.9" : null);
  const auth = resolveSupabaseAuth(get, { ...env, TRUSTED_PROXY_HOPS: "1" });
  assert.equal(auth.headers["Sb-Forwarded-For"], "203.0.113.9");
});

test("missing IP falls back to anon key with no forwarded header", () => {
  const auth = resolveSupabaseAuth(() => null, { ...env, VERCEL: "1" });
  assert.equal(auth.key, ANON);
  assert.deepEqual(auth.headers, {});
});

test("secret key unset: anon key even with a valid IP", () => {
  const get = () => "203.0.113.9";
  const auth = resolveSupabaseAuth(get, { NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, VERCEL: "1" });
  assert.equal(auth.key, ANON);
  assert.deepEqual(auth.headers, {});
});

test("setAll refreshes request + response cookies and applies cache headers", () => {
  const request = new NextRequest("https://app.test/dashboard");
  const adapter = createSessionCookieAdapter(request);
  const before = adapter.getResponse();

  adapter.cookies.setAll(
    [{ name: "sb-access-token", value: "new", options: { path: "/", httpOnly: true } }],
    {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    }
  );

  const after = adapter.getResponse();
  assert.notEqual(after, before);
  assert.equal(request.cookies.get("sb-access-token")?.value, "new");
  assert.equal(after.cookies.get("sb-access-token")?.value, "new");
  assert.equal(after.headers.get("Cache-Control"), "private, no-cache, no-store, must-revalidate, max-age=0");
  assert.equal(after.headers.get("Expires"), "0");
  assert.equal(after.headers.get("Pragma"), "no-cache");
});

test("secret key never reaches response headers or cookies", () => {
  const request = new NextRequest("https://app.test/dashboard");
  const adapter = createSessionCookieAdapter(request);
  adapter.cookies.setAll([{ name: "a", value: "b" }], { Pragma: "no-cache" });
  const res = adapter.getResponse();
  const dump = JSON.stringify([...res.headers.entries()]);
  assert.ok(!dump.includes(SECRET));
});

test("fallback callback fires only when secret key is set and IP is missing", () => {
  let calls = 0;
  const cb = () => calls++;
  resolveSupabaseAuth(() => null, { ...env, VERCEL: "1" }, cb);
  assert.equal(calls, 1);
  resolveSupabaseAuth(() => null, { NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, VERCEL: "1" }, cb);
  resolveSupabaseAuth(() => "203.0.113.9", { ...env, VERCEL: "1" }, cb);
  assert.equal(calls, 1);
});

// --- Integration: expired session through the real updateSession + Supabase client ---

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
// HS256-shaped token so supabase-js verifies via /auth/v1/user (mocked) instead of JWKS.
const jwt = (exp: number) =>
  `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    sub: "user-1",
    aud: "authenticated",
    role: "authenticated",
    exp,
    app_metadata: { role: "coach" },
  })}.sig`;

test("expired session: refresh carries secret key + Sb-Forwarded-For and cookies reach the response", async () => {
  const now = Math.floor(Date.now() / 1000);
  const url = "http://localhost:54321";
  const newAccess = jwt(now + 3600);
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  const calls: { url: string; headers: Headers }[] = [];

  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
  process.env.SUPABASE_SECRET_KEY = SECRET;
  process.env.VERCEL = "1";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input instanceof Request ? input.url : input);
    calls.push({ url: u, headers: new Headers(init?.headers) });
    const user = { id: "user-1", aud: "authenticated", app_metadata: { role: "coach" } };
    const body = u.includes("grant_type=refresh_token")
      ? {
          access_token: newAccess,
          refresh_token: "new-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          user,
        }
      : user;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const expired = {
      access_token: jwt(now - 60),
      refresh_token: "old-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now - 60,
      user: { id: "user-1" },
    };
    const request = new NextRequest("https://app.test/coach", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.9",
        cookie: `sb-localhost-auth-token=${encodeURIComponent(JSON.stringify(expired))}`,
      },
    });

    const res = await updateSession(request);

    const refresh = calls.find((c) => c.url.includes("grant_type=refresh_token"));
    assert.ok(refresh, "refresh request was made");
    assert.equal(refresh.headers.get("apikey"), SECRET);
    assert.equal(refresh.headers.get("Sb-Forwarded-For"), "203.0.113.9");

    assert.equal(res.status, 200, "no redirect for a refreshed session");
    const cookie = res.cookies.getAll().find((c) => c.name.startsWith("sb-localhost-auth-token"));
    assert.ok(cookie, "refreshed session cookie on response");
    const raw = decodeURIComponent(cookie.value);
    const text = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString() : raw;
    assert.ok(text.includes("new-refresh"), "cookie carries the refreshed session");
    assert.match(res.headers.get("Cache-Control") ?? "", /no-store|no-cache/);
    assert.ok(!JSON.stringify([...res.headers.entries()]).includes(SECRET));
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    for (const k of ["SUPABASE_SECRET_KEY", "VERCEL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])
      if (!(k in saved)) delete process.env[k];
  }
});
