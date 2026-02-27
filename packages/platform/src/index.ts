/**
 * @metasaas/platform
 *
 * The platform engine. Provides the Action Bus, database layer,
 * entity management, and protocol adapters.
 */

// Config
export { loadConfig, type AppConfig } from "./core/config/index.js";

// Licensing
export {
  initLicensing,
  isFeatureEnabled,
  requireFeature,
  getEnabledFeatures,
  getLicenseInfo,
  resetLicensing,
  setEnabledFeatures,
  FeatureLockedError,
  FEATURES,
  FREE_FEATURES,
  PRO_FEATURES,
  type Feature,
  type LicensePayload,
} from "./core/licensing/index.js";

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

// Entity Installer (runtime hot-install)
export {
  installEntity,
  installEntities,
  type InstallResult,
} from "./ai/index.js";

// Email
export {
  initEmail,
  sendEmail,
  getEmailProvider,
  setEmailProvider,
  registerEmailTrigger,
  resetEmail,
  ConsoleEmailProvider,
  ResendEmailProvider,
  type EmailProvider,
  type SendEmailOptions,
  type SendResult,
  type EmailTrigger,
} from "./core/email/index.js";

// File Storage
export {
  initStorage,
  uploadFile,
  getFileUrl,
  deleteFile,
  fileExists,
  getStorageProvider,
  setStorageProvider,
  resetStorage,
  LocalStorageProvider,
  S3StorageProvider,
  type StorageProvider,
  type UploadOptions,
  type UploadResult,
} from "./core/storage/index.js";

// Audit Logging
export { writeAuditLog, queryAuditLog, type AuditLogQuery, type AuditLogEntry, type AuditLogResult } from "./core/audit/index.js";

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

// Notifications
export {
  initNotifications,
  sendNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationProvider,
  setNotificationProvider,
  resetNotifications,
  ConsoleNotificationProvider,
  InAppNotificationProvider,
  type NotificationProvider,
  type Notification,
  type NotificationInput,
  type NotificationType,
  type NotificationListOptions,
  type NotificationListResult,
} from "./core/notifications/index.js";
export { notificationPlugin } from "./core/notifications/notification-plugin.js";

// Billing
export {
  initBilling,
  getBillingProvider,
  setBillingProvider,
  resetBilling,
  ConsoleBillingProvider,
  StripeBillingProvider,
  type BillingProvider,
  type Subscription,
  type Invoice,
  type CheckoutParams,
  type CheckoutResult,
  type PortalParams,
  type WebhookResult,
} from "./core/billing/index.js";
export { billingPlugin } from "./core/billing/billing-plugin.js";
export {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  seedDefaultPlans,
  type Plan,
  type CreatePlanInput,
  type UpdatePlanInput,
} from "./core/billing/plans.js";

// Observability
export {
  initObservability,
  captureException,
  captureMessage,
  setObservabilityContext,
  flushObservability,
  getObservabilityProvider,
  setObservabilityProvider,
  resetObservability,
  ConsoleObservabilityProvider,
  SentryObservabilityProvider,
  type ObservabilityProvider,
  type ObservabilityContext,
  type ObservabilitySeverity,
} from "./core/observability/index.js";

// Plugins
export {
  initPlugins,
  registerPluginRoutes,
  getPlugin,
  getRegisteredPlugins,
  resetPlugins,
  type MetaSAASPlugin,
  type PluginContext,
} from "./core/plugins/index.js";

// Adapters
export { registerRESTRoutes } from "./adapters/rest/adapter.js";
export { authMiddleware } from "./adapters/rest/auth-middleware.js";
