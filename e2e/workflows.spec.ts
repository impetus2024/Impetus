import { test, expect } from "@playwright/test";
import { TEST_ACCOUNTS, TEST_PASSWORD, TEST_PNG, loginAs, assertSafeE2ETarget } from "./helpers";

assertSafeE2ETarget();

// These exercise real business workflows against seeded fixtures — run
// `npm run seed:test-accounts` then `npm run seed:mock-data` first (see
// e2e/README.md). Skipped entirely otherwise rather than failing, since a
// missing seed is an environment gap, not a regression.
test.describe("core workflows", () => {
  test.skip(
    !TEST_PASSWORD,
    "DEV_DEFAULT_PASSWORD not set — seed test accounts and mock data first (see e2e/README.md)"
  );

  test.describe("centre admin", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, TEST_ACCOUNTS.centreAdmin);
      await expect(page).toHaveURL(/\/centre-admin/);
    });

    test("create a package (CRUD)", async ({ page }) => {
      await page.goto("/centre-admin/packages");
      await page.getByRole("button", { name: "Add New Package" }).click();

      const name = `E2E Package ${Date.now()}`;
      await page.getByLabel("Package Name").fill(name);
      await page.getByLabel("Package Price").fill("999");
      await page.getByLabel("Package Duration").fill("1 Month");
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page.getByText(name)).toBeVisible();
    });

    test("create an administrator with a profile picture (file upload)", async ({ page }) => {
      await page.goto("/centre-admin/administrators");
      await page.getByRole("button", { name: "Add Administrator" }).click();

      const email = `e2e.${Date.now()}@example.com`;
      await page.getByLabel("Name").fill("E2E Test Coach");
      await page.getByLabel("Email ID").fill(email);
      await page.getByLabel("Contact Number").fill("9999999999");
      await page.getByLabel("Upload Profile Picture").setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: TEST_PNG,
      });
      await page.getByRole("button", { name: "Create Administrator" }).click();

      await expect(page.getByText(email)).toBeVisible();
    });

    test("record a gate pass entry for a seeded player", async ({ page }) => {
      await page.goto("/centre-admin/gate-pass");
      await page.getByRole("button", { name: "Add Gate Pass" }).click();

      await page.getByLabel("Select Player").click();
      await page.getByRole("option", { name: /Arjun Mehta/ }).click();
      await page.getByLabel("Reason").fill("E2E smoke test entry");
      await page.getByRole("button", { name: /check (in|out)/i }).click();

      await expect(page.getByRole("cell", { name: "Arjun Mehta" }).first()).toBeVisible();
    });
  });

  test("coach marks attendance for a batch", async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.coach);
    await expect(page).toHaveURL(/\/coach/);

    await page.goto("/coach/attendance");
    await page.getByRole("link", { name: "Add Attendance" }).first().click();
    await expect(page).toHaveURL(/\/coach\/attendance\/.+/);

    await page.getByRole("button", { name: "Present" }).first().click();
    await page.getByRole("button", { name: "Save Attendance" }).click();

    await expect(page.getByText(/failed/i)).toHaveCount(0);
  });
});
