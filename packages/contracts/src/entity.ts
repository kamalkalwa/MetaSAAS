/**
 * Entity Definition
 *
 * An Entity is a business object that the application manages.
 * Entities are the nouns of your business: Contact, Deal, Task, Product.
 *
 * The platform uses entity definitions to:
 *   - Generate database tables and migrations
 *   - Create standard CRUD actions automatically
 *   - Render list views, detail views, and forms
 *   - Build search indexes
 *   - Expose capabilities to AI agents
 */

import type { FieldType } from "./field-types.js";
import type { RelationshipDefinition } from "./relationship.js";
import type { SimpleWorkflowDefinition } from "./workflow.js";
import type { ActionContext } from "./context.js";
import type { AICapabilityDefinition } from "./ai-capability.js";

// ---------------------------------------------------------------------------
// Field Definition
// ---------------------------------------------------------------------------

/** Validation rules that can be applied to a field */
export interface FieldValidation {
  /** Minimum value (for numbers) or minimum length (for strings) */
  min?: number;
  /** Maximum value (for numbers) or maximum length (for strings) */
  max?: number;
  /** Regex pattern the value must match */
  pattern?: string;
  /** Custom error message when validation fails */
  message?: string;
}

/**
 * Defines a single field on an entity.
 * Fields map to database columns, form inputs, and table cells.
 */
export interface FieldDefinition {
  /** Column/property name. Use camelCase. (e.g., "firstName") */
  name: string;

  /** The data type of this field. Determines DB column, UI input, and validation. */
  type: FieldType;

  /** Whether this field must have a value. Affects DB NOT NULL and form validation. */
  required: boolean;

  /**
   * Plain English description. Used by:
   *   - AI agents to understand the field
   *   - Form labels and placeholders
   *   - API documentation
   */
  description: string;

  /** Default value when creating a new record */
  defaultValue?: unknown;

  /** For 'enum' type: the list of allowed values */
  options?: string[];

  /** Validation rules beyond type checking */
  validations?: FieldValidation[];

  /**
   * Whether this field contains PII or sensitive data.
   * Sensitive fields are encrypted at rest and excluded from AI context.
   */
  sensitive?: boolean;
}

// ---------------------------------------------------------------------------
// UI Configuration
// ---------------------------------------------------------------------------

/** Sort direction for default list ordering */
export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Hints for the platform's UI layer.
 * These are SEMANTIC descriptions — the platform interprets them
 * per rendering context (web table, mobile card, etc.).
 */
export interface EntityUIConfig {
  /** Icon name from the icon library (e.g., "users", "building", "package") */
  icon: string;

  /** Field names to display as columns in the list view (3-5 recommended) */
  listColumns: string[];

  /** Field names that are searchable via the quick-search bar */
  searchFields: string[];

  /** Default sort order for list view */
  defaultSort: SortConfig;

  /** Default view type. Defaults to 'list'. */
  defaultView?: "list" | "kanban" | "calendar";

  /** Kanban configuration (required when defaultView is 'kanban') */
  kanban?: { groupBy: string };

  /** Calendar configuration (required when defaultView is 'calendar') */
  calendar?: { dateField: string };

  /** Whether changes to this entity should broadcast in real-time */
  realtime?: boolean;

  /** Self-referential hierarchy config (e.g., subtasks, categories) */
  hierarchical?: { parentField: string };
}

// ---------------------------------------------------------------------------
// Entity Definition
// ---------------------------------------------------------------------------

/**
 * The complete definition of a business entity.
 * This is the primary interface that domain code uses to declare
 * what business objects exist and how they behave.
 */
export interface EntityDefinition {
  /** Singular name, PascalCase. (e.g., "Contact") */
  name: string;

  /** Plural name. (e.g., "Contacts") */
  pluralName: string;

  /**
   * Plain English description of what this entity represents.
   * Write as if explaining to someone unfamiliar with the business.
   * AI agents and documentation generators use this.
   */
  description: string;

  /** The fields this entity has */
  fields: FieldDefinition[];

  /** How this entity relates to other entities */
  relationships?: RelationshipDefinition[];

  /** Database-level constraints (e.g., composite unique keys) */
  constraints?: ConstraintDefinition[];

  /**
   * State machine workflow definitions.
   * When present, the platform validates status transitions on update actions.
   * Only transitions declared in the workflow are allowed.
   */
  workflows?: SimpleWorkflowDefinition[];

  /**
   * Layer 3 escape hatches: custom logic hooks for CRUD operations.
   * These run inside the Action Bus pipeline — after validation and
   * permission checks, before/after the actual database operation.
   *
   * Use hooks when declarative entity definitions (Layer 1) and
   * platform primitives (Layer 2) aren't enough for your use case.
   */
  hooks?: EntityHooks;

  /**
   * AI capabilities this entity declares.
   * Each capability becomes a registered Action that the AI Gateway executes.
   * Capabilities with triggers (on_create, on_update) auto-fire via EventBus.
   */
  aiCapabilities?: AICapabilityDefinition[];

  /** UI rendering hints */
  ui: EntityUIConfig;
}

/**
 * Custom hooks for entity CRUD operations.
 * Each hook receives typed input and the ActionContext.
 *
 * "before" hooks can transform input or throw to abort.
 * "after" hooks can transform the result or trigger side effects.
 */
export interface EntityHooks {
  /** Runs before a create action. Can modify input or throw to abort. */
  beforeCreate?: (input: Record<string, unknown>, ctx: ActionContext) => Promise<Record<string, unknown>>;
  /** Runs after a create action. Can modify result or trigger side effects. */
  afterCreate?: (result: Record<string, unknown>, input: Record<string, unknown>, ctx: ActionContext) => Promise<Record<string, unknown>>;
  /** Runs before an update action. Can modify input or throw to abort. */
  beforeUpdate?: (input: { id: string; data: Record<string, unknown> }, ctx: ActionContext) => Promise<{ id: string; data: Record<string, unknown> }>;
  /** Runs after an update action. Can modify result or trigger side effects. */
  afterUpdate?: (result: Record<string, unknown>, input: { id: string; data: Record<string, unknown> }, ctx: ActionContext) => Promise<Record<string, unknown>>;
  /** Runs before a delete action. Can throw to abort. */
  beforeDelete?: (input: { id: string }, ctx: ActionContext) => Promise<{ id: string }>;
}

/**
 * Database constraint that spans multiple fields.
 * Single-field constraints (required, unique) are on the FieldDefinition.
 */
export interface ConstraintDefinition {
  type: "unique" | "check";
  fields: string[];
  /** For 'check' constraints: the SQL expression */
  expression?: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Helper function to define an entity with type checking.
 * Use this in domain entity files for autocomplete and validation.
 *
 * @example
 * export const ContactEntity = defineEntity({
 *   name: 'Contact',
 *   pluralName: 'Contacts',
 *   description: 'A person the business has a relationship with.',
 *   fields: [...],
 *   ui: { ... },
 * });
 */
export function defineEntity(definition: EntityDefinition): EntityDefinition {
  return definition;
}
