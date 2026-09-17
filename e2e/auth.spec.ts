import { test, expect } from "@playwright/test";
import {
  TEST_ACCOUNTS,
  TEST_PASSWORD,
  loginAs,
  assertSafeE2ETarget,
  adminClient,
  recoveryLinkFor,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./helpers";

assertSafeE2ETarget();

test.describe("authentication and authorization", () => {
  test.skip(
    !TEST_PASSWORD,
    "DEV_DEFAULT_PASSWORD not set — run `npm run seed:test-accounts` against a local/staging Supabase first (see e2e/README.md)"
  );

  test("centre admin logs in and lands on their own dashboard", async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/);
  });

  test("coach logs in and lands on their own dashboard, not centre admin's", async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.coach);
    await expect(page).toHaveURL(/\/coach/);
  });

  test("wrong password is rejected with an error, not a redirect", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ACCOUNTS.centreAdmin);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("a coach cannot reach centre-admin-only pages", async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.coach);
    await expect(page).toHaveURL(/\/coach/);

    await page.goto("/centre-admin/administrators");
    await expect(page).not.toHaveURL(/\/centre-admin\/administrators/);
  });

  test("logging out clears the session", async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/);

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/centre-admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

// Regression cover for the email-change recovery link, which used to land on
// /login?error=invalid-reset-link every time: the link was Supabase's own
// action_link, and GoTrue resolved it through the implicit grant into a URL
// *fragment* that /auth/confirm (a Route Handler) can never see.
test.describe("password recovery link", () => {
  test.skip(
    !SERVICE_ROLE_KEY || !SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL not exported — see e2e/README.md"
  );

  // Its own throwaway account: these tests change a password, which would
  // break every other spec if it were one of the shared TEST_ACCOUNTS.
  const email = `recovery-${Date.now()}@impetus.local`;
  const newPassword = "new-password-9281";
  let userId: string;

  test.beforeAll(async () => {
    const { data, error } = await adminClient().auth.admin.createUser({
      email,
      password: "initial-password-1234",
      email_confirm: true,
      app_metadata: { role: "parent", centre_id: null },
      user_metadata: { full_name: "Recovery Test" },
    });
    if (error || !data.user) throw new Error(`Could not create the test account: ${error?.message}`);
    userId = data.user.id;
  });

  test.afterAll(async () => {
    if (userId) await adminClient().auth.admin.deleteUser(userId);
  });

  test("a fresh link opens the set-password form instead of an expired-link error", async ({ page }) => {
    await page.goto(await recoveryLinkFor(email));
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByRole("heading", { name: /set a new password/i })).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm new password")).toBeVisible();
  });

  test("the recovery session survives a page refresh", async ({ page }) => {
    await page.goto(await recoveryLinkFor(email));
    await expect(page).toHaveURL(/\/reset-password/);
    await page.reload();
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByRole("heading", { name: /set a new password/i })).toBeVisible();
  });

  test("a mismatched confirmation is rejected and nothing is saved", async ({ page }) => {
    await page.goto(await recoveryLinkFor(email));
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(`${newPassword}-different`);
    await page.getByRole("button", { name: /save password/i }).click();
    await expect(page.getByText(/don't match/i)).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test("an invalid token shows the expired-link error on /login", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=not-a-real-token&type=recovery");
    await expect(page).toHaveURL(/\/login\?error=invalid-reset-link/);
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });

  test("a link is single-use: replaying it shows the expired-link error", async ({ page }) => {
    const link = await recoveryLinkFor(email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password/);

    await page.context().clearCookies();
    await page.goto(link);
    await expect(page).toHaveURL(/\/login\?error=invalid-reset-link/);
  });

  // Last: it changes the password the earlier tests rely on being unset.
  test("a successful update signs the user out and lets them log in again", async ({ page }) => {
    await page.goto(await recoveryLinkFor(email));
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: /save password/i }).click();

    await expect(page).toHaveURL(/\/login\?reset=success/);
    await expect(page.getByText(/password has been updated/i)).toBeVisible();

    // Signed out, not carried into the account on the old recovery session.
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
