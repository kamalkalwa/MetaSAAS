/**
 * Bootstrap
 *
 * Wires the platform engine with the domain layer.
 * This is the SINGLE place where platform meets domain.
 *
 * Sequence:
 *   1. Load config
 *   2. Initialize database connection
 *   3. Register domain entities with the platform
 *   4. Build database schemas from entity definitions
 *   5. Generate CRUD actions for each entity
 *   6. Run database migrations (create tables)
 *   7. Return the initialized config
 */

import {
  loadConfig,
  initDatabase,
  initAuthProvider,
  initAIGateway,
  registerEntities,
  buildTableSchema,
  generateCRUDActions,
  registerActions,
  registerEntityAICapabilities,
  subscribeAll,
  runMigrations,
  runPlatformMigrations,
} from "@metasaas/platform";
import { entities, eventSubscribers } from "@metasaas/domain";

/**
 * Initializes the entire application.
 * Call once at server startup.
 */
export async function bootstrap() {
  // 1. Load configuration from environment
  const config = loadConfig();

  // 2. Initialize database connection
  initDatabase(config);

  // 3. Initialize authentication provider
  initAuthProvider();

  // 4. Register all domain entities with the platform
  registerEntities(entities);

  // 5. Build Drizzle table schemas from entity definitions
  for (const entity of entities) {
    buildTableSchema(entity);
  }

  // 6. Generate CRUD actions for each entity and register them
  for (const entity of entities) {
    const crudActions = generateCRUDActions(entity);
    registerActions(crudActions);
  }

  // 7. Run platform migrations (chat tables, etc.)
  await runPlatformMigrations();

  // 8. Run entity migrations (create tables if they don't exist)
  await runMigrations(entities);

  // 9. Initialize AI Gateway and register AI capabilities
  initAIGateway();
  for (const entity of entities) {
    registerEntityAICapabilities(entity);
  }

  // 10. Register domain event subscribers
  subscribeAll(eventSubscribers);
  console.log(
    `[bootstrap] Registered ${eventSubscribers.length} event subscribers`
  );

  console.log(
    `[bootstrap] Registered ${entities.length} entities: ${entities.map((e) => e.name).join(", ")}`
  );

  return config;
}
