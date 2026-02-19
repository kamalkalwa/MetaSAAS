/**
 * AI Gateway
 *
 * The bridge between AICapabilityDefinitions (declared in domain entities)
 * and the Action Bus. Each AI capability becomes a registered Action that:
 *
 *   1. Assembles a prompt from the entity context + capability intent
 *   2. Calls the AI provider
 *   3. Parses the response with the capability's Zod output schema
 *   4. Falls back to the declared fallback on any failure
 *
 * The gateway also wires auto-triggers (on_create, on_update) as
 * EventBus subscribers that dispatch the AI action when the relevant
 * domain event fires.
 *
 * Design principles:
 *   - No domain knowledge — works with any entity
 *   - Fail-safe — AI errors never break the application
 *   - Observable — all AI calls flow through the Action Bus (logged, permissioned)
 */

import type {
  AICapabilityDefinition,
  ActionDefinition,
  EntityDefinition,
  ActionContext,
  EventSubscriber,
} from "@metasaas/contracts";
import type { AIProvider } from "./provider.js";
import { NullAIProvider } from "./provider.js";
import { OpenAIProvider } from "./openai-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { registerAction } from "../core/action-bus/registry.js";
import { subscribe } from "../core/event-bus/index.js";
import { dispatch } from "../core/action-bus/bus.js";
import { z } from "zod";

/** The singleton AI provider instance */
let provider: AIProvider = new NullAIProvider();

/** Supported provider names for the AI_PROVIDER env var */
type ProviderName = "gemini" | "openai" | "anthropic";

/**
 * Creates a provider by explicit name.
 * Throws if the required API key for the requested provider is missing.
 */
