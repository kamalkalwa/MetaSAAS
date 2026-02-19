/**
 * AI Capability Definition (Stub for v0)
 *
 * Declares what AI capabilities an entity needs.
 * In v0 this is a type definition only — the AI Gateway is not implemented yet.
 * This stub ensures domain entities can declare AI capabilities now,
 * and the platform will activate them when the AI layer ships in v1.
 */

import { z } from "zod";

/** Types of AI capabilities */
export type AICapabilityType =
  | "enrichment"
  | "suggestion"
  | "analysis"
  | "generation"
  | "classification"
  | "extraction";

/** When the AI capability triggers */
export type AITrigger = "on_demand" | "on_create" | "on_update" | "on_schedule";

/** Model preference for routing */
export type AIModelPreference = "fast" | "balanced" | "quality";

/**
 * Declares a single AI capability on an entity.
 * The domain says WHAT it needs. The platform decides HOW (in v1+).
 */
export interface AICapabilityDefinition {
  /** Unique identifier. Convention: "entity.capability" (e.g., "contact.enrich") */
  id: string;

  /** What kind of AI work this is */
  type: AICapabilityType;

  /**
   * Plain English intent. This is the most important field.
   * The platform uses this to construct prompts.
   * Write it as a clear instruction to a smart assistant.
   */
  intent: string;

  /** What data the AI needs as context */
  input: {
    /** Entity fields or related data paths to include (supports dot notation) */
    contextFields: string[];
    /** Additional structured input schema (for on-demand capabilities) */
    schema?: z.ZodType;
  };

  /** What the AI produces */
  output: {
    /** Structured output schema — AI response is parsed into this */
    schema: z.ZodType;
    /**
     * What to return when AI is unavailable or fails.
     * REQUIRED — every capability must degrade gracefully.
     */
    fallback: unknown;
  };

  /** When this capability triggers */
  trigger: AITrigger;

  /** Routing preferences */
  preferences?: {
    quality: AIModelPreference;
    cacheTTL?: number;
    requireLocal?: boolean;
    maxCostPerCall?: number;
  };
}

/**
 * Helper function to define an AI capability with type checking.
 * Use this in domain entity AI files.
 */
export function defineAICapability(
  definition: AICapabilityDefinition
): AICapabilityDefinition {
  return definition;
}
