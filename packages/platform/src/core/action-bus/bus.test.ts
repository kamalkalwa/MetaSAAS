/**
 * Action Bus — Test Suite
 *
 * Validates the central dispatch pipeline:
 *   1. Lookup → action must exist
 *   2. Validate → input must match schema
 *   3. Authorize → caller must have permission
 *   4. Execute → business logic runs
 *   5. Return → structured result
 *
 * The Action Bus is the SINGLE entry point for all operations.
 * If this breaks, nothing works.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { dispatch, type ActionResult } from "./bus.js";
import { registerAction, clearActionRegistry } from "./registry.js";
import { clearSubscribers, subscribe } from "../event-bus/index.js";
import type { ActionDefinition, Caller, EventSubscriber } from "@metasaas/contracts";

/** Standard test caller */
const TEST_CALLER: Caller = {
  userId: "test-user",
  tenantId: "test-tenant",
  roles: ["admin"],
  type: "human",
};

/**
 * Factory: creates a minimal action for testing dispatch.
 */
function createTestAction(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id: "test.action",
    name: "Test Action",
    description: "Test action for dispatch testing",
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    permissions: [{ effect: "allow" }],
    idempotent: true,
    execute: vi.fn(async (input) => ({
      result: (input as { value: string }).value,
    })),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearActionRegistry();
  clearSubscribers();
});

// ---------------------------------------------------------------------------
// Successful dispatch
// ---------------------------------------------------------------------------