function createExplicitProvider(name: string): AIProvider {
  const providers: Record<ProviderName, () => AIProvider> = {
    gemini: () => {
      const key = process.env.GOOGLE_AI_API_KEY;
      if (!key) throw new Error("AI_PROVIDER=gemini but GOOGLE_AI_API_KEY is not set");
      return new GeminiProvider(key, process.env.GOOGLE_AI_MODEL ?? undefined);
    },
    openai: () => {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("AI_PROVIDER=openai but OPENAI_API_KEY is not set");
      return new OpenAIProvider(key, process.env.OPENAI_MODEL ?? undefined);
    },
    anthropic: () => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
      return new AnthropicProvider(key, process.env.ANTHROPIC_MODEL ?? undefined);
    },
  };

  const factory = providers[name as ProviderName];
  if (!factory) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Valid values: ${Object.keys(providers).join(", ")}`
    );
  }

  return factory();
}

/**
 * Auto-detects the AI provider by checking API keys in priority order:
 *   1. GOOGLE_AI_API_KEY  → Gemini (primary)
 *   2. OPENAI_API_KEY     → OpenAI
 *   3. ANTHROPIC_API_KEY  → Anthropic
 *   4. (none)             → NullAIProvider (graceful degradation)
 */
function autoDetectProvider(): AIProvider {
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    return new GeminiProvider(geminiKey, process.env.GOOGLE_AI_MODEL ?? undefined);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return new OpenAIProvider(openaiKey, process.env.OPENAI_MODEL ?? undefined);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return new AnthropicProvider(anthropicKey, process.env.ANTHROPIC_MODEL ?? undefined);
  }

  return new NullAIProvider();
}

/**
 * Initialize the AI Gateway.
 *
 * Provider selection:
 *   - If AI_PROVIDER is set explicitly, use that provider (fail fast if key is missing)
 *   - Otherwise, auto-detect by checking keys: Gemini → OpenAI → Anthropic → Null
 *
 * When no keys are configured, uses NullAIProvider — all AI capabilities
 * gracefully fall back to their declared fallback values.
 */
export function initAIGateway(): void {
  const explicit = process.env.AI_PROVIDER;

  if (explicit) {
    provider = createExplicitProvider(explicit);
    console.log(`[ai] Provider (explicit): ${provider.name}`);
  } else {
    provider = autoDetectProvider();
    if (provider.name === "null") {
      console.log("[ai] No AI API keys configured — capabilities will use fallbacks");
    } else {
      console.log(`[ai] Provider (auto-detected): ${provider.name}`);
    }
  }
}

/** Get the current AI provider (for testing) */
export function getAIProvider(): AIProvider {
  return provider;
}

/** Set the AI provider (for testing) */
export function setAIProvider(p: AIProvider): void {
  provider = p;
}

/**
 * Assembles the prompt messages for an AI capability.
 *
 * The system message establishes the AI's role and output format.
 * The user message provides the entity context data.
 */
function buildPrompt(
  capability: AICapabilityDefinition,
  entity: EntityDefinition,
  contextData: Record<string, unknown>
): { role: "system" | "user"; content: string }[] {
  // Derive expected output field names from the fallback object.
  // The fallback has the same shape as the output schema.
  const fallback = capability.output.fallback;
  const exampleOutput =
    fallback && typeof fallback === "object"
      ? JSON.stringify(fallback, null, 2)
      : '{ "result": "" }';

  const systemPrompt = [
    `You are an AI assistant for a ${entity.name} management system.`,
    `Your task: ${capability.intent}`,
    "",
    "Respond ONLY with valid JSON. Use EXACTLY this structure:",
    exampleOutput,
    "",
    "Replace the empty values with your generated content.",
    "Do not include any explanation, markdown, or extra text.",
  ].join("\n");

  const userPrompt = [
    `Entity: ${entity.name}`,
    `Context data:`,
    JSON.stringify(contextData, null, 2),
  ].join("\n");

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

/**
 * Extracts the context fields from a record based on the capability's input config.
 * Supports dot notation for nested paths (e.g., "company.name").
 */
function extractContext(
  record: Record<string, unknown>,
  contextFields: string[]
): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const field of contextFields) {
    const parts = field.split(".");
    let value: unknown = record;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    context[field] = value;
  }
  return context;
}

/**
 * Registers a single AI capability as an Action in the Action Bus.
 *
 * The generated action:
 *   - Accepts the entity record as input
 *   - Extracts context fields
 *   - Calls the AI provider
 *   - Parses output with the capability's Zod schema
 *   - Returns fallback on any error
 *
 * @param capability - The AI capability definition from the domain
 * @param entity - The entity this capability belongs to
 */
export function registerAICapability(
  capability: AICapabilityDefinition,
  entity: EntityDefinition
): void {
  const action: ActionDefinition = {
    id: capability.id,
    name: `AI: ${capability.intent.slice(0, 60)}`,
    description: `AI capability for ${entity.name}: ${capability.intent}`,
    idempotent: true,
    affectsEntities: [entity.name],
    inputSchema: capability.input.schema ?? z.record(z.unknown()),
    outputSchema: capability.output.schema,
    permissions: [
      {
        callerTypes: ["human", "system", "ai-agent"],
        effect: "allow" as const,
      },
    ],

    async execute(
      input: unknown,
      ctx: ActionContext
    ): Promise<unknown> {
      const record = input as Record<string, unknown>;

      try {
        // Extract context fields from the record
        const contextData = extractContext(record, capability.input.contextFields);

        // Build the prompt
        const messages = buildPrompt(capability, entity, contextData);

        // Call the AI provider
        const raw = await provider.complete(messages, {
          responseFormat: "json",
          temperature: 0,
          maxTokens: capability.preferences?.maxCostPerCall
            ? Math.min(1000, Math.floor(capability.preferences.maxCostPerCall * 10000))
            : 1000,
        });

        // Parse the AI response with the output schema
        const parsed = capability.output.schema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          ctx.logger.warn("AI response failed schema validation, using fallback", {
            capabilityId: capability.id,
            errors: parsed.error.flatten(),
          });
          return capability.output.fallback;
        }

        ctx.logger.info("AI capability executed successfully", {
          capabilityId: capability.id,
        });

        return parsed.data;
      } catch (error) {
        // AI errors NEVER break the application — always fall back
        ctx.logger.warn("AI capability failed, using fallback", {
          capabilityId: capability.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return capability.output.fallback;
      }
    },
  };

  registerAction(action);
  console.log(`[ai] Registered AI capability: ${capability.id}`);
}

/**
 * Wires auto-trigger subscribers for AI capabilities.
 *
 * For on_create: subscribes to "{entity}.created" events
 * For on_update: subscribes to "{entity}.updated" events
 *
 * The subscriber dispatches the AI action with the event payload as input,
 * then updates the entity record with the AI output fields.
 *
 * @param capability - The AI capability with a trigger
 * @param entity - The entity this capability belongs to
 */
export function wireAITrigger(
  capability: AICapabilityDefinition,
  entity: EntityDefinition
): void {
  const entityLower = entity.name.toLowerCase();

  /** Map trigger types to event names */
  const triggerEventMap: Record<string, string> = {
    on_create: `${entityLower}.created`,
    on_update: `${entityLower}.updated`,
  };

  const eventType = triggerEventMap[capability.trigger];
  if (!eventType) return; // on_demand and on_schedule don't auto-wire

  const subscriber: EventSubscriber = {
    name: `ai-trigger:${capability.id}`,
    eventType,
    async handler(event) {
      const payload = event.payload as Record<string, unknown>;
      const recordId = payload.id as string;
      const tenantId = payload.tenantId as string;

      if (!recordId || !tenantId) return;

      // Dispatch the AI action as a system caller
      const aiResult = await dispatch(capability.id, payload, {
        userId: "ai-gateway",
        tenantId,
        roles: ["system"],
        type: "system",
      });

      if (!aiResult.success || !aiResult.data) return;

      // Merge AI output back into the entity record
      const aiData = aiResult.data as Record<string, unknown>;
      if (Object.keys(aiData).length === 0) return;

      await dispatch(
        `${entityLower}.update`,
        { id: recordId, data: aiData },
        {
          userId: "ai-gateway",
          tenantId,
          roles: ["system"],
          type: "system",
        }
      );
    },
  };

  subscribe(subscriber);
  console.log(`[ai] Wired trigger: ${capability.id} → ${eventType}`);
}

/**
 * Registers all AI capabilities for an entity.
 * Called during bootstrap for each entity that declares capabilities.
 */
export function registerEntityAICapabilities(
  entity: EntityDefinition & { aiCapabilities?: AICapabilityDefinition[] }
): void {
  const capabilities = entity.aiCapabilities;
  if (!capabilities || capabilities.length === 0) return;

  for (const cap of capabilities) {
    registerAICapability(cap, entity);

    if (cap.trigger !== "on_demand") {
      wireAITrigger(cap, entity);
    }
  }
}
