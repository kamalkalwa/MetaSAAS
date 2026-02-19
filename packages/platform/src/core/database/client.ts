/**
 * Database Client
 *
 * Implements the DatabaseClient interface from contracts.
 * Provides a simple, entity-aware data access layer that
 * actions use to read/write data.
 *
 * This is the concrete implementation of the abstract interface.
 * Actions never import this directly — they receive it via ActionContext.
 */

import { eq, sql, and, type SQL } from "drizzle-orm";
import type { DatabaseClient } from "@metasaas/contracts";
import { getDatabase } from "./connection.js";
import { getTableSchema, toColumnName, fromColumnName } from "./schema-builder.js";

/**
 * Converts a database row from snake_case keys to camelCase keys.
 * Ensures the API contract is always camelCase — consumers never
 * see database column naming conventions.
 */
function mapRowToCamelCase(
  row: Record<string, unknown>
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[fromColumnName(key)] = value;
  }
  return mapped;
}

/**
 * Coerces values to match Drizzle column expectations before insert/update.
 *
 * Drizzle's PgTimestamp.mapToDriverValue calls value.toISOString(), which
 * means it expects a Date object — not an ISO string. When the API receives
 * date values as strings (which is the standard JSON representation), we
 * need to convert them to Date objects before passing to Drizzle.
 *
 * This function checks each column in the table schema and coerces string
 * values to Date objects for timestamp columns.
 */
function coerceValues(
  table: Record<string, any>,
  data: Record<string, unknown>
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const column = table[key];
    // Drizzle timestamp columns have columnType = "PgTimestamp" or dataType = "date"
    if (
      column &&
      typeof value === "string" &&
      (column.columnType === "PgTimestamp" || column.dataType === "date")
    ) {
      const parsed = new Date(value);
      // Only coerce if the string is actually a valid date
      coerced[key] = isNaN(parsed.getTime()) ? value : parsed;
    } else {
      coerced[key] = value;
    }
  }
  return coerced;
}

/**
 * Creates a DatabaseClient instance scoped to a tenant.
 * Every query is automatically filtered by tenant_id for data isolation.
 * This is called by the Action Bus when constructing the ActionContext.
 *
 * @param tenantId - The tenant to scope all queries to. Required for data isolation.
 */
export function createDatabaseClient(tenantId: string): DatabaseClient {
  return {
    async findMany(entityName, options) {
      const { db } = getDatabase();
      const table = getTableSchema(entityName);
      if (!table) throw new Error(`Unknown entity: ${entityName}`);

      let query = db.select().from(table).$dynamic();

      // Apply WHERE filters (always include tenant_id for isolation)
      const conditions: SQL[] = [eq(table.tenant_id, tenantId)];

      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          const colName = toColumnName(key);
          if (table[colName]) {
            conditions.push(eq(table[colName], value as any));
          }
        }
      }
      query = query.where(and(...conditions));

      // Apply ORDER BY
      if (options?.orderBy) {
        const colName = toColumnName(options.orderBy.field);
        if (table[colName]) {
          const col = table[colName];
          query = query.orderBy(
            options.orderBy.direction === "desc"
              ? sql`${col} desc`
              : sql`${col} asc`
          );
        }
      }

      // Apply LIMIT and OFFSET
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.offset(options.offset);
      }

      const rows = await query;
      return (rows as Record<string, unknown>[]).map(mapRowToCamelCase);
    },

    async findById(entityName, id) {
      const { db } = getDatabase();
      const table = getTableSchema(entityName);
      if (!table) throw new Error(`Unknown entity: ${entityName}`);

      const rows = await db
        .select()
        .from(table)
        .where(and(eq(table.id, id), eq(table.tenant_id, tenantId)))
        .limit(1);

      return rows[0] ? mapRowToCamelCase(rows[0] as Record<string, unknown>) : null;
    },

    async create(entityName, data) {
      const { db } = getDatabase();
      const table = getTableSchema(entityName);
      if (!table) throw new Error(`Unknown entity: ${entityName}`);

      // Map camelCase field names to snake_case column names
      const mapped: Record<string, unknown> = {
        tenant_id: tenantId,
      };
      for (const [key, value] of Object.entries(data)) {
        mapped[toColumnName(key)] = value;
      }

      // Coerce string dates to Date objects for Drizzle timestamp columns
      const coerced = coerceValues(table, mapped);
      const rows = await db.insert(table).values(coerced).returning();
      return mapRowToCamelCase(rows[0] as Record<string, unknown>);
    },

    async update(entityName, id, data) {
      const { db } = getDatabase();
      const table = getTableSchema(entityName);
      if (!table) throw new Error(`Unknown entity: ${entityName}`);

      const mapped: Record<string, unknown> = {
        updated_at: new Date(),
      };
      for (const [key, value] of Object.entries(data)) {
        mapped[toColumnName(key)] = value;
      }

      // Coerce string dates to Date objects for Drizzle timestamp columns
      const coerced = coerceValues(table, mapped);
      const rows = await db
        .update(table)
        .set(coerced)
        .where(and(eq(table.id, id), eq(table.tenant_id, tenantId)))
        .returning();

      return mapRowToCamelCase(rows[0] as Record<string, unknown>);
    },

    async delete(entityName, id) {
      const { db } = getDatabase();
      const table = getTableSchema(entityName);
      if (!table) throw new Error(`Unknown entity: ${entityName}`);

      const rows = await db
        .delete(table)
        .where(and(eq(table.id, id), eq(table.tenant_id, tenantId)))
        .returning();

      return rows.length > 0;
    },

    async count(entityName, where) {
      const { db } = getDatabase();
      const table = getTableSchema(entityName);
      if (!table) throw new Error(`Unknown entity: ${entityName}`);

      let query = db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .$dynamic();

      // Always include tenant_id for isolation
      const conditions: SQL[] = [eq(table.tenant_id, tenantId)];

      if (where) {
        for (const [key, value] of Object.entries(where)) {
          const colName = toColumnName(key);
          if (table[colName]) {
            conditions.push(eq(table[colName], value as any));
          }
        }
      }
      query = query.where(and(...conditions));

      const rows = await query;
      return rows[0]?.count ?? 0;
    },
  };
}
