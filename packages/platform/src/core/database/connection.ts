/**
 * Database Connection
 *
 * Establishes and manages the PostgreSQL connection via Drizzle ORM.
 * Provides the raw Drizzle instance for schema operations and a
 * typed DatabaseClient for action-level data access.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AppConfig } from "../config/index.js";

/** The raw postgres.js client instance */
let sqlClient: ReturnType<typeof postgres> | null = null;

/** The Drizzle ORM instance */
let drizzleInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Initializes the database connection.
 * Call once at application startup.
 */
export function initDatabase(config: AppConfig) {
  sqlClient = postgres(config.database.url);
  drizzleInstance = drizzle(sqlClient);

  return { sql: sqlClient, db: drizzleInstance };
}

/**
 * Returns the active Drizzle instance.
 * Throws if initDatabase() hasn't been called.
 */
export function getDatabase() {
  if (!drizzleInstance || !sqlClient) {
    throw new Error(
      "Database not initialized. Call initDatabase() at startup."
    );
  }
  return { sql: sqlClient, db: drizzleInstance };
}

/**
 * Closes the database connection gracefully.
 * Call on application shutdown.
 */
export async function closeDatabase() {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    drizzleInstance = null;
  }
}
