import { test, expect } from "@playwright/test";

const e2eLoginEmail = process.env.E2E_LOGIN_EMAIL;
const e2eLoginPassword = process.env.E2E_LOGIN_PASSWORD;

test("home page renders main content", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/mameko/i);
  await expect(page.locator("main")).toBeVisible();
});

test("checkout requires authentication and redirects to login", async ({ page }) => {
  await page.goto("/checkout");

  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcheckout|\/login\?callbackUrl=\/checkout/);
  await expect(page.locator("body")).toContainText(/mameko|login|masuk/i);
});

test("login and open account orders page", async ({ page }) => {
  test.skip(
    !e2eLoginEmail || !e2eLoginPassword,
    "Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run authenticated E2E flow.",
  );

  await page.goto("/login?callbackUrl=/account/orders");

  await page.locator('input[name="email"]').fill(String(e2eLoginEmail));
  await page.locator('input[name="password"]').fill(String(e2eLoginPassword));
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/account\/orders/);
  await expect(page.locator("body")).toContainText(/pesanan|total pesanan|belum ada pesanan/i);
});
