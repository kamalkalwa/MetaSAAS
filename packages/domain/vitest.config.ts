/**
 * Vitest Configuration — @metasaas/domain
 *
 * Tests for domain entity definitions.
 * Validates that entity structures conform to the contracts.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
