/**
 * AI Command Interpreter
 *
 * Translates natural language into Action Bus dispatches.
 * This is the "natural language adapter" — like the REST adapter maps
 * HTTP verbs to actions, this maps human language to actions.
 *
 * Flow:
 *   1. Receive natural language text from the user
 *   2. Send available actions (with descriptions + examples) to AI
 *   3. AI returns { actionId, input } — the intent mapping
 *   4. Dispatch through the normal Action Bus pipeline
 *   5. Return the result
 *
 * Security:
 *   The AI only maps intent — it NEVER executes anything directly.
 *   The Action Bus enforces ALL rules (validation, permissions, workflow).
 *   A natural language command has exactly the same security as a button click.
 *
 * Design:
 *   - No domain knowledge — works with any registered action
 *   - Fail-safe — AI interpretation errors return helpful messages, never crash
 *   - Observable — all dispatches flow through the Action Bus (logged, metered)
 */

import type { Caller } from "@metasaas/contracts";
import { getAllActions } from "../core/action-bus/registry.js";
import { dispatch, type ActionResult } from "../core/action-bus/bus.js";
import { getAIProvider } from "./gateway.js";
import { generateEntities, entityToTypeScript, writeEntitiesToDisk, evolveEntity } from "./entity-generator.js";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The result of interpreting and executing a natural language command.
 */
export interface CommandResult {
  /** Whether the command was successfully interpreted and dispatched */
  success: boolean;

  /** The action that was dispatched (if matched) */
  actionId?: string;

  /** The AI's plain-English interpretation of the user's intent */
  interpretation?: string;

  /** The Action Bus result (if an action was dispatched) */
  data?: unknown;

  /** Error message if interpretation or execution failed */
  error?: string;
}

/**
 * The JSON shape the AI must return when interpreting a command.
 * Kept minimal — the AI only decides WHAT action and WITH WHAT input.
 */
interface AICommandMapping {
  /** The action ID to dispatch (empty string if no match) */
  actionId: string;

  /** The input to pass to the action */
  input: Record<string, unknown>;

  /** Brief explanation of the interpretation */
  explanation: string;
}

// ---------------------------------------------------------------------------
// Prompt Construction
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt that teaches the AI about all available actions.
 * Includes action IDs, descriptions, and natural language examples when available.
 *
 * The prompt is designed to be unambiguous:
 *   - The AI MUST choose from the listed actions (no invention)
 *   - The AI MUST return valid JSON (no markdown, no explanation)
 *   - The AI MUST include an explanation field (for user feedback)
 */
