/**
 * @metasaas/contracts
 *
 * Public API — the shared boundary between platform and domain.
 * Both sides import from this package. Neither imports from the other.
 */

// Entity definitions
export type {
  EntityDefinition,
  EntityHooks,
  FieldDefinition,
  FieldValidation,
  EntityUIConfig,
  SortConfig,
  ConstraintDefinition,
} from "./entity.js";
export { defineEntity } from "./entity.js";

// Field types
export type { FieldType } from "./field-types.js";
export { FIELD_TYPES, zodSchemaForFieldType } from "./field-types.js";

// Relationships
export type {
  RelationshipDefinition,
  RelationshipType,
} from "./relationship.js";

// Actions
export type {
  ActionDefinition,
  ActionExample,
  SideEffect,
} from "./action.js";
export { defineAction } from "./action.js";

// Context (provided by platform to actions)
export type {
  ActionContext,
  Caller,
  Logger,
  DomainEvent,
  DatabaseClient,
  EventSubscriber,
} from "./context.js";

// Permissions
export type { PermissionRule, CallerType } from "./permission.js";
export { ALLOW_ALL } from "./permission.js";

// Workflows
export type {
  SimpleWorkflowDefinition,
  WorkflowTransition,
} from "./workflow.js";

// AI capabilities (stub for v0)
export type {
  AICapabilityDefinition,
  AICapabilityType,
  AITrigger,
  AIModelPreference,
} from "./ai-capability.js";
export { defineAICapability } from "./ai-capability.js";

// Authentication
export type { AuthProvider, AuthResult } from "./auth.js";

// Navigation
export type { NavigationItem } from "./navigation.js";
