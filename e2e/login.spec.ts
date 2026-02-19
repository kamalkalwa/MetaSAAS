/**
 * E2E: Login Flow
 *
 * Verifies the authentication flow for the MetaSAAS application.
 * Tests both the unauthenticated redirect and the successful login.
 *
 * Prerequisites:
 *   - Dev servers running (pnpm dev)
 *   - Supabase configured with test user: admin@metasaas.dev / Test1234!
 */

import { test, expect } from "playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "admin@metasaas.dev";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Test1234!";

test.describe("Login Flow", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to the login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("login form renders with email and password fields", async ({ page }) => {
    await page.goto("/login");

    // The form should be visible with all expected elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator("h1")).toContainText("Sign in");
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "WrongPassword1!");
    await page.click('button[type="submit"]');

    // Should show an error message (not redirect)
    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test("successful login redirects to /dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to the dashboard after login
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Dashboard should render the app brand in the sidebar
    await expect(
      page.locator("aside").getByText("MetaSAAS", { exact: true })
    ).toBeVisible();
  });
});
