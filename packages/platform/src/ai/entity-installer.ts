/**
 * Entity Installer
 *
 * Hot-installs entities at runtime without restarting the server.
 * Takes an EntityDefinition (from AI generation or manual creation),
 * registers it in all platform subsystems, creates the database table,
 * and makes it immediately available via the Action Bus.
 *
 * Usage:
 *   import { installEntity } from "./entity-installer";
 *
 *   const result = await installEntity(entityDefinition);
 *   // Entity is now live — CRUD actions registered, DB table created
 *
 * After installation:
 *   - POST /api/actions/{entity}.create works immediately
 *   - GET /api/meta/entities returns the new entity
 *   - All 5 CRUD actions are registered in the Action Bus
 */

import type { EntityDefinition } from "@metasaas/contracts";
import { registerEntity, getEntity } from "../core/entity-manager/entity-registry.js";
import { buildTableSchema } from "../core/database/schema-builder.js";
import { generateCRUDActions } from "../core/entity-manager/crud-generator.js";
import { registerActions, getAction } from "../core/action-bus/registry.js";
import { runMigrations } from "../core/database/migrate.js";
import { registerEntityAICapabilities } from "./gateway.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstallResult {
  /** Whether the installation succeeded */
  success: boolean;
  /** Entity name */
  entityName: string;
  /** Actions registered (e.g., ["contact.create", "contact.findAll", ...]) */
  actions: string[];
  /** Error message if failed */
  error?: string;
  /** Warnings (e.g., entity already exists) */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

/**
 * Hot-install an entity at runtime.
 *
 * This runs the same sequence as bootstrap.ts but for a single entity:
 *   1. Register entity definition
 *   2. Build Drizzle table schema
 *   3. Generate CRUD actions
 *   4. Register CRUD actions in the Action Bus
 *   5. Run database migration (CREATE TABLE / ALTER TABLE)
 *   6. Register AI capabilities (if any)
 *
 * After this call, the entity is fully operational:
 *   - Callable via POST /api/actions/{entity}.create
 *   - Visible in GET /api/meta/entities
 *   - Database table exists with all columns
 *
 * Safe to call for entities that are partially installed (idempotent where possible).
 * Never throws — returns error in result.
 */
export async function installEntity(entity: EntityDefinition): Promise<InstallResult> {
  const warnings: string[] = [];
  const entityLower = entity.name.toLowerCase();

  try {
    // 1. Register entity definition
    const existing = getEntity(entity.name);
    if (existing) {
      warnings.push(`Entity "${entity.name}" already registered — skipping registration`);
    } else {
      registerEntity(entity);
    }

    // 2. Build Drizzle table schema (idempotent — returns cached if exists)
    buildTableSchema(entity);

    // 3. Generate CRUD actions
    const crudActions = generateCRUDActions(entity);

    // 4. Register CRUD actions (check for duplicates first)
    const registeredActions: string[] = [];
    for (const action of crudActions) {
      if (getAction(action.id)) {
        warnings.push(`Action "${action.id}" already registered — skipping`);
      } else {
        registerActions([action]);
      }
      registeredActions.push(action.id);
    }

    // 5. Run database migration
    await runMigrations([entity]);

    // 6. Register AI capabilities (if any)
    if ((entity as any).aiCapabilities?.length) {
      try {
        registerEntityAICapabilities(entity);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        warnings.push(`AI capability registration warning: ${msg}`);
      }
    }

    console.log(
      `[entity-installer] Installed "${entity.name}" — ${registeredActions.length} actions, table ready`
    );

    return {
      success: true,
      entityName: entity.name,
      actions: registeredActions,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[entity-installer] Failed to install "${entity.name}": ${message}`);
    return {
      success: false,
      entityName: entity.name,
      actions: [],
      error: message,
      warnings,
    };
  }
}

/**
 * Install multiple entities at runtime.
 * Installs in order — later entities can reference earlier ones via relationships.
 */
export async function installEntities(
  entities: EntityDefinition[]
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  for (const entity of entities) {
    const result = await installEntity(entity);
    results.push(result);
    if (!result.success) {
      console.error(
        `[entity-installer] Stopping — "${entity.name}" failed. ${results.length - 1} of ${entities.length} installed.`
      );
      break;
    }
  }
  return results;
}
