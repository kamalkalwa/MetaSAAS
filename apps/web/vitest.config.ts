/**
 * Vitest Configuration — @metasaas/web
 *
 * React component and utility tests.
 * Uses jsdom to simulate the browser environment.
 * Path alias '@/' maps to './src/' to match Next.js convention.
 *
 * The React plugin provides automatic JSX transformation so test files
 * don't need to manually import React.
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
