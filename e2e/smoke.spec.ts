import { test, expect } from "@playwright/test";

// No authentication or seed data required — these must pass against any
// environment (including CI, before test accounts are ever seeded).
test.describe("smoke", () => {
  test("health endpoint responds with a status payload", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());

    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body.checks?.database).toBeDefined();
    expect(body.checks?.storage).toBeDefined();
  });

  test("unauthenticated visitor is redirected to login", async ({ page }) => {
    await page.goto("/centre-admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("root path requires authentication", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
