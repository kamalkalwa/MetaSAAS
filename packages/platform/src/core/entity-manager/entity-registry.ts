/**
 * Entity Registry
 *
 * Central registry of all entity definitions.
 * The domain registers entities here at startup.
 * The platform reads this to build schemas, generate CRUD, and configure the UI.
 */

import type { EntityDefinition } from "@metasaas/contracts";

/** All registered entities, keyed by entity name */
const entities = new Map<string, EntityDefinition>();

/**
 * Registers an entity definition.
 */
export function registerEntity(entity: EntityDefinition) {
  if (entities.has(entity.name)) {
    throw new Error(
      `Entity "${entity.name}" is already registered. Entity names must be unique.`
    );
  }
  entities.set(entity.name, entity);
}

/**
 * Registers multiple entities at once.
 */
export function registerEntities(entityList: EntityDefinition[]) {
  for (const entity of entityList) {
    registerEntity(entity);
  }
}

/**
 * Retrieves an entity definition by name.
 */
export function getEntity(name: string): EntityDefinition | undefined {
  return entities.get(name);
}

/**
 * Retrieves an entity by its plural name (URL-friendly lowercase).
 * Used for routing: "/contacts" → Contact entity.
 */
export function getEntityByPlural(
  pluralName: string
): EntityDefinition | undefined {
  const normalized = pluralName.toLowerCase();
  return Array.from(entities.values()).find(
    (e) => e.pluralName.toLowerCase() === normalized
  );
}

/**
 * Returns all registered entities.
 */
export function getAllEntities(): EntityDefinition[] {
  return Array.from(entities.values());
}

/**
 * Clears all registered entities. Used for testing.
 */
export function clearEntityRegistry() {
  entities.clear();
}
