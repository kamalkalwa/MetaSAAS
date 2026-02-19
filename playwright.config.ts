/**
 * Playwright E2E Configuration
 *
 * Runs against the locally running dev servers:
 *   - Frontend: http://localhost:3000 (Next.js)
 *   - Backend:  http://localhost:4000 (Fastify)
 *
 * Assumes both servers are already running (pnpm dev).
 * Does NOT auto-start them — this keeps CI flexible and avoids
 * port conflicts during local development.
 */

import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
