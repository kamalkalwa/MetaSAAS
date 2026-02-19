/**
 * Vitest Workspace Configuration
 *
 * Defines all testable packages in the monorepo.
 * Run `pnpm test` at the root to execute tests across all packages.
 * Run `pnpm test --filter=@metasaas/contracts` to test a single package.
 */

import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/contracts",
  "packages/platform",
  "packages/domain",
  "apps/api",
  "apps/web",
]);
