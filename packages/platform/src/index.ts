/**
 * @metasaas/platform
 *
 * The platform engine. Provides the Action Bus, database layer,
 * entity management, and protocol adapters.
 */

// Config
export { loadConfig, type AppConfig } from "./core/config/index.js";

// Database
export { initDatabase, getDatabase, closeDatabase } from "./core/database/connection.js";
export { buildTableSchema, getTableSchema, getAllTableSchemas, toTableName, toColumnName, fromColumnName, clearTableRegistry } from "./core/database/schema-builder.js";
export { createDatabaseClient } from "./core/database/client.js";
export { runMigrations, runPlatformMigrations } from "./core/database/migrate.js";

// Action Bus
export { dispatch, type ActionResult, type ActionErrorType } from "./core/action-bus/bus.js";
export { registerAction, registerActions, getAction, getAllActions, getActionsForEntity } from "./core/action-bus/registry.js";
export { ValidationError } from "./core/action-bus/middleware/validation.js";
export { PermissionError } from "./core/action-bus/middleware/permission.js";
export { WorkflowError, validateWorkflowTransitions, type WorkflowTransitionResult } from "./core/action-bus/middleware/workflow.js";
export { createLogger } from "./core/action-bus/middleware/logging.js";

// Event Bus
export { subscribe, subscribeAll, publish, getSubscriberCount, clearSubscribers } from "./core/event-bus/index.js";

// Entity Manager
export { registerEntity, registerEntities, getEntity, getEntityByPlural, getAllEntities } from "./core/entity-manager/entity-registry.js";
export { generateCRUDActions } from "./core/entity-manager/crud-generator.js";

// Authentication
export { initAuthProvider, getAuthProvider, setAuthProvider } from "./auth/index.js";
export { SupabaseAuthProvider, createSupabaseAuthProvider } from "./auth/supabase-provider.js";
export { DevAuthProvider, DEV_TENANT_ID } from "./auth/dev-provider.js";

// AI Gateway
export {
  initAIGateway,
  getAIProvider,
  setAIProvider,
  registerAICapability,
  wireAITrigger,
  registerEntityAICapabilities,
  NullAIProvider,
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  type AIProvider,
  type AIMessage,
  type AIRequestOptions,
} from "./ai/index.js";

// AI Command Interpreter
export { interpretCommand, type CommandResult, type ChatMessage } from "./ai/index.js";

// AI Entity Generator
export {
  generateEntities,
  entityToTypeScript,
  writeEntitiesToDisk,
  type GeneratedEntity,
  type GenerationResult,
  type WriteResult,
} from "./ai/index.js";

// Audit Logging
export { writeAuditLog } from "./core/audit/index.js";

// Webhooks
export {
  initWebhooks,
  registerWebhook,
  removeWebhook,
  listWebhooks,
  getDeliveryLog,
  type WebhookRegistration,
  type WebhookDelivery,
} from "./core/webhooks/index.js";

// Chat Persistence
export {
  createSession,
  getSession,
  listSessions,
  updateSessionTitle,
  deleteSession,
  createMessage,
  listMessages,
  type ChatSession,
  type ChatMessageRecord,
} from "./ai/index.js";

// Adapters
export { registerRESTRoutes } from "./adapters/rest/adapter.js";
export { authMiddleware } from "./adapters/rest/auth-middleware.js";
