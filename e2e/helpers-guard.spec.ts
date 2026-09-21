import { test, expect } from "@playwright/test";
import { assertSafeE2ETarget } from "./helpers";

// Unit-style coverage for the code-level database-safety guard. Deliberately
// does NOT call assertSafeE2ETarget at module scope (that would make this
// file fail to load in whatever environment it happens to run), and mutates
// only process.env — never a database — so it is safe to run anywhere.
const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "PLAYWRIGHT_BASE_URL", "ALLOW_REMOTE_E2E"] as const;

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test.describe("e2e database safety guard", () => {
  test("blocks a remote Supabase URL", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://company.supabase.co",
        PLAYWRIGHT_BASE_URL: undefined,
        ALLOW_REMOTE_E2E: undefined,
      },
      () => {
        expect(() => assertSafeE2ETarget()).toThrow(/Refusing/);
      }
    );
  });

  test("blocks a remote Supabase URL even when the app URL is local", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://company.supabase.co",
        PLAYWRIGHT_BASE_URL: "http://localhost:3000",
        ALLOW_REMOTE_E2E: undefined,
      },
      () => {
        expect(() => assertSafeE2ETarget()).toThrow(/Refusing/);
      }
    );
  });

  test("allows a local Supabase URL", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        PLAYWRIGHT_BASE_URL: undefined,
        ALLOW_REMOTE_E2E: undefined,
      },
      () => {
        expect(() => assertSafeE2ETarget()).not.toThrow();
      }
    );
  });

  test("allows a remote Supabase URL only with an explicit opt-in", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://staging.example.supabase.co",
        PLAYWRIGHT_BASE_URL: "https://staging.example.com",
        ALLOW_REMOTE_E2E: "true",
      },
      () => {
        expect(() => assertSafeE2ETarget()).not.toThrow();
      }
    );
  });

  test("does not throw when no Supabase URL is configured (specs skip instead)", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        PLAYWRIGHT_BASE_URL: undefined,
        ALLOW_REMOTE_E2E: undefined,
      },
      () => {
        expect(() => assertSafeE2ETarget()).not.toThrow();
      }
    );
  });

  test("rejects a malformed Supabase URL", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        PLAYWRIGHT_BASE_URL: undefined,
        ALLOW_REMOTE_E2E: undefined,
      },
      () => {
        expect(() => assertSafeE2ETarget()).toThrow(/not a valid URL/);
      }
    );
  });
});
