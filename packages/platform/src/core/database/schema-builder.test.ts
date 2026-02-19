/**
 * Schema Builder — Test Suite
 *
 * Validates the conversion of EntityDefinitions to database table schemas.
 * Tests cover:
 *   - Entity name → table name pluralization
 *   - Field name → column name conversion
 *   - Table schema generation from entity definitions
 *   - Registry isolation between tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  toTableName,
  toColumnName,
  buildTableSchema,
  getTableSchema,
  getAllTableSchemas,
  clearTableRegistry,
} from "./schema-builder.js";
import { defineEntity } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Reset table registry between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearTableRegistry();
});

// ---------------------------------------------------------------------------
// toTableName — entity name to database table name
// ---------------------------------------------------------------------------

describe("toTableName", () => {
  it("pluralizes simple names", () => {
    expect(toTableName("Contact")).toBe("contacts");
    expect(toTableName("Deal")).toBe("deals");
    expect(toTableName("Task")).toBe("tasks");
  });

  it("handles PascalCase with multiple words", () => {
    expect(toTableName("PurchaseOrder")).toBe("purchase_orders");
    expect(toTableName("LineItem")).toBe("line_items");
  });

  it("pluralizes words ending in consonant + y → ies", () => {
    expect(toTableName("Company")).toBe("companies");
    expect(toTableName("Category")).toBe("categories");
  });

  it("does NOT apply y→ies for vowel + y", () => {
    expect(toTableName("Key")).toBe("keys");
    expect(toTableName("Day")).toBe("days");
  });

  it("handles words ending in s, x, ch, sh → es", () => {
    expect(toTableName("Address")).toBe("addresses");
    expect(toTableName("Tax")).toBe("taxes");
  });

  it("converts to lowercase", () => {
    expect(toTableName("CONTACT")).toBe("contacts");
  });
});

// ---------------------------------------------------------------------------
// toColumnName — field name to database column name
// ---------------------------------------------------------------------------

describe("toColumnName", () => {
  it("converts camelCase to snake_case", () => {
    expect(toColumnName("firstName")).toBe("first_name");
    expect(toColumnName("companyId")).toBe("company_id");
    expect(toColumnName("createdAt")).toBe("created_at");
  });

  it("leaves single-word names unchanged", () => {
    expect(toColumnName("name")).toBe("name");
    expect(toColumnName("email")).toBe("email");
  });

  it("handles multiple consecutive uppercase letters", () => {
    expect(toColumnName("htmlContent")).toBe("html_content");
  });
});

// ---------------------------------------------------------------------------
// buildTableSchema — entity definition to Drizzle table schema
// ---------------------------------------------------------------------------

describe("buildTableSchema", () => {
  const testEntity = defineEntity({
    name: "TestItem",
    pluralName: "TestItems",
    description: "An entity for testing schema generation",
    fields: [
      { name: "title", type: "text", required: true, description: "Title" },
      { name: "isActive", type: "boolean", required: false, description: "Active flag" },
      { name: "price", type: "currency", required: true, description: "Price" },
    ],
    ui: {
      icon: "package",
      listColumns: ["title"],
      searchFields: ["title"],
      defaultSort: { field: "title", direction: "asc" },
    },
  });

  it("returns a Drizzle table object", () => {
    const table = buildTableSchema(testEntity);
    expect(table).toBeDefined();
  });

  it("includes standard columns: id, created_at, updated_at", () => {
    const table = buildTableSchema(testEntity);
    expect(table.id).toBeDefined();
    expect(table.created_at).toBeDefined();
    expect(table.updated_at).toBeDefined();
  });

  it("includes columns for each entity field", () => {
    const table = buildTableSchema(testEntity);
    expect(table.title).toBeDefined();
    expect(table.is_active).toBeDefined();
    expect(table.price).toBeDefined();
  });

  it("returns the same table on repeated calls (idempotent via registry cache)", () => {
    const table1 = buildTableSchema(testEntity);
    const table2 = buildTableSchema(testEntity);
    expect(table1).toBe(table2); // Same reference
  });

  it("stores the table in the registry", () => {
    buildTableSchema(testEntity);
    const retrieved = getTableSchema("TestItem");
    expect(retrieved).toBeDefined();
  });

  it("adds foreign key columns for belongsTo relationships", () => {
    const entityWithFK = defineEntity({
      name: "ChildItem",
      pluralName: "ChildItems",
      description: "Entity with a foreign key",
      fields: [
        { name: "name", type: "text", required: true, description: "Name" },
      ],
      relationships: [
        { type: "belongsTo", entity: "Parent", foreignKey: "parent_id" },
      ],
      ui: {
        icon: "package",
        listColumns: ["name"],
        searchFields: ["name"],
        defaultSort: { field: "name", direction: "asc" },
      },
    });

    const table = buildTableSchema(entityWithFK);
    expect(table.parent_id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Registry functions
// ---------------------------------------------------------------------------

describe("getTableSchema", () => {
  it("returns undefined for an unregistered entity", () => {
    expect(getTableSchema("NonExistent")).toBeUndefined();
  });
});

describe("getAllTableSchemas", () => {
  it("returns an empty map when no schemas are registered", () => {
    expect(getAllTableSchemas().size).toBe(0);
  });

  it("returns all registered schemas", () => {
    const entity1 = defineEntity({
      name: "Alpha",
      pluralName: "Alphas",
      description: "Test",
      fields: [],
      ui: { icon: "package", listColumns: [], searchFields: [], defaultSort: { field: "id", direction: "asc" } },
    });
    const entity2 = defineEntity({
      name: "Beta",
      pluralName: "Betas",
      description: "Test",
      fields: [],
      ui: { icon: "package", listColumns: [], searchFields: [], defaultSort: { field: "id", direction: "asc" } },
    });

    buildTableSchema(entity1);
    buildTableSchema(entity2);

    expect(getAllTableSchemas().size).toBe(2);
  });
});

describe("clearTableRegistry", () => {
  it("removes all registered schemas", () => {
    const entity = defineEntity({
      name: "Temp",
      pluralName: "Temps",
      description: "Test",
      fields: [],
      ui: { icon: "package", listColumns: [], searchFields: [], defaultSort: { field: "id", direction: "asc" } },
    });

    buildTableSchema(entity);
    expect(getAllTableSchemas().size).toBe(1);

    clearTableRegistry();
    expect(getAllTableSchemas().size).toBe(0);
  });
});
