import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Code-level guard for specs that create or mutate real rows (auth.spec.ts,
 * workflows.spec.ts) — smoke.spec.ts never calls this, since it's documented
 * as safe against any target. Call at module scope so it runs before any
 * test in the file, and refuses to proceed if PLAYWRIGHT_BASE_URL points at
 * a non-local target without an explicit opt-in. Docs alone (e2e/README.md)
 * aren't enough here — this makes the same rule unskippable in CI/local runs.
 */
export function assertSafeE2ETarget(): void {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  if (!baseURL) return; // no override — Playwright manages a local dev server itself.

  let hostname: string;
  try {
    hostname = new URL(baseURL).hostname;
  } catch {
    throw new Error(`PLAYWRIGHT_BASE_URL is not a valid URL: ${baseURL}`);
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") return;

  if (process.env.ALLOW_REMOTE_E2E === "true") {
    console.warn(
      `[e2e] Running data-mutating tests against a REMOTE target: ${baseURL}. ALLOW_REMOTE_E2E=true ` +
        `was set — proceeding. This must be a dedicated staging project, never production.`
    );
    return;
  }

  throw new Error(
    `Refusing to run: PLAYWRIGHT_BASE_URL is set to a non-local target (${baseURL}) and this spec ` +
      `creates/mutates real rows. Set ALLOW_REMOTE_E2E=true only if this points at a dedicated ` +
      `staging project — never at production.`
  );
}

// Fixed accounts from scripts/seed-test-accounts.ts, all sharing
// DEV_DEFAULT_PASSWORD — see e2e/README.md for how to provision them.
export const TEST_ACCOUNTS = {
  centreAdmin: "centreadmin@impetus.local",
  coach: "coach@impetus.local",
  medical: "medical@impetus.local",
  parent: "parent@impetus.local",
} as const;

export const TEST_PASSWORD = process.env.DEV_DEFAULT_PASSWORD;

export async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
}

// A minimal valid 1x1 PNG — passes r2.ts's magic-byte sniffing for
// image/png, so upload tests exercise the real validation path rather
// than a fake/empty buffer that would just get rejected.
export const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

// Service-role access for the recovery specs: they need to mint a real
// Supabase recovery token and to create/remove their own throwaway account,
// so they never touch the seeded TEST_ACCOUNTS (whose password other specs
// depend on). Undefined when the key isn't exported — the specs skip rather
// than fail, the same way they skip without DEV_DEFAULT_PASSWORD.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// The publishable/anon key: for specs that need a real end-user Data API
// request (signing in as a seeded account) rather than service-role access,
// so RLS + triggers are exercised the way a hand-rolled client would hit them.
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function adminClient() {
  return createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Mirrors generatePasswordSetupLink (src/lib/auth/provision-user.ts): the
// emailed link points at the app's own /auth/confirm with the token_hash,
// never at Supabase's action_link — that one resolves through the implicit
// grant and puts the tokens in a URL fragment the server can't read.
export async function recoveryLinkFor(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`Could not mint a recovery token: ${error?.message ?? "no hashed_token"}`);
  }
  return `/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
}
