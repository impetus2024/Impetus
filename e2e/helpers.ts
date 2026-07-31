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