describe("dispatch — success", () => {
  it("returns success:true with data when action executes correctly", async () => {
    const action = createTestAction();
    registerAction(action);

    const result = await dispatch("test.action", { value: "hello" }, TEST_CALLER);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: "hello" });
    }
  });

  it("calls the action's execute function with validated input", async () => {
    const executeFn = vi.fn(async () => ({ done: true }));
    registerAction(
      createTestAction({
        id: "test.execute",
        execute: executeFn,
      })
    );

    await dispatch("test.execute", { value: "test" }, TEST_CALLER);

    expect(executeFn).toHaveBeenCalledOnce();
    // First argument should be the validated input
    expect(executeFn.mock.calls[0][0]).toEqual({ value: "test" });
  });

  it("provides ActionContext to the execute function", async () => {
    const executeFn = vi.fn(async (_input, ctx) => {
      // Verify context has all required properties
      expect(ctx).toHaveProperty("caller");
      expect(ctx).toHaveProperty("db");
      expect(ctx).toHaveProperty("emit");
      expect(ctx).toHaveProperty("logger");
      expect(ctx.caller).toEqual(TEST_CALLER);
      return { ok: true };
    });

    registerAction(
      createTestAction({
        id: "test.context",
        execute: executeFn,
      })
    );

    await dispatch("test.context", { value: "test" }, TEST_CALLER);
    expect(executeFn).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Action not found
// ---------------------------------------------------------------------------

describe("dispatch — action not found", () => {
  it("returns success:false when action ID does not exist", async () => {
    const result = await dispatch("nonexistent.action", {}, TEST_CALLER);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("nonexistent.action");
      expect(result.error).toContain("not found");
    }
  });
});

// ---------------------------------------------------------------------------
// Validation failures
// ---------------------------------------------------------------------------

describe("dispatch — validation", () => {
  it("returns success:false with field errors when input is invalid", async () => {
    registerAction(createTestAction());

    // Send a number instead of the expected string
    const result = await dispatch("test.action", { value: 42 }, TEST_CALLER);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.details).toBeDefined();
      expect((result.details as any).fieldErrors).toBeDefined();
    }
  });

  it("returns success:false when required input is missing", async () => {
    registerAction(createTestAction());

    const result = await dispatch("test.action", {}, TEST_CALLER);

    expect(result.success).toBe(false);
  });

  it("does NOT call execute when validation fails", async () => {
    const executeFn = vi.fn(async () => ({ done: true }));
    registerAction(
      createTestAction({
        id: "test.noexec",
        execute: executeFn,
      })
    );

    await dispatch("test.noexec", { value: 42 }, TEST_CALLER);

    expect(executeFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Execution errors
// ---------------------------------------------------------------------------

describe("dispatch — execution errors", () => {
  it("returns success:false with generic message for unexpected errors", async () => {
    registerAction(
      createTestAction({
        id: "test.error",
        execute: async () => {
          throw new Error("Database connection lost");
        },
      })
    );

    const result = await dispatch("test.error", { value: "test" }, TEST_CALLER);

    expect(result.success).toBe(false);
    if (!result.success) {
      // Should NOT leak the internal error message
      expect(result.error).toBe("An unexpected error occurred");
      expect(result.error).not.toContain("Database connection lost");
    }
  });

  it("does not leak stack traces in error responses", async () => {
    registerAction(
      createTestAction({
        id: "test.stack",
        execute: async () => {
          throw new Error("Internal failure");
        },
      })
    );

    const result = await dispatch("test.stack", { value: "test" }, TEST_CALLER);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result)).not.toContain("at ");
      expect(JSON.stringify(result)).not.toContain(".ts:");
    }
  });
});

// ---------------------------------------------------------------------------
// Result structure
// ---------------------------------------------------------------------------

describe("dispatch — result structure", () => {
  it("success result has exactly { success, data }", async () => {
    registerAction(createTestAction());

    const result = await dispatch("test.action", { value: "test" }, TEST_CALLER);

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("data");
    expect(Object.keys(result)).toEqual(["success", "data"]);
  });

  it("error result has { success, error } and optionally { details }", async () => {
    const result = await dispatch("nonexistent", {}, TEST_CALLER);

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Layer 3 Hooks: beforeExecute / afterExecute
// ---------------------------------------------------------------------------

describe("dispatch — Layer 3 hooks", () => {
  it("beforeExecute transforms input before execute", async () => {
    const executeSpy = vi.fn(async (input) => ({
      result: (input as { value: string }).value,
    }));

    registerAction(
      createTestAction({
        id: "test.hooks.before",
        execute: executeSpy,
        beforeExecute: async (input) => {
          // Transform: append " (hooked)" to the value
          const typed = input as { value: string };
          return { value: typed.value + " (hooked)" };
        },
      })
    );

    const result = await dispatch("test.hooks.before", { value: "hello" }, TEST_CALLER);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: "hello (hooked)" });
    }
    // execute received the transformed input
    expect(executeSpy).toHaveBeenCalledWith(
      { value: "hello (hooked)" },
      expect.anything()
    );
  });

  it("afterExecute transforms the result", async () => {
    registerAction(
      createTestAction({
        id: "test.hooks.after",
        afterExecute: async (result) => {
          const typed = result as { result: string };
          return { result: typed.result.toUpperCase() };
        },
      })
    );

    const result = await dispatch("test.hooks.after", { value: "hello" }, TEST_CALLER);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: "HELLO" });
    }
  });

  it("beforeExecute can abort by throwing", async () => {
    const executeSpy = vi.fn(async () => ({}));

    registerAction(
      createTestAction({
        id: "test.hooks.abort",
        execute: executeSpy,
        beforeExecute: async () => {
          throw new Error("Aborted by hook");
        },
      })
    );

    const result = await dispatch("test.hooks.abort", { value: "test" }, TEST_CALLER);

    expect(result.success).toBe(false);
    // execute was never called
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("actions without hooks work normally", async () => {
    registerAction(
      createTestAction({
        id: "test.hooks.none",
        // No beforeExecute or afterExecute
      })
    );

    const result = await dispatch("test.hooks.none", { value: "test" }, TEST_CALLER);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: "test" });
    }
  });

  it("both hooks work together in sequence", async () => {
    const order: string[] = [];

    registerAction(
      createTestAction({
        id: "test.hooks.both",
        beforeExecute: async (input) => {
          order.push("before");
          return input;
        },
        execute: vi.fn(async (input) => {
          order.push("execute");
          return { result: (input as { value: string }).value };
        }),
        afterExecute: async (result) => {
          order.push("after");
          return result;
        },
      })
    );

    await dispatch("test.hooks.both", { value: "test" }, TEST_CALLER);

    expect(order).toEqual(["before", "execute", "after"]);
  });
});

