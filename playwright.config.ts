import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The dev server Next.js starts for these tests loads .env.local itself, but
// Playwright's own process does not — so without this, the specs that read
// DEV_DEFAULT_PASSWORD, NEXT_PUBLIC_SUPABASE_*, or the local R2/S3 config
// (R2_ENDPOINT, R2_BUCKET_NAME, ...) only work when the caller happened to
// export those variables by hand. Load the same files Next would, before
// anything below reads process.env, so `npm run test:e2e` works from a clean
// shell as e2e/README.md describes. Values already set in the environment win
// (loadEnvConfig does not override them), which keeps CI's explicit env intact.
loadEnvConfig(__dirname);

// PLAYWRIGHT_BASE_URL lets this point at a real deployment (staging/prod)
// instead of spinning up a local dev server — see e2e/README.md.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Every spec shares one `next dev` process, one local database and one
  // storage bucket, and several specs mutate that shared state (documents-ui
  // shrinks the bucket's file-size limit; either documents spec deletes the
  // bucket; the workflow specs upload into it). Running files concurrently
  // makes them race — and the dev server also compiles routes on demand, so
  // four workers competing for it is enough to blow past assertion timeouts.
  // Files still run in order within a worker, so keep this serial; that's the
  // same `--workers=1` these storage specs have always needed (see
  // e2e/README.md).
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /documents-(ui|storage)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // documents-ui.spec.ts and documents-storage.spec.ts both create, mutate
      // (documents-ui shrinks the bucket's file-size limit to force a real
      // upload failure) and delete the one bucket the app is configured with.
      // Keeping them in their own project that is listed last means that, with
      // the single worker above, they run after every other spec — so their
      // destructive bucket lifecycle can't break a concurrent uploader and
      // vice versa. The default chromium project keeps the intent of the rest
      // of the suite explicit.
      name: "documents",
      testMatch: /documents-(ui|storage)\.spec\.ts$/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Only manage a local server when no external baseURL was given.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
