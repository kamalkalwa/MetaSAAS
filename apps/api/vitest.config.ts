/**
 * Vitest Configuration — @metasaas/api
 *
 * API integration tests using Fastify's inject() method.
 * Tests the full request/response cycle without a real HTTP server.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
