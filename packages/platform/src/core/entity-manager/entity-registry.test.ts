/**
 * Entity Registry — Test Suite
 *
 * Validates entity registration, lookup by name and plural name,
 * and uniqueness enforcement. The entity registry is the source of truth
 * for what business objects exist in the system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerEntity,
  registerEntities,
  getEntity,
  getEntityByPlural,
  getAllEntities,
  clearEntityRegistry,
} from "./entity-registry.js";
import { defineEntity, type EntityDefinition } from "@metasaas/contracts";

/**
 * Factory: creates a minimal valid EntityDefinition for testing.
 */
function createTestEntity(overrides: Partial<EntityDefinition> = {}): EntityDefinition {
  return defineEntity({
    name: "TestEntity",
    pluralName: "TestEntities",
    description: "A test entity",
    fields: [
      { name: "name", type: "text", required: true, description: "Name" },
    ],
    ui: {
      icon: "package",
      listColumns: ["name"],
      searchFields: ["name"],
      defaultSort: { field: "name", direction: "asc" },
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearEntityRegistry();
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registerEntity", () => {
  it("registers a valid entity", () => {
    const entity = createTestEntity();
    registerEntity(entity);
    expect(getEntity("TestEntity")).toBe(entity);
  });

  it("throws on duplicate entity name", () => {
    registerEntity(createTestEntity());
    expect(() => registerEntity(createTestEntity())).toThrow(
      'Entity "TestEntity" is already registered'
    );
  });
});

describe("registerEntities", () => {
  it("registers multiple entities", () => {
    const entities = [
      createTestEntity({ name: "Alpha", pluralName: "Alphas" }),
      createTestEntity({ name: "Beta", pluralName: "Betas" }),
    ];
    registerEntities(entities);
    expect(getAllEntities()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

describe("getEntity", () => {
  it("returns undefined for unregistered name", () => {
    expect(getEntity("Ghost")).toBeUndefined();
  });
});

describe("getEntityByPlural", () => {
  it("finds entity by plural name (case-insensitive)", () => {
    registerEntity(createTestEntity({ name: "Contact", pluralName: "Contacts" }));

    expect(getEntityByPlural("contacts")).toBeDefined();
    expect(getEntityByPlural("Contacts")).toBeDefined();
    expect(getEntityByPlural("CONTACTS")).toBeDefined();
  });

  it("returns undefined for unknown plural name", () => {
    expect(getEntityByPlural("widgets")).toBeUndefined();
  });
});

describe("getAllEntities", () => {
  it("returns empty array when nothing is registered", () => {
    expect(getAllEntities()).toEqual([]);
  });

  it("returns all registered entities in insertion order", () => {
    registerEntity(createTestEntity({ name: "A", pluralName: "As" }));
    registerEntity(createTestEntity({ name: "B", pluralName: "Bs" }));

    const all = getAllEntities();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe("A");
    expect(all[1].name).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// State isolation
// ---------------------------------------------------------------------------

describe("clearEntityRegistry", () => {
  it("removes all entities", () => {
    registerEntity(createTestEntity());
    expect(getAllEntities()).toHaveLength(1);

    clearEntityRegistry();
    expect(getAllEntities()).toHaveLength(0);
  });
});