// ---------------------------------------------------------------------------
// Side Effects Processing
// ---------------------------------------------------------------------------

describe("dispatch — side effects", () => {
  it("processes emit_event side effects after successful execution", async () => {
    const receivedEvents: string[] = [];

    // Register a subscriber to capture the emitted event
    const sub: EventSubscriber = {
      eventType: "custom.side.effect",
      name: "TestSideEffectSubscriber",
      handler: async (event) => {
        receivedEvents.push(event.type);
      },
    };
    subscribe(sub);

    registerAction(
      createTestAction({
        id: "test.sideeffect.emit",
        sideEffects: [
          {
            type: "emit_event",
            config: { eventType: "custom.side.effect" },
          },
        ],
      })
    );

    const result = await dispatch(
      "test.sideeffect.emit",
      { value: "trigger" },
      TEST_CALLER
    );

    expect(result.success).toBe(true);
    expect(receivedEvents).toContain("custom.side.effect");
  });

  it("processes notify side effects without breaking the action", async () => {
    registerAction(
      createTestAction({
        id: "test.sideeffect.notify",
        sideEffects: [
          {
            type: "notify",
            config: { channel: "email", message: "Task completed" },
          },
        ],
      })
    );

    const result = await dispatch(
      "test.sideeffect.notify",
      { value: "test" },
      TEST_CALLER
    );

    // Action should succeed regardless of notification
    expect(result.success).toBe(true);
  });

  it("side effects never break the action even if they throw", async () => {
    // Register a subscriber that throws
    const sub: EventSubscriber = {
      eventType: "failing.event",
      name: "FailingSubscriber",
      handler: async () => {
        throw new Error("Subscriber crashed!");
      },
    };
    subscribe(sub);

    registerAction(
      createTestAction({
        id: "test.sideeffect.failing",
        sideEffects: [
          {
            type: "emit_event",
            config: { eventType: "failing.event" },
          },
        ],
      })
    );

    const result = await dispatch(
      "test.sideeffect.failing",
      { value: "test" },
      TEST_CALLER
    );

    // Action should still succeed even though the side effect subscriber threw
    expect(result.success).toBe(true);
  });

  it("skips side effects when the action has none declared", async () => {
    registerAction(
      createTestAction({
        id: "test.sideeffect.none",
        // No sideEffects declared
      })
    );

    const result = await dispatch(
      "test.sideeffect.none",
      { value: "test" },
      TEST_CALLER
    );

    expect(result.success).toBe(true);
  });

  it("does not process side effects when action fails", async () => {
    const receivedEvents: string[] = [];

    const sub: EventSubscriber = {
      eventType: "should.not.fire",
      name: "NeverFireSubscriber",
      handler: async (event) => {
        receivedEvents.push(event.type);
      },
    };
    subscribe(sub);

    registerAction(
      createTestAction({
        id: "test.sideeffect.nofire",
        sideEffects: [
          {
            type: "emit_event",
            config: { eventType: "should.not.fire" },
          },
        ],
        execute: async () => {
          throw new Error("Action failed");
        },
      })
    );

    const result = await dispatch(
      "test.sideeffect.nofire",
      { value: "test" },
      TEST_CALLER
    );

    expect(result.success).toBe(false);
    // Side effect should NOT have fired because the action failed
    expect(receivedEvents).not.toContain("should.not.fire");
  });
});
