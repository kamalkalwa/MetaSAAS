/**
 * Action Definition
 *
 * An Action is a single, well-defined operation the application can perform.
 * Actions are the UNIVERSAL interface — the UI triggers them via clicks,
 * AI agents trigger them via natural language, APIs trigger them via HTTP.
 *
 * Every Action is:
 *   - Typed (input and output are validated with Zod)
 *   - Described (AI agents can discover and understand it)
 *   - Permissioned (the platform enforces who can execute it)
 *   - Observable (the platform logs, meters, and traces it)
 */

import { z } from "zod";
import type { ActionContext, DomainEvent } from "./context.js";
import type { PermissionRule } from "./permission.js";

// ---------------------------------------------------------------------------
// Side Effects
// ---------------------------------------------------------------------------

/**
 * A side effect that occurs after an action succeeds.
 * Side effects are handled by the platform (notifications, webhooks, etc.).
 */
export interface SideEffect {
  /** Type of side effect */
  type: "emit_event" | "notify" | "webhook";

  /** Configuration for the side effect */
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Action Examples
// ---------------------------------------------------------------------------

/**
 * Example of how an action is used.
 * AI agents use these for few-shot learning.
 * Also serves as living documentation.
 */
export interface ActionExample {
  /** What this example demonstrates (e.g., "Create a basic contact") */
  description: string;

  /** Example input data */
  input: Record<string, unknown>;

  /** Natural language equivalent (for AI agent training) */
  naturalLanguage?: string;
}

// ---------------------------------------------------------------------------
// Action Definition
// ---------------------------------------------------------------------------

/**
 * The complete definition of an action.
 * This is the atomic unit of the MetaSAAS architecture.
 */
export interface ActionDefinition<
  TInput = unknown,
  TOutput = unknown,
> {
  /**
   * Unique identifier.
   * Convention: "entity.verb" (e.g., "contact.create", "deal.updateStage")
   */
  id: string;

  /** Human-readable name (e.g., "Create Contact") */
  name: string;

  /**
   * Plain English description of what this action does.
   * AI agents read this to decide whether to call it.
   * Write it as if explaining to a new team member.
   */
  description: string;

  /** Zod schema for input validation. Also used to generate forms and API docs. */
  inputSchema: z.ZodType<TInput>;

  /** Zod schema for output. Used for type safety and AI response parsing. */
  outputSchema: z.ZodType<TOutput>;

  /** Who can execute this action. Platform enforces these rules. */
  permissions: PermissionRule[];

  /**
   * Is this action safe to retry?
   * true = calling it twice with same input produces the same result.
   * Platform uses this for retry logic and caching.
   */
  idempotent: boolean;

  /** Can this action accept an array of inputs for batch execution? */
  batch?: boolean;

  /** Which entities this action modifies (for cache invalidation and audit) */
  affectsEntities?: string[];

  /** Side effects triggered after successful execution */
  sideEffects?: SideEffect[];

  /**
   * Examples of how this action is used.
   * AI agents use these for few-shot learning.
   */
  examples?: ActionExample[];

  /** The business logic. Pure function. No HTTP, no UI, no framework. */
  execute: (input: TInput, context: ActionContext) => Promise<TOutput>;

  /**
   * Layer 3 Hook: runs BEFORE execute().
   * Can transform the input or throw to abort the action.
   * Use cases: input enrichment, custom validation, rate limiting.
   */
  beforeExecute?: (input: TInput, context: ActionContext) => Promise<TInput>;

  /**
   * Layer 3 Hook: runs AFTER execute().
   * Can transform the result or trigger side effects.
   * Use cases: response enrichment, notifications, cache invalidation.
   */
  afterExecute?: (result: TOutput, input: TInput, context: ActionContext) => Promise<TOutput>;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Helper function to define an action with type checking.
 * Use this in domain action files for autocomplete and validation.
 */
export function defineAction<TInput, TOutput>(
  definition: ActionDefinition<TInput, TOutput>
): ActionDefinition<TInput, TOutput> {
  return definition;
}
