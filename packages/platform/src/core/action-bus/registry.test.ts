/**
 * Action Registry — Test Suite
 *
 * Validates action registration, lookup, and uniqueness enforcement.
 * The registry is central to the Action Bus — if registration breaks,
 * no action can be dispatched.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  registerAction,
  registerActions,
  getAction,
  getAllActions,
  getActionsForEntity,
  clearActionRegistry,
} from "./registry.js";
import type { ActionDefinition } from "@metasaas/contracts";

/**
 * Factory: creates a minimal valid ActionDefinition for testing.
 * Keeps tests focused on registry behavior, not action structure.
 */
function createTestAction(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id: "test.action",
    name: "Test Action",
    description: "A test action for unit testing",
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    permissions: [{ effect: "allow" }],
    idempotent: true,
    execute: async (input) => ({ result: (input as { value: string }).value }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset state between tests to prevent leakage
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearActionRegistry();
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registerAction", () => {
  it("registers a valid action", () => {
    const action = createTestAction({ id: "contact.create" });
    registerAction(action);

    const retrieved = getAction("contact.create");
    expect(retrieved).toBe(action);
  });

  it("throws when registering an action with a duplicate ID", () => {
    const action1 = createTestAction({ id: "contact.create" });
    const action2 = createTestAction({ id: "contact.create", name: "Duplicate" });

    registerAction(action1);

    expect(() => registerAction(action2)).toThrow(
      'Action "contact.create" is already registered'
    );
  });

  it("allows actions with different IDs", () => {
    registerAction(createTestAction({ id: "contact.create" }));
    registerAction(createTestAction({ id: "contact.delete" }));

    expect(getAction("contact.create")).toBeDefined();
    expect(getAction("contact.delete")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Batch registration
// ---------------------------------------------------------------------------

describe("registerActions", () => {
  it("registers multiple actions at once", () => {
    const actions = [
      createTestAction({ id: "contact.create" }),
      createTestAction({ id: "contact.update" }),
      createTestAction({ id: "contact.delete" }),
    ];

    registerActions(actions);

    expect(getAllActions()).toHaveLength(3);
  });

  it("throws on first duplicate and stops (fail-fast)", () => {
    registerAction(createTestAction({ id: "contact.create" }));

    const newActions = [
      createTestAction({ id: "contact.create" }), // duplicate
      createTestAction({ id: "contact.update" }),
    ];

    expect(() => registerActions(newActions)).toThrow();
    // contact.update should NOT be registered because the batch failed on the first item
    expect(getAction("contact.update")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

describe("getAction", () => {
  it("returns undefined for an unregistered action ID", () => {
    expect(getAction("nonexistent.action")).toBeUndefined();
  });

  it("returns the exact action object (same reference)", () => {
    const action = createTestAction({ id: "test.lookup" });
    registerAction(action);
    expect(getAction("test.lookup")).toBe(action);
  });
});

describe("getAllActions", () => {
  it("returns an empty array when no actions are registered", () => {
    expect(getAllActions()).toEqual([]);
  });

  it("returns all registered actions", () => {
    registerAction(createTestAction({ id: "a.one" }));
    registerAction(createTestAction({ id: "b.two" }));
    expect(getAllActions()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Entity filtering
// ---------------------------------------------------------------------------

describe("getActionsForEntity", () => {
  it("returns only actions matching the entity prefix", () => {
    registerAction(createTestAction({ id: "contact.create" }));
    registerAction(createTestAction({ id: "contact.update" }));
    registerAction(createTestAction({ id: "company.create" }));

    const contactActions = getActionsForEntity("contact");
    expect(contactActions).toHaveLength(2);
    expect(contactActions.map((a) => a.id)).toEqual(
      expect.arrayContaining(["contact.create", "contact.update"])
    );
  });

  it("returns an empty array for an entity with no actions", () => {
    registerAction(createTestAction({ id: "contact.create" }));

    const dealActions = getActionsForEntity("deal");
    expect(dealActions).toEqual([]);
  });

  it("is case-insensitive on the entity name", () => {
    registerAction(createTestAction({ id: "Contact.create" }));

    const actions = getActionsForEntity("contact");
    expect(actions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// State isolation
// ---------------------------------------------------------------------------

describe("clearActionRegistry", () => {
  it("removes all registered actions", () => {
    registerAction(createTestAction({ id: "test.one" }));
    registerAction(createTestAction({ id: "test.two" }));
    expect(getAllActions()).toHaveLength(2);

    clearActionRegistry();
    expect(getAllActions()).toHaveLength(0);
  });
});
