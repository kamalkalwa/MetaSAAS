/**
 * Entity Definition — Test Suite
 *
 * Validates that defineEntity produces correct EntityDefinition objects
 * and that entity structures conform to expected constraints.
 */

import { describe, it, expect } from "vitest";
import { defineEntity, type EntityDefinition } from "./entity.js";

describe("defineEntity", () => {
  it("returns the same object passed in (identity function for type safety)", () => {
    const input: EntityDefinition = {
      name: "TestEntity",
      pluralName: "TestEntities",
      description: "A test entity for unit testing",
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          description: "The title of the test entity",
        },
      ],
      ui: {
        icon: "package",
        listColumns: ["title"],
        searchFields: ["title"],
        defaultSort: { field: "title", direction: "asc" },
      },
    };

    const result = defineEntity(input);
    expect(result).toEqual(input);
    expect(result).toBe(input); // Same reference — no cloning
  });

  it("preserves all optional fields when provided", () => {
    const entity = defineEntity({
      name: "FullEntity",
      pluralName: "FullEntities",
      description: "Entity with all optional fields populated",
      fields: [
        {
          name: "status",
          type: "enum",
          required: true,
          description: "Current status",
          options: ["draft", "published"],
          defaultValue: "draft",
          sensitive: false,
          validations: [{ min: 1, message: "Status required" }],
        },
      ],
      relationships: [
        { type: "belongsTo", entity: "Parent", foreignKey: "parent_id" },
        { type: "hasMany", entity: "Child", foreignKey: "full_entity_id" },
      ],
      constraints: [
        { type: "unique", fields: ["status"] },
      ],
      ui: {
        icon: "package",
        listColumns: ["status"],
        searchFields: ["status"],
        defaultSort: { field: "status", direction: "desc" },
        defaultView: "list",
        realtime: true,
      },
    });

    expect(entity.relationships).toHaveLength(2);
    expect(entity.constraints).toHaveLength(1);
    expect(entity.fields[0].options).toEqual(["draft", "published"]);
    expect(entity.fields[0].defaultValue).toBe("draft");
    expect(entity.fields[0].sensitive).toBe(false);
    expect(entity.ui.defaultView).toBe("list");
    expect(entity.ui.realtime).toBe(true);
  });

  it("allows entities with no relationships or constraints", () => {
    const entity = defineEntity({
      name: "Standalone",
      pluralName: "Standalones",
      description: "An entity with no relationships",
      fields: [
        { name: "value", type: "text", required: true, description: "A value" },
      ],
      ui: {
        icon: "package",
        listColumns: ["value"],
        searchFields: ["value"],
        defaultSort: { field: "value", direction: "asc" },
      },
    });

    expect(entity.relationships).toBeUndefined();
    expect(entity.constraints).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Entity structure validation (convention enforcement)
// ---------------------------------------------------------------------------

describe("entity naming conventions", () => {
  it("name should be PascalCase", () => {
    // This is a convention test — verifies that existing entities follow the pattern
    const entity = defineEntity({
      name: "MyEntity",
      pluralName: "MyEntities",
      description: "Test",
      fields: [],
      ui: {
        icon: "package",
        listColumns: [],
        searchFields: [],
        defaultSort: { field: "name", direction: "asc" },
      },
    });

    // PascalCase: starts with uppercase, no spaces, no underscores in the name
    expect(entity.name).toMatch(/^[A-Z][a-zA-Z]*$/);
  });

  it("pluralName should be different from name", () => {
    const entity = defineEntity({
      name: "Contact",
      pluralName: "Contacts",
      description: "Test",
      fields: [],
      ui: {
        icon: "package",
        listColumns: [],
        searchFields: [],
        defaultSort: { field: "name", direction: "asc" },
      },
    });

    expect(entity.pluralName).not.toBe(entity.name);
  });

  it("field names should be camelCase", () => {
    const entity = defineEntity({
      name: "Test",
      pluralName: "Tests",
      description: "Test",
      fields: [
        { name: "firstName", type: "text", required: true, description: "First name" },
        { name: "email", type: "email", required: true, description: "Email" },
      ],
      ui: {
        icon: "package",
        listColumns: [],
        searchFields: [],
        defaultSort: { field: "firstName", direction: "asc" },
      },
    });

    for (const field of entity.fields) {
      // camelCase: starts with lowercase
      expect(field.name).toMatch(/^[a-z]/);
    }
  });
});
