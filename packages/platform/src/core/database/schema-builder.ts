/**
 * Schema Builder
 *
 * Converts EntityDefinitions into Drizzle table schemas dynamically.
 * This is the bridge between the declarative entity format and the
 * database layer.
 *
 * The builder creates standard columns for every entity:
 *   - id (UUID, primary key)
 *   - createdAt (timestamp)
 *   - updatedAt (timestamp)
 *
 * Then adds columns for each field in the entity definition,
 * plus foreign key columns for belongsTo relationships.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  numeric,
  timestamp,
  type PgTableWithColumns,
} from "drizzle-orm/pg-core";
import type { EntityDefinition, FieldDefinition } from "@metasaas/contracts";

/**
 * Converts an entity name to a database table name.
 * "Contact" → "contacts", "PurchaseOrder" → "purchase_orders"
 */
export function toTableName(entityName: string): string {
  const snake = entityName
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();

  // Basic English pluralization rules
  if (snake.endsWith("y") && !/[aeiou]y$/.test(snake)) {
    return snake.slice(0, -1) + "ies"; // company → companies
  }
  if (snake.endsWith("s") || snake.endsWith("x") || snake.endsWith("ch") || snake.endsWith("sh")) {
    return snake + "es"; // address → addresses
  }
  return snake + "s"; // contact → contacts
}

/**
 * Converts a field name to a database column name.
 * camelCase → snake_case. "firstName" → "first_name"
 */
export function toColumnName(fieldName: string): string {
  return fieldName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Converts a database column name back to a field name.
 * snake_case → camelCase. "first_name" → "firstName"
 *
 * This is the inverse of toColumnName — used by the DatabaseClient
 * to return results in a consistent camelCase format so consumers
 * (frontend, AI agents, API clients) never see database naming.
 */
export function fromColumnName(columnName: string): string {
  return columnName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Maps a FieldDefinition to a Drizzle column builder.
 */
function buildColumn(field: FieldDefinition) {
  const colName = toColumnName(field.name);

  switch (field.type) {
    case "text":
    case "rich_text":
    case "phone":
      return text(colName);
    case "email":
    case "url":
      return varchar(colName, { length: 512 });
    case "currency":
    case "number":
    case "percentage":
      return numeric(colName);
    case "date":
    case "datetime":
      return timestamp(colName, { withTimezone: true });
    case "boolean":
      return boolean(colName);
    case "enum":
      // Store as text — validation happens at the Action Bus level
      return varchar(colName, { length: 255 });
    default:
      return text(colName);
  }
}

/** In-memory registry of generated Drizzle table schemas */
const tableRegistry = new Map<string, PgTableWithColumns<any>>();

/**
 * Builds a Drizzle table schema from an EntityDefinition.
 * Stores the result in the registry for later use by the CRUD generator.
 *
 * Returns the Drizzle table object.
 */
export function buildTableSchema(
  entity: EntityDefinition
): PgTableWithColumns<any> {
  const tableName = toTableName(entity.name);

  // Check if already built
  const existing = tableRegistry.get(entity.name);
  if (existing) return existing;

  const table = pgTable(tableName, (t) => {
    // Standard columns every entity gets
    const columns: Record<string, any> = {
      id: uuid("id").primaryKey().defaultRandom(),
      tenant_id: uuid("tenant_id").notNull(),
      created_at: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updated_at: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    };

    // Entity-specific fields
    for (const field of entity.fields) {
      const col = buildColumn(field);
      const colName = toColumnName(field.name);

      if (field.required) {
        if (field.defaultValue !== undefined) {
          columns[colName] = col.notNull().default(field.defaultValue as any);
        } else {
          columns[colName] = col.notNull();
        }
      } else {
        columns[colName] = col;
      }
    }

    // Foreign keys for belongsTo relationships
    if (entity.relationships) {
      for (const rel of entity.relationships) {
        if (rel.type === "belongsTo") {
          const fkName =
            rel.foreignKey ??
            toColumnName(rel.as ?? rel.entity) + "_id";
          // Only add if not already defined by a field
          if (!columns[fkName]) {
            columns[fkName] = uuid(fkName);
          }
        }
      }
    }

    return columns;
  });

  tableRegistry.set(entity.name, table);
  return table;
}

/**
 * Retrieves a previously built table schema by entity name.
 */
export function getTableSchema(
  entityName: string
): PgTableWithColumns<any> | undefined {
  return tableRegistry.get(entityName);
}

/**
 * Returns all registered table schemas.
 */
export function getAllTableSchemas(): Map<string, PgTableWithColumns<any>> {
  return tableRegistry;
}

/**
 * Clears all registered table schemas.
 * Used for test isolation — prevents schema state from leaking between tests.
 */
export function clearTableRegistry(): void {
  tableRegistry.clear();
}
