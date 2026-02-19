/**
 * Seed Script
 *
 * Populates the database with demo data.
 * Run with: pnpm db:seed
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import { bootstrap } from "./bootstrap.js";
import { dispatch, DEV_TENANT_ID } from "@metasaas/platform";
import { entities, seedData } from "@metasaas/domain";
import { closeDatabase } from "@metasaas/platform";

async function seed() {
  console.log("[seed] Starting...");

  await bootstrap();

  const caller = {
    userId: "seed-script",
    tenantId: DEV_TENANT_ID,
    roles: ["admin"] as string[],
    type: "system" as const,
  };

  /**
   * Track created record IDs by entity name.
   * Used to assign foreign keys for child entities (belongsTo).
   * e.g., after seeding Projects, Task records get a random projectId.
   */
  const createdIds: Record<string, string[]> = {};

  // Seed entities in order (dependencies first)
  for (const entity of entities) {
    const data = seedData[entity.name];
    if (!data || data.length === 0) continue;

    console.log(`[seed] Seeding ${data.length} ${entity.pluralName}...`);
    createdIds[entity.name] = [];

    for (const record of data) {
      // For belongsTo relationships, assign a random parent ID from already-seeded parents
      const enrichedRecord = { ...record };
      if (entity.relationships) {
        for (const rel of entity.relationships) {
          if (rel.type === "belongsTo" && createdIds[rel.entity]?.length > 0) {
            // Convert FK name from snake_case to camelCase for the API contract
            const fkFieldName = rel.foreignKey
              ? rel.foreignKey.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
              : `${rel.entity.charAt(0).toLowerCase()}${rel.entity.slice(1)}Id`;

            // Only assign if not already provided in seed data
            if (enrichedRecord[fkFieldName] === undefined) {
              const parentIds = createdIds[rel.entity];
              enrichedRecord[fkFieldName] =
                parentIds[Math.floor(Math.random() * parentIds.length)];
            }
          }
        }
      }

      const result = await dispatch(
        `${entity.name.toLowerCase()}.create`,
        enrichedRecord,
        caller
      );

      if (!result.success) {
        console.warn(
          `[seed] Failed to create ${entity.name}: ${result.error}`
        );
      } else if (result.data && typeof result.data === "object" && "id" in result.data) {
        createdIds[entity.name].push((result.data as Record<string, unknown>).id as string);
      }
    }
  }

  console.log("[seed] Done!");
  await closeDatabase();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
