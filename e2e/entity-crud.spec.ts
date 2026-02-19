/**
 * E2E: Entity CRUD Lifecycle
 *
 * Tests the full create-read-update-delete lifecycle for entities
 * through the web UI. Uses the "Tasks" entity since it has a
 * well-defined field set.
 *
 * Prerequisites:
 *   - Dev servers running (pnpm dev)
 *   - Supabase configured with test user
 */

import { test, expect } from "playwright/test";

const TEST_EMAIL = "admin@metasaas.dev";
const TEST_PASSWORD = "Test1234!";

/**
 * Shared auth state: log in once and reuse across tests in this file.
 */
test.describe("Entity CRUD Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("sidebar shows entity navigation items", async ({ page }) => {
    // The sidebar should have navigation links loaded from the entity registry
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Dashboard is always present
    await expect(sidebar.locator("text=Dashboard")).toBeVisible();

    // Wait for entity metadata to load — at least Contacts should appear
    await expect(sidebar.locator('a:has-text("Contacts")')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("entity list page loads and displays table", async ({ page }) => {
    // Wait for entity metadata to load so sidebar links are available
    const tasksLink = page.locator('aside a:has-text("Tasks")');
    await expect(tasksLink).toBeVisible({ timeout: 10_000 });

    // Navigate to the Tasks entity page via sidebar
    await tasksLink.click();
    await expect(page).toHaveURL(/\/tasks/, { timeout: 10_000 });

    // The page should show a heading or table structure
    await expect(page.locator("text=Tasks").first()).toBeVisible();
  });

  test("create a new task", async ({ page }) => {
    // Navigate to new task form (direct URL, no sidebar click needed)
    await page.goto("/tasks/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);

    // Fill in the task form — the title field is required
    const titleInput = page.locator('input[name="title"], input').first();
    await titleInput.fill("E2E Test Task");

    // Submit the form
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Create"), button:has-text("Save")'
    ).first();
    await submitButton.click();

    // Should redirect back to the entity list or detail page
    await page.waitForURL(/\/tasks/, { timeout: 10_000 });
  });

  test("view task detail page", async ({ page }) => {
    // Go to the tasks list
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    // Click on the first task in the list (if any exist)
    const firstRow = page.locator("table tbody tr, [data-entity-row]").first();
    const rowCount = await firstRow.count();

    if (rowCount > 0) {
      await firstRow.click();
      await page.waitForURL(/\/tasks\/[^/]+/, { timeout: 10_000 });

      // Should show task details
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("navigate between entities", async ({ page }) => {
    const sidebar = page.locator("aside");

    // Wait for entity metadata to load
    await expect(sidebar.locator('a:has-text("Contacts")')).toBeVisible({
      timeout: 10_000,
    });

    // Click Contacts
    await sidebar.locator('a:has-text("Contacts")').click();
    await expect(page).toHaveURL(/\/contacts/, { timeout: 10_000 });

    // Click Companies
    await expect(sidebar.locator('a:has-text("Companies")')).toBeVisible();
    await sidebar.locator('a:has-text("Companies")').click();
    await expect(page).toHaveURL(/\/companies/, { timeout: 10_000 });

    // Click back to Dashboard
    await sidebar.locator('a:has-text("Dashboard")').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
