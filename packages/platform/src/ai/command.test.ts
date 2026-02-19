/**
 * AI Command Interpreter — Test Suite
 *
 * Validates that natural language commands are correctly:
 *   1. Rejected when AI is not configured
 *   2. Rejected when input is empty
 *   3. Mapped to actions and dispatched through the Action Bus
 *   4. Handled gracefully when the AI can't match an action
 *   5. Handled gracefully when the AI returns invalid JSON
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { z } from "zod";
import { interpretCommand } from "./command.js";
import { setAIProvider } from "./gateway.js";
import { NullAIProvider } from "./provider.js";
import type { AIProvider } from "./provider.js";
import { registerAction, clearActionRegistry } from "../core/action-bus/registry.js";
import { clearSubscribers } from "../core/event-bus/index.js";
import type { Caller } from "@metasaas/contracts";

/** Standard test caller */
const TEST_CALLER: Caller = {
  userId: "test-user",
  tenantId: "test-tenant",
  roles: ["admin"],
  type: "human",
};

/**
 * Creates a mock AI provider that returns a predetermined response.
 */
function createMockProvider(response: string): AIProvider {
  return {
    name: "mock:test",
    complete: vi.fn(async () => response),
  };
}

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearActionRegistry();
  clearSubscribers();
});

afterEach(() => {
  // Reset to null provider
  setAIProvider(new NullAIProvider());
});

// ---------------------------------------------------------------------------
// Guard: AI not configured
// ---------------------------------------------------------------------------

describe("interpretCommand — AI not configured", () => {
  it("returns error when AI provider is NullAIProvider", async () => {
    setAIProvider(new NullAIProvider());

    const result = await interpretCommand("create a task", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.error).toContain("AI is not configured");
  });
});

// ---------------------------------------------------------------------------
// Guard: empty input
// ---------------------------------------------------------------------------

describe("interpretCommand — input validation", () => {
  it("rejects empty text", async () => {
    setAIProvider(createMockProvider(""));

    const result = await interpretCommand("", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.error).toContain("enter a command");
  });

  it("rejects whitespace-only text", async () => {
    setAIProvider(createMockProvider(""));

    const result = await interpretCommand("   ", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.error).toContain("enter a command");
  });
});

// ---------------------------------------------------------------------------
// Guard: no actions registered
// ---------------------------------------------------------------------------

describe("interpretCommand — no actions", () => {
  it("returns error when no actions are registered", async () => {
    setAIProvider(createMockProvider("{}"));

    const result = await interpretCommand("do something", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No actions are registered");
  });
});

// ---------------------------------------------------------------------------
// Successful command → action dispatch
// ---------------------------------------------------------------------------

describe("interpretCommand — successful dispatch", () => {
  it("maps natural language to an action and dispatches it", async () => {
    // Register a test action
    registerAction({
      id: "task.create",
      name: "Create Task",
      description: "Creates a new task with a title and priority",
      inputSchema: z.object({
        title: z.string(),
        priority: z.string().optional(),
      }),
      outputSchema: z.record(z.unknown()),
      permissions: [{ effect: "allow" }],
      idempotent: false,
      execute: vi.fn(async (input) => ({
        id: "generated-uuid",
        ...(input as Record<string, unknown>),
      })),
    });

    // Mock AI returns a valid action mapping
    const aiResponse = JSON.stringify({
      actionId: "task.create",
      input: { title: "Fix login bug", priority: "high" },
      explanation: "Creating a new task with title and priority",
    });
    setAIProvider(createMockProvider(aiResponse));

    const result = await interpretCommand(
      "Create a task called Fix login bug with high priority",
      TEST_CALLER
    );

    expect(result.success).toBe(true);
    expect(result.actionId).toBe("task.create");
    expect(result.interpretation).toBe("Creating a new task with title and priority");
    expect(result.data).toMatchObject({ title: "Fix login bug", priority: "high" });
  });
});

// ---------------------------------------------------------------------------
// AI can't match an action
// ---------------------------------------------------------------------------

describe("interpretCommand — no match", () => {
  it("returns the AI explanation when no action matches", async () => {
    registerAction({
      id: "task.create",
      name: "Create Task",
      description: "Creates a new task",
      inputSchema: z.object({ title: z.string() }),
      outputSchema: z.record(z.unknown()),
      permissions: [{ effect: "allow" }],
      idempotent: false,
      execute: vi.fn(async () => ({})),
    });

    const aiResponse = JSON.stringify({
      actionId: "",
      input: {},
      explanation: "I could not match that to an available action.",
    });
    setAIProvider(createMockProvider(aiResponse));

    const result = await interpretCommand("play a song", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.interpretation).toContain("could not match");
  });
});

// ---------------------------------------------------------------------------
// AI returns invalid JSON
// ---------------------------------------------------------------------------

describe("interpretCommand — invalid AI response", () => {
  it("handles malformed JSON gracefully", async () => {
    registerAction({
      id: "task.create",
      name: "Create Task",
      description: "Creates a new task",
      inputSchema: z.object({ title: z.string() }),
      outputSchema: z.record(z.unknown()),
      permissions: [{ effect: "allow" }],
      idempotent: false,
      execute: vi.fn(async () => ({})),
    });

    setAIProvider(createMockProvider("this is not json"));

    const result = await interpretCommand("create a task", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse");
  });
});

// ---------------------------------------------------------------------------
// AI provider throws
// ---------------------------------------------------------------------------

describe("interpretCommand — AI provider error", () => {
  it("handles provider errors gracefully", async () => {
    registerAction({
      id: "task.create",
      name: "Create Task",
      description: "Creates a new task",
      inputSchema: z.object({ title: z.string() }),
      outputSchema: z.record(z.unknown()),
      permissions: [{ effect: "allow" }],
      idempotent: false,
      execute: vi.fn(async () => ({})),
    });

    const errorProvider: AIProvider = {
      name: "error:test",
      complete: vi.fn(async () => {
        throw new Error("API rate limit exceeded");
      }),
    };
    setAIProvider(errorProvider);

    const result = await interpretCommand("create a task", TEST_CALLER);

    expect(result.success).toBe(false);
    expect(result.error).toContain("API rate limit exceeded");
  });
});
