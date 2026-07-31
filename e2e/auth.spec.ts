import { test, expect } from "@playwright/test";
import { TEST_ACCOUNTS, TEST_PASSWORD, loginAs, assertSafeE2ETarget } from "./helpers";

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
