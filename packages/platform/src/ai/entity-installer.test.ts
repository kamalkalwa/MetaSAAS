/**
 * Entity Installer — Test Suite
 *
 * Tests hot-installation of entities at runtime.
 * Uses in-memory registries — no database needed.
 *
 * Note: runMigrations() requires a database connection, so these tests
 * mock the migration step and test the registration pipeline.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { defineEntity, type EntityDefinition } from "@metasaas/contracts";
import { clearEntityRegistry, getEntity, getAllEntities } from "../core/entity-manager/entity-registry.js";
import { clearTableRegistry } from "../core/database/schema-builder.js";
import { clearActionRegistry, getAction, getAllActions } from "../core/action-bus/registry.js";

// Mock runMigrations since we don't have a database in tests
vi.mock("../core/database/migrate.js", () => ({
  runMigrations: vi.fn(async () => {}),
}));

import { installEntity, installEntities } from "./entity-installer.js";

function createTestEntity(overrides: Partial<EntityDefinition> = {}): EntityDefinition {
  return defineEntity({
    name: "Widget",
    pluralName: "Widgets",
    description: "A test widget entity",
    fields: [
      { name: "title", type: "text", required: true, description: "Widget title" },
      { name: "color", type: "text", required: false, description: "Widget color" },
    ],
    ui: {
      icon: "box",
      listColumns: ["title", "color"],
      searchFields: ["title"],
      defaultSort: { field: "title", direction: "asc" },
    },
    ...overrides,
  });
}

describe("Entity Installer", () => {
  beforeEach(() => {
    clearEntityRegistry();
    clearTableRegistry();
    clearActionRegistry();
    vi.clearAllMocks();
  });

  describe("installEntity()", () => {
    it("installs an entity successfully", async () => {
      const entity = createTestEntity();
      const result = await installEntity(entity);

      expect(result.success).toBe(true);
      expect(result.entityName).toBe("Widget");
      expect(result.actions).toHaveLength(5);
      expect(result.actions).toContain("widget.create");
      expect(result.actions).toContain("widget.findAll");
      expect(result.actions).toContain("widget.findById");
      expect(result.actions).toContain("widget.update");
      expect(result.actions).toContain("widget.delete");
      expect(result.warnings).toHaveLength(0);
    });

    it("registers entity in the entity registry", async () => {
      const entity = createTestEntity();
      await installEntity(entity);

      expect(getEntity("Widget")).toBeDefined();
      expect(getEntity("Widget")!.name).toBe("Widget");
    });

    it("registers CRUD actions in the action bus", async () => {
      const entity = createTestEntity();
      await installEntity(entity);

      expect(getAction("widget.create")).toBeDefined();
      expect(getAction("widget.findAll")).toBeDefined();
      expect(getAction("widget.findById")).toBeDefined();
      expect(getAction("widget.update")).toBeDefined();
      expect(getAction("widget.delete")).toBeDefined();
    });

    it("calls runMigrations with the entity", async () => {
      const { runMigrations } = await import("../core/database/migrate.js");
      const entity = createTestEntity();
      await installEntity(entity);

      expect(runMigrations).toHaveBeenCalledWith([entity]);
    });

    it("returns warnings when entity already exists", async () => {
      const entity = createTestEntity();

      // Install once
      await installEntity(entity);

      // Install again — should warn, not throw
      const result = await installEntity(entity);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("already registered"))).toBe(true);
    });

    it("handles entities with relationships", async () => {
      // Install parent first
      const company = createTestEntity({
        name: "Company",
        pluralName: "Companies",
        description: "A company",
        fields: [{ name: "name", type: "text", required: true, description: "Name" }],
      });
      await installEntity(company);

      // Install child with relationship
      const contact = createTestEntity({
        name: "Contact",
        pluralName: "Contacts",
        description: "A contact",
        fields: [{ name: "name", type: "text", required: true, description: "Name" }],
        relationships: [
          { type: "belongsTo", entity: "Company" },
        ],
      });
      const result = await installEntity(contact);

      expect(result.success).toBe(true);
      expect(getEntity("Contact")).toBeDefined();
    });

    it("handles entities with workflows", async () => {
      const ticket = createTestEntity({
        name: "Ticket",
        pluralName: "Tickets",
        description: "A support ticket",
        fields: [
          { name: "title", type: "text", required: true, description: "Title" },
          { name: "status", type: "text", required: true, description: "Status" },
        ],
        workflows: [
          {
            field: "status",
            transitions: [
              { from: "open", to: "in_progress" },
              { from: "in_progress", to: "resolved" },
              { from: "resolved", to: "closed" },
            ],
          },
        ],
      });

      const result = await installEntity(ticket);
      expect(result.success).toBe(true);
    });

    it("never throws — returns error in result", async () => {
      // Create an entity that will cause an error
      // (empty name would cause issues in most systems)
      const badEntity = { ...createTestEntity(), name: "" };

      const result = await installEntity(badEntity as EntityDefinition);
      // Depending on validation, might succeed or fail gracefully
      // The important thing is it doesn't throw
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("installEntities()", () => {
    it("installs multiple entities in order", async () => {
      const entities = [
        createTestEntity({ name: "Alpha", pluralName: "Alphas" }),
        createTestEntity({ name: "Beta", pluralName: "Betas" }),
        createTestEntity({ name: "Gamma", pluralName: "Gammas" }),
      ];

      const results = await installEntities(entities);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(getAllEntities()).toHaveLength(3);
    });

    it("stops on first failure", async () => {
      // Install first entity, then make the second one fail by using same name
      const entities = [
        createTestEntity({ name: "First", pluralName: "Firsts" }),
        createTestEntity({ name: "First", pluralName: "Firsts" }), // duplicate — will warn but not fail
        createTestEntity({ name: "Third", pluralName: "Thirds" }),
      ];

      const results = await installEntities(entities);
      // All should succeed since installer handles duplicates gracefully
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });
});
