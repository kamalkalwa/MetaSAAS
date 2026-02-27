/**
 * Plugin Host
 *
 * Provides the plugin contract for the open-core model.
 * Plugins register actions, event subscribers, and Fastify routes
 * at bootstrap time — before the REST adapter starts.
 *
 * The PRO repo uses this to add billing, SSO, white-label, and
 * advanced RBAC without forking the platform.
 *
 * Safety guarantees:
 *   - Plugin errors are caught and logged, never crash the platform
 *   - Feature requirements checked BEFORE register() — no partial init
 *   - Plugins can ADD actions/subscribers, not modify existing ones
 */

import type { FastifyInstance } from "fastify";
import { registerAction, registerActions, getAction, getAllActions, getActionsForEntity } from "../action-bus/registry.js";
import { subscribe } from "../event-bus/index.js";
import { isFeatureEnabled, type Feature } from "../licensing/index.js";
import { getEntity, getAllEntities } from "../entity-manager/entity-registry.js";
import { getDatabase } from "../database/connection.js";
import { createLogger } from "../action-bus/middleware/logging.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaSAASPlugin {
  /** Unique plugin name (e.g. "pro-billing") */
  name: string;
  /** Semver version string */
  version: string;
  /** Feature IDs this plugin requires — checked before register() */
  requires?: string[];
  /** Called once during bootstrap to register actions, subscribers, routes */
  register(ctx: PluginContext): Promise<void>;
}

export interface PluginContext {
  /** Register a single action on the Action Bus */
  registerAction: typeof registerAction;
  /** Register multiple actions on the Action Bus */
  registerActions: typeof registerActions;
  /** Look up an existing action by ID */
  getAction: typeof getAction;
  /** List all registered actions */
  getAllActions: typeof getAllActions;
  /** List actions for a specific entity */
  getActionsForEntity: typeof getActionsForEntity;
  /** Subscribe to domain events */
  subscribe: typeof subscribe;
  /** Check if a licensed feature is enabled */
  isFeatureEnabled: typeof isFeatureEnabled;
  /** Look up a registered entity definition */
  getEntity: typeof getEntity;
  /** Get all registered entity definitions */
  getAllEntities: typeof getAllEntities;
  /** Get the Drizzle database instance */
  getDatabase: typeof getDatabase;
  /** Register a Fastify route handler (called later when the server is available) */
  registerRoutes: (handler: (fastify: FastifyInstance) => Promise<void>) => void;
  /** Structured logger scoped to this plugin */
  logger: ReturnType<typeof createLogger>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Registered plugins (name → plugin) */
const plugins = new Map<string, MetaSAASPlugin>();

/** Collected route registrars from plugins — applied after Fastify starts */
const routeRegistrars: Array<(fastify: FastifyInstance) => Promise<void>> = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize plugins during bootstrap.
 * Checks feature requirements, calls register(), collects route handlers.
 *
 * Errors in individual plugins are caught and logged — they never
 * prevent other plugins or the platform from starting.
 */
export async function initPlugins(
  pluginList: MetaSAASPlugin[]
): Promise<void> {
  for (const plugin of pluginList) {
    const logger = createLogger(plugin.name);

    try {
      // Check feature requirements before attempting registration
      if (plugin.requires?.length) {
        const missing = plugin.requires.filter((f) => !isFeatureEnabled(f as Feature));
        if (missing.length > 0) {
          logger.warn(
            `Plugin "${plugin.name}" skipped — missing features: ${missing.join(", ")}`
          );
          continue;
        }
      }

      // Build the plugin context
      const pluginRoutes: Array<(fastify: FastifyInstance) => Promise<void>> = [];

      const ctx: PluginContext = {
        registerAction,
        registerActions,
        getAction,
        getAllActions,
        getActionsForEntity,
        subscribe,
        isFeatureEnabled,
        getEntity,
        getAllEntities,
        getDatabase,
        registerRoutes: async (fn) => {
          pluginRoutes.push(fn);
        },
        logger,
      };

      await plugin.register(ctx);

      // Store plugin and collect routes
      plugins.set(plugin.name, plugin);
      routeRegistrars.push(...pluginRoutes);

      logger.info(
        `Plugin "${plugin.name}" v${plugin.version} registered`
      );
    } catch (err) {
      // Never let a plugin crash the platform
      logger.error(
        `Plugin "${plugin.name}" failed to register: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (plugins.size > 0) {
    console.log(
      `[plugins] Initialized ${plugins.size} plugin(s): ${[...plugins.keys()].join(", ")}`
    );
  }
}

/**
 * Register collected plugin routes on the Fastify instance.
 * Called after initPlugins() once the server is available.
 */
export async function registerPluginRoutes(
  fastify: FastifyInstance
): Promise<void> {
  for (const registrar of routeRegistrars) {
    await registrar(fastify);
  }
}

/** Get a registered plugin by name */
export function getPlugin(name: string): MetaSAASPlugin | undefined {
  return plugins.get(name);
}

/** Get all registered plugins */
export function getRegisteredPlugins(): MetaSAASPlugin[] {
  return [...plugins.values()];
}

/** Reset all plugin state (for testing) */
export function resetPlugins(): void {
  plugins.clear();
  routeRegistrars.length = 0;
}
