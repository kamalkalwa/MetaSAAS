/**
 * Bootstrap
 *
 * Wires the platform engine with the domain layer.
 * This is the SINGLE place where platform meets domain.
 *
 * Sequence:
 *   1. Load config + validate license
 *   2. Initialize database connection
 *   3. Register domain entities with the platform
 *   4. Build database schemas from entity definitions
 *   5. Generate CRUD actions for each entity
 *   6. Run database migrations (create tables)
 *   7. Initialize AI Gateway
 *   8. Register event subscribers
 *   9. Return the initialized config
 */

import {
  loadConfig,
  initLicensing,
  initDatabase,
  initAuthProvider,
  initAIGateway,
  initEmail,
  initStorage,
  initNotifications,
  initBilling,
  seedDefaultPlans,
  billingPlugin,
  notificationPlugin,
  registerEntities,
  buildTableSchema,
  generateCRUDActions,
  registerActions,
  registerEntityAICapabilities,
  subscribeAll,
  runMigrations,
  runPlatformMigrations,
  initPlugins,
  initObservability,
  type MetaSAASPlugin,
} from "@metasaas/platform";
import { entities, eventSubscribers } from "@metasaas/domain";

/**
 * Initializes the entire application.
 * Call once at server startup.
 */
export async function bootstrap(options?: { plugins?: MetaSAASPlugin[] }) {
  // 0. Initialize observability FIRST — captures errors from all subsequent steps
  initObservability();

  // 1. Load configuration from environment
  const config = loadConfig();

  // 2. Validate license key — determines which features are available
  initLicensing();

  // 3. Initialize database connection
  initDatabase(config);

  // 4. Initialize authentication provider
  initAuthProvider();

  // 5. Register domain entities with the platform
  registerEntities(entities);

  // 6. Build Drizzle table schemas from entity definitions
  for (const entity of entities) {
    buildTableSchema(entity);
  }

  // 7. Generate CRUD actions for each entity and register them
  for (const entity of entities) {
    const crudActions = generateCRUDActions(entity);
    registerActions(crudActions);
  }

  // 8. Run platform migrations (chat tables, etc.)
  await runPlatformMigrations();

  // 9. Run entity migrations (create tables if they don't exist)
  await runMigrations(entities);

  // 10. Initialize email service (auto-detects Resend or falls back to console)
  initEmail();

  // 11. Initialize file storage (auto-detects S3 or falls back to local)
  initStorage();

  // 12. Initialize in-app notifications (auto-detects database or falls back to console)
  initNotifications();

  // 13. Initialize billing (auto-detects Stripe or falls back to console)
  initBilling();

  // 13b. Seed default plans (Free, Pro, Enterprise) if plans table is empty
  await seedDefaultPlans();

  // 14. Initialize AI Gateway (always enabled — AI is free)
  initAIGateway();
  for (const entity of entities) {
    registerEntityAICapabilities(entity);
  }

  // 15. Initialize plugins — billing + notifications + any custom plugins
  const allPlugins = [billingPlugin, notificationPlugin, ...(options?.plugins ?? [])];
  await initPlugins(allPlugins);

  // 13. Register domain event subscribers
  subscribeAll(eventSubscribers);
  console.log(
    `[bootstrap] Registered ${eventSubscribers.length} event subscribers`
  );

  console.log(
    `[bootstrap] Registered ${entities.length} entities: ${entities.map((e) => e.name).join(", ")}`
  );

  return config;
}
