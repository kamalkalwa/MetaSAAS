/**
 * Vitest Configuration — @metasaas/contracts
 *
 * Pure TypeScript tests. No DOM, no database, no network.
 * These tests validate Zod schemas and type definitions.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
