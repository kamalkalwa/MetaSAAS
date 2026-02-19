/**
 * Vitest Configuration — @metasaas/platform
 *
 * Unit tests for the platform engine.
 * Tests that need a real database are tagged with 'integration'
 * and run separately via `pnpm test:integration`.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