function buildSystemPrompt(
  actions: {
    id: string;
    name: string;
    description: string;
    examples?: { description: string; input: Record<string, unknown>; naturalLanguage?: string }[];
  }[]
): string {
  const actionList = actions
    .map((a) => {
      const lines = [`- ${a.id}: ${a.description}`];

      if (a.examples?.length) {
        for (const ex of a.examples) {
          if (ex.naturalLanguage) {
            lines.push(
              `  Example: "${ex.naturalLanguage}" → ${JSON.stringify(ex.input)}`
            );
          }
        }
      }

      return lines.join("\n");
    })
    .join("\n");

  return [
    "You are a friendly AI assistant for a business application.",
    "The user will ask you to do things in natural language.",
    "Your job is to map their request to one of the available actions.",
    "",
    "Available actions:",
    actionList,
    "",
    "Respond with ONLY valid JSON in this exact format:",
    "{",
    '  "actionId": "the.action.id",',
    '  "input": { ... },',
    '  "explanation": "A friendly, conversational response in plain English"',
    "}",
    "",
    "CRITICAL RULES FOR THE EXPLANATION FIELD:",
    '- Write the explanation as if you are talking to the user directly.',
    '- Use natural, friendly language. Example: "Sure! I\'ll fetch all your companies for you."',
    '- For list actions: "Here are your companies" or "Let me look that up for you."',
    '- For create actions: "Got it! Creating a new task called \'Fix login bug\' with high priority."',
    '- For delete actions: "Done! I\'ve removed that record."',
    '- NEVER mention action IDs, function names, or technical terms like findAll, dispatch, etc.',
    '- NEVER say things like "Using company.findAll" or "Dispatching task.create".',
    '- Keep it SHORT — one or two sentences maximum.',
    "",
    "If the request does not match any action, respond with:",
    "{",
    '  "actionId": "",',
    '  "input": {},',
    '  "explanation": "I\'m not sure how to help with that. I can help you manage companies, contacts, projects, tasks, warehouses, and products. What would you like to do?"',
    "}",
    "",
    "Technical rules:",
    "- ONLY use actions from the list above — never invent action IDs",
    "- ONLY return JSON — no markdown, no extra text",
    "- For create actions, use EXACTLY the field names shown in the action description — never guess or invent field names",
    "- For update actions, provide { id: <uuid>, data: { ...fields } }",
    "- For delete actions, provide { id: <uuid> }",
    "- For list/findAll actions, use { where: { field: value } } for filters, or {} for all records",
    "- If the user mentions an entity by name, use the lowercase entity prefix",
    "",
    "SPECIAL ACTION — Domain Generation:",
    "- If the user describes a NEW business domain they want to build (e.g., 'I want to build a restaurant booking system'),",
    "  use actionId: 'domain.generate' with input: { description: 'the full domain description' }",
    "- domain.generate is for creating NEW entity types, NOT for creating records of existing entities",
    "- Examples: 'Build me a gym management app', 'I need a hotel booking system', 'Create a library management domain'",
    "",
    "SPECIAL ACTION — Entity Modification:",
    "- If the user wants to MODIFY an existing entity (add/remove/change fields, update workflows, etc.),",
    "  use actionId: 'domain.modify' with input: { entityName: 'PascalCaseName', modification: 'description of what to change' }",
    "- domain.modify is for changing existing entity definitions, NOT for creating new ones",
    "- Examples: 'Add a dueDate field to Task', 'Remove phone from Contact', 'Change Task status options to include blocked'",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Command Interpreter
// ---------------------------------------------------------------------------

/**
 * A single message in the conversation history.
 * Sent by the frontend so the AI has multi-turn context.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Interprets a natural language command and dispatches it via the Action Bus.
 *
 * @param text    - The user's natural language input
 * @param caller  - The authenticated caller (permissions are enforced by the bus)
 * @param history - Previous conversation messages for multi-turn context (optional)
 * @returns CommandResult with interpretation, action result, or error
 */
export async function interpretCommand(
  text: string,
  caller: Caller,
  history?: ChatMessage[]
): Promise<CommandResult> {
  const provider = getAIProvider();

  // Guard: AI must be configured for command interpretation
  if (provider.name === "null") {
    return {
      success: false,
      error:
        "AI is not configured. Set an AI provider API key to use natural language commands.",
    };
  }

  // Guard: reject empty input
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      error: "Please enter a command.",
    };
  }

  try {
    // 1. Collect all registered actions (safe metadata only, no execute functions)
    const actions = getAllActions().map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      examples: a.examples,
    }));

    if (actions.length === 0) {
      return {
        success: false,
        error: "No actions are registered in the system.",
      };
    }

    // 2. Build messages with conversation history for multi-turn context
    const systemPrompt = buildSystemPrompt(actions);
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system" as const, content: systemPrompt },
    ];

    // Include recent conversation history (last 10 messages max) for context
    if (history?.length) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add the current user message
    messages.push({ role: "user" as const, content: trimmed });

    const raw = await provider.complete(messages, {
      responseFormat: "json",
      temperature: 0,
      maxTokens: 500,
    });

    // 3. Parse the AI's response
    let mapping: AICommandMapping;
    try {
      mapping = JSON.parse(raw) as AICommandMapping;
    } catch {
      return {
        success: false,
        error: "Failed to parse AI response. Please try rephrasing your command.",
      };
    }

    // 4. If the AI couldn't match an action, return the explanation
    if (!mapping.actionId) {
      return {
        success: false,
        interpretation: mapping.explanation,
        error: mapping.explanation || "Could not understand the command.",
      };
    }

    // 5a. Special handling for domain generation — calls entity generator
    //     directly since it's a platform capability, not a registered action.
    if (mapping.actionId === "domain.generate") {
      const input = mapping.input as { description?: string };
      const genResult = await generateEntities(input.description ?? trimmed);

      if (!genResult.success) {
        return {
          success: false,
          actionId: "domain.generate",
          interpretation: mapping.explanation,
          error: genResult.error,
        };
      }

      // Build a human-readable response with the generated entity code
      const entitySummaries = genResult.entities.map((e) => {
        const fieldCount = e.fields.length;
        const relCount = e.relationships?.length ?? 0;
        const wfCount = e.workflows?.length ?? 0;
        return `**${e.name}** (${e.pluralName}) — ${fieldCount} fields${relCount ? `, ${relCount} relationship${relCount > 1 ? "s" : ""}` : ""}${wfCount ? `, ${wfCount} workflow${wfCount > 1 ? "s" : ""}` : ""}`;
      });

      // Generate the TypeScript code for each entity
      const codeBlocks = genResult.entities.map(
        (e) => `--- ${e.name.toLowerCase()}.entity.ts ---\n${entityToTypeScript(e)}`
      );

      // Write generated entities to disk (domain package).
      // Uses process.cwd() which resolves to the API server's root,
      // then navigates to the domain package relative to the monorepo.
      let writeResult: { success: boolean; filesCreated: string[]; indexUpdated: boolean; error?: string } | null = null;
      try {
        const monorepoRoot = resolve(process.cwd(), "../..");
        const domainEntitiesDir = resolve(monorepoRoot, "packages/domain/src/entities");
        const domainIndexPath = resolve(monorepoRoot, "packages/domain/src/index.ts");
        writeResult = writeEntitiesToDisk(genResult.entities, domainEntitiesDir, domainIndexPath, genResult.seedData);
      } catch {
        // Disk writing is best-effort; the generated code is still returned
      }

      return {
        success: true,
        actionId: "domain.generate",
        interpretation: mapping.explanation,
        data: {
          summary: genResult.summary,
          entities: entitySummaries,
          entityCount: genResult.entities.length,
          code: codeBlocks.join("\n\n"),
          raw: genResult.entities,
          written: writeResult?.success
            ? { filesCreated: writeResult.filesCreated, indexUpdated: writeResult.indexUpdated }
            : null,
          writeError: writeResult?.error ?? null,
          restartRequired: writeResult?.success
            ? "Entity files written to disk. Restart the dev server (pnpm dev) to activate them."
            : null,
        },
      };
    }

    // 5b. Special handling for entity modification — evolves existing entity definitions.
    if (mapping.actionId === "domain.modify") {
      const input = mapping.input as { entityName?: string; modification?: string };
      if (!input.entityName || !input.modification) {
        return {
          success: false,
          actionId: "domain.modify",
          interpretation: mapping.explanation,
          error: "Please specify which entity to modify and what changes to make.",
        };
      }

      const monorepoRoot = resolve(process.cwd(), "../..");
      const domainEntitiesDir = resolve(monorepoRoot, "packages/domain/src/entities");

      const result = await evolveEntity(input.entityName, input.modification, domainEntitiesDir);

      return {
        success: result.success,
        actionId: "domain.modify",
        interpretation: mapping.explanation,
        data: result.success
          ? {
              entityName: result.entityName,
              changes: result.changes,
              restartRequired: "Entity file updated on disk. Restart the dev server (pnpm dev) to activate changes.",
            }
          : undefined,
        error: result.error,
      };
    }

    // 5c. Dispatch through the Action Bus — same pipeline as REST or UI
    const result = await dispatch(mapping.actionId, mapping.input, caller);

    return {
      success: result.success,
      actionId: mapping.actionId,
      interpretation: mapping.explanation,
      data: result.success ? result.data : undefined,
      error: result.success ? undefined : result.error,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while processing the command.",
    };
  }
}
