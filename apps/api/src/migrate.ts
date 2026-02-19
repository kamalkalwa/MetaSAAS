/**
 * Migration Script
 *
 * Runs database migrations independently of server startup.
 * Creates tables for all registered entities.
 *
 * Usage: pnpm db:migrate
 *
 * This is useful for:
 *   - Setting up a fresh database
 *   - Running migrations in CI/CD pipelines
 *   - Running migrations without starting the server
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import {
  loadConfig,
  initDatabase,
  registerEntities,
  buildTableSchema,
  runMigrations,
  runPlatformMigrations,
  closeDatabase,
} from "@metasaas/platform";
import { entities } from "@metasaas/domain";

async function migrate() {
  console.log("[migrate] Starting database migration...");

  // 1. Load configuration
  const config = loadConfig();
  console.log(`[migrate] Database: ${config.database.url.replace(/\/\/.*@/, "//***@")}`);

  // 2. Initialize database connection
  initDatabase(config);

  // 3. Register entities so schema builder knows about them
  registerEntities(entities);

  // 4. Build Drizzle table schemas
  for (const entity of entities) {
    buildTableSchema(entity);
  }

  // 5. Run platform-level migrations (chat sessions, etc.)
  await runPlatformMigrations();

  // 6. Run entity-level migrations (CREATE TABLE IF NOT EXISTS)
  await runMigrations(entities);

  console.log(
    `[migrate] Migrated ${entities.length} entities: ${entities.map((e) => e.name).join(", ")}`
  );

  // 6. Clean up
  await closeDatabase();
  console.log("[migrate] Done.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
