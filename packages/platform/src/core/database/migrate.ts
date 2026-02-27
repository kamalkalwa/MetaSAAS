/**
 * Migration Runner
 *
 * Creates and evolves database tables from registered entity schemas.
 *
 * Capabilities:
 *   1. CREATE TABLE IF NOT EXISTS — for new entities
 *   2. ALTER TABLE ADD COLUMN — for new fields added to existing entities
 *   3. ALTER COLUMN TYPE — for safe type changes (widening conversions)
 *   4. Logs warnings for removed fields (does NOT drop columns — data safety)
 *   5. Logs warnings for unsafe type changes (narrowing conversions)
 *
 * SECURITY: All values are sanitized before being included in SQL.
 * Table names and column names are validated against a safe character set.
 * Default values are type-checked and escaped — never raw-interpolated.
 */

import { sql } from "drizzle-orm";
import { getDatabase } from "./connection.js";
import { getAllTableSchemas, toTableName, toColumnName } from "./schema-builder.js";
import type { EntityDefinition, FieldDefinition } from "@metasaas/contracts";

/**
 * Validates that a SQL identifier (table name, column name) contains
 * only safe characters. Prevents SQL injection through entity/field names.
 *
 * @throws Error if the identifier contains unsafe characters
 */
function validateIdentifier(name: string, context: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid ${context}: "${name}". Identifiers must start with a lowercase letter ` +
      `and contain only lowercase letters, numbers, and underscores.`
    );
  }
}

/**
 * Safely converts a default value to a SQL DEFAULT clause.
 * Validates the value against the field type to prevent SQL injection.
 *
 * @returns The SQL DEFAULT clause string, or empty string if no default
 */
function buildDefaultClause(field: FieldDefinition): string {
  if (field.defaultValue === undefined) {
    return "";
  }

  const value = field.defaultValue;

  switch (field.type) {
    case "boolean":
      // Boolean defaults must be actual booleans
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        throw new Error(
          `Invalid default value for boolean field "${field.name}": ${String(value)}`
        );
      }
      return ` DEFAULT ${value === true || value === "true" ? "TRUE" : "FALSE"}`;

    case "number":
    case "currency":
    case "percentage": {
      // Numeric defaults must be actual numbers
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(
          `Invalid default value for numeric field "${field.name}": ${String(value)}`
        );
      }
      return ` DEFAULT ${num}`;
    }

    case "enum":
    case "text":
    case "rich_text":
    case "phone":
    case "email":
    case "url": {
      // String defaults: escape single quotes to prevent SQL injection
      const str = String(value).replace(/'/g, "''");
      // Additional safety: reject values containing SQL control characters
      if (/[;\-\-]/.test(String(value)) && String(value).includes("'")) {
        throw new Error(
          `Suspicious default value for field "${field.name}": value contains potential SQL injection characters`
        );
      }
      return ` DEFAULT '${str}'`;
    }

    case "date":
    case "datetime":
      // Date defaults must be valid ISO strings or SQL keywords
      if (String(value).toUpperCase() === "NOW()") {
        return " DEFAULT NOW()";
      }
      // Validate ISO date format
      if (isNaN(Date.parse(String(value)))) {
        throw new Error(
          `Invalid default value for date field "${field.name}": ${String(value)}`
        );
      }
      return ` DEFAULT '${String(value).replace(/'/g, "''")}'`;

    default:
      // Unknown types: escape and use as string
      return ` DEFAULT '${String(value).replace(/'/g, "''")}'`;
  }
}

/**
 * Column metadata from the PostgreSQL information_schema.
 * Includes the SQL data type for comparison during schema evolution.
 */
export interface ColumnInfo {
  name: string;
  /** The PostgreSQL data_type (e.g., "text", "character varying", "numeric") */
  dataType: string;
  /** The character_maximum_length for varchar columns (null for others) */
  maxLength: number | null;
}

/**
 * Fetches the existing column names for a table from the PostgreSQL
 * information_schema. Returns a Set of column names (lowercase).
 */
async function getExistingColumns(
  pgSql: any,
  tableName: string
): Promise<Set<string>> {
  const rows = await pgSql.unsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(rows.map((r: { column_name: string }) => r.column_name));
}

/**
 * Fetches column metadata (name, data_type, max_length) for type comparison.
 */
async function getExistingColumnTypes(
  pgSql: any,
  tableName: string
): Promise<Map<string, ColumnInfo>> {
  const rows = await pgSql.unsafe(
    `SELECT column_name, data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const map = new Map<string, ColumnInfo>();
  for (const r of rows) {
    map.set(r.column_name, {
      name: r.column_name,
      dataType: r.data_type,
      maxLength: r.character_maximum_length ? Number(r.character_maximum_length) : null,
    });
  }
  return map;
}

/**
 * Normalizes a MetaSAAS SQL type to match PostgreSQL information_schema data_type.
 *
 * PostgreSQL information_schema uses different names:
 *   TEXT → "text"
 *   VARCHAR(512) → "character varying"
 *   NUMERIC → "numeric"
 *   TIMESTAMPTZ → "timestamp with time zone"
 *   BOOLEAN → "boolean"
 *   UUID → "uuid"
 */
function normalizeToInfoSchemaType(sqlType: string): { dataType: string; maxLength: number | null } {
  const upper = sqlType.toUpperCase();

  if (upper === "TEXT") return { dataType: "text", maxLength: null };
  if (upper === "BOOLEAN") return { dataType: "boolean", maxLength: null };
  if (upper === "NUMERIC") return { dataType: "numeric", maxLength: null };
  if (upper === "TIMESTAMPTZ") return { dataType: "timestamp with time zone", maxLength: null };
  if (upper === "UUID") return { dataType: "uuid", maxLength: null };

  // VARCHAR(N)
  const varcharMatch = upper.match(/^VARCHAR\((\d+)\)$/);
  if (varcharMatch) {
    return { dataType: "character varying", maxLength: Number(varcharMatch[1]) };
  }

  return { dataType: upper.toLowerCase(), maxLength: null };
}

/**
 * Determines if a type change from existing → expected is safe to perform
 * automatically. Safe means no data loss.
 *
 * Safe conversions (widening):
 *   - VARCHAR(N) → TEXT (always safe, TEXT has no limit)
 *   - VARCHAR(N) → VARCHAR(M) where M > N (wider limit)
 *   - VARCHAR(N) → NUMERIC (if data is numeric, USING handles it)
 *
 * Unsafe conversions (narrowing or lossy):
 *   - TEXT → BOOLEAN (potential data loss)
 *   - TEXT → NUMERIC (non-numeric strings fail)
 *   - NUMERIC → BOOLEAN
 *   - Any → UUID
 *   - Wider → narrower VARCHAR
 *
 * @returns "safe" | "unsafe" with a reason
 */
export function classifyTypeChange(
  existing: ColumnInfo,
  expectedSqlType: string
): { safe: boolean; reason: string } {
  const expected = normalizeToInfoSchemaType(expectedSqlType);

  // Same type — no change needed
  if (existing.dataType === expected.dataType) {
    if (expected.dataType === "character varying" && expected.maxLength !== null) {
      if (existing.maxLength !== null && expected.maxLength > existing.maxLength) {
        return { safe: true, reason: `Widening VARCHAR(${existing.maxLength}) → VARCHAR(${expected.maxLength})` };
      }
      if (existing.maxLength !== null && expected.maxLength < existing.maxLength) {
        return { safe: false, reason: `Narrowing VARCHAR(${existing.maxLength}) → VARCHAR(${expected.maxLength}) may truncate data` };
      }
    }
    return { safe: true, reason: "Same type" };
  }

  // character varying → text (always safe: TEXT is unlimited)
  if (existing.dataType === "character varying" && expected.dataType === "text") {
    return { safe: true, reason: "VARCHAR → TEXT is safe (widening)" };
  }

  // text → character varying (might truncate)
  if (existing.dataType === "text" && expected.dataType === "character varying") {
    return { safe: false, reason: `TEXT → VARCHAR(${expected.maxLength}) may truncate data` };
  }

  // character varying → numeric (might fail for non-numeric strings)
  if (existing.dataType === "character varying" && expected.dataType === "numeric") {
    return { safe: false, reason: "VARCHAR → NUMERIC may fail for non-numeric values" };
  }

  // numeric → text/varchar (safe — numbers always have string representation)
  if (existing.dataType === "numeric" && (expected.dataType === "text" || expected.dataType === "character varying")) {
    return { safe: true, reason: "NUMERIC → text/varchar is safe" };
  }

  // boolean → text (safe)
  if (existing.dataType === "boolean" && expected.dataType === "text") {
    return { safe: true, reason: "BOOLEAN → TEXT is safe" };
  }

  // text/varchar → boolean (unsafe — arbitrary strings can't be boolean)
  if ((existing.dataType === "text" || existing.dataType === "character varying") && expected.dataType === "boolean") {
    return { safe: false, reason: "TEXT/VARCHAR → BOOLEAN may fail for non-boolean values" };
  }

  // timestamp → text (safe)
  if (existing.dataType === "timestamp with time zone" && (expected.dataType === "text" || expected.dataType === "character varying")) {
    return { safe: true, reason: "TIMESTAMPTZ → text is safe" };
  }

  // text → timestamp (unsafe)
  if ((existing.dataType === "text" || existing.dataType === "character varying") && expected.dataType === "timestamp with time zone") {
    return { safe: false, reason: "TEXT → TIMESTAMPTZ may fail for non-date values" };
  }

  // Default: unsafe for any unrecognized conversion
  return { safe: false, reason: `${existing.dataType} → ${expected.dataType} is not a recognized safe conversion` };
}

/**
 * Checks whether a table exists in the public schema.
 */
async function tableExists(pgSql: any, tableName: string): Promise<boolean> {
  const rows = await pgSql.unsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

/**
 * Builds the full set of expected column names for an entity,
 * including system columns (id, created_at, updated_at), entity fields,
 * and foreign key columns from belongsTo relationships.
 */
function getExpectedColumns(entity: EntityDefinition): Map<string, { field: FieldDefinition | null; isFk: boolean; fkRef?: string }> {
  const expected = new Map<string, { field: FieldDefinition | null; isFk: boolean; fkRef?: string }>();

  // System columns (including tenant_id for multi-tenancy)
  expected.set("id", { field: null, isFk: false });
  expected.set("tenant_id", { field: null, isFk: false });
  expected.set("created_at", { field: null, isFk: false });
  expected.set("updated_at", { field: null, isFk: false });

  // Entity fields
  for (const field of entity.fields) {
    expected.set(toColumnName(field.name), { field, isFk: false });
  }

  // Foreign key columns
  if (entity.relationships) {
    for (const rel of entity.relationships) {
      if (rel.type === "belongsTo") {
        const fkName = rel.foreignKey ?? toColumnName(rel.as ?? rel.entity) + "_id";
        if (!expected.has(fkName)) {
          expected.set(fkName, { field: null, isFk: true, fkRef: toTableName(rel.entity) });
        }
      }
    }
  }

  return expected;
}

/**
 * Runs migrations for all registered entity schemas.
 *
 * For each entity:
 *   1. If the table doesn't exist → CREATE TABLE
 *   2. If the table exists → diff columns and ALTER TABLE ADD COLUMN for new ones
 *   3. Log warnings for columns that exist in DB but not in the entity (removed fields)
 *
 * SECURITY: All identifiers are validated, all values are escaped.
 */
export async function runMigrations(entities: EntityDefinition[]) {
  const { sql: pgSql } = getDatabase();

  for (const entity of entities) {
    const tableName = toTableName(entity.name);
    validateIdentifier(tableName, "table name");

    const exists = await tableExists(pgSql, tableName);

    if (!exists) {
      // ── CREATE TABLE ──────────────────────────────────────────────
      const columnDefs: string[] = [
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
        "tenant_id UUID NOT NULL",
        "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ];

      for (const field of entity.fields) {
        const colName = toColumnName(field.name);
        validateIdentifier(colName, `column name for field "${field.name}"`);
        const sqlType = fieldTypeToSQL(field.type);
        const notNull = field.required ? " NOT NULL" : "";
        const defaultClause = buildDefaultClause(field);
        columnDefs.push(`${colName} ${sqlType}${notNull}${defaultClause}`);
      }

      if (entity.relationships) {
        for (const rel of entity.relationships) {
          if (rel.type === "belongsTo") {
            const fkName = rel.foreignKey ?? toColumnName(rel.as ?? rel.entity) + "_id";
            validateIdentifier(fkName, `foreign key for relationship to "${rel.entity}"`);
            if (!entity.fields.some((f) => toColumnName(f.name) === fkName)) {
              const referencedTable = toTableName(rel.entity);
              columnDefs.push(`${fkName} UUID REFERENCES ${referencedTable}(id) ON DELETE SET NULL`);
            }
          }
        }
      }

      const createSQL = `CREATE TABLE ${tableName} (\n  ${columnDefs.join(",\n  ")}\n)`;
      await pgSql.unsafe(createSQL);
      console.log(`[migrate] Created table: ${tableName}`);
    } else {
      // ── ALTER TABLE (schema evolution) ────────────────────────────
      const existingCols = await getExistingColumns(pgSql, tableName);
      const expectedCols = getExpectedColumns(entity);
      let addedCount = 0;

      // Add new columns that don't exist yet
      for (const [colName, meta] of expectedCols) {
        if (!existingCols.has(colName)) {
          validateIdentifier(colName, `new column for "${entity.name}"`);

          let alterSQL: string;
          if (meta.isFk && meta.fkRef) {
            // Foreign key column
            validateIdentifier(meta.fkRef, `referenced table for FK "${colName}"`);
            alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${colName} UUID REFERENCES ${meta.fkRef}(id) ON DELETE SET NULL`;
          } else if (meta.field) {
            // Regular field column
            const sqlType = fieldTypeToSQL(meta.field.type);
            // New columns on existing tables must be nullable or have a default
            // to avoid breaking existing rows. If the field is required AND has
            // no default, we add it as nullable and log a warning.
            const hasDefault = meta.field.defaultValue !== undefined;
            const notNull = meta.field.required && hasDefault ? " NOT NULL" : "";
            const defaultClause = buildDefaultClause(meta.field);

            if (meta.field.required && !hasDefault) {
              console.warn(
                `[migrate] WARNING: Adding required field "${meta.field.name}" to existing table "${tableName}" without a default. ` +
                `Column will be nullable to avoid breaking existing rows. Consider adding a defaultValue.`
              );
            }

            alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${colName} ${sqlType}${notNull}${defaultClause}`;
          } else if (colName === "tenant_id") {
            // Multi-tenancy system column — add as nullable for existing rows,
            // then backfill with a default tenant and add NOT NULL constraint.
            alterSQL = `ALTER TABLE ${tableName} ADD COLUMN tenant_id UUID`;
            await pgSql.unsafe(alterSQL);
            // Backfill existing rows with the dev tenant ID
            await pgSql.unsafe(
              `UPDATE ${tableName} SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL`
            );
            // Now add the NOT NULL constraint
            await pgSql.unsafe(
              `ALTER TABLE ${tableName} ALTER COLUMN tenant_id SET NOT NULL`
            );
            addedCount++;
            console.log(`[migrate] Added system column: ${tableName}.tenant_id (backfilled existing rows)`);
            continue;
          } else {
            // Other system column somehow missing — skip (shouldn't happen)
            continue;
          }

          await pgSql.unsafe(alterSQL);
          addedCount++;
          console.log(`[migrate] Added column: ${tableName}.${colName}`);
        }
      }

      // Check for type changes on existing columns
      const existingColTypes = await getExistingColumnTypes(pgSql, tableName);
      let alteredCount = 0;

      for (const [colName, meta] of expectedCols) {
        // Only check entity fields (not system columns or FKs)
        if (!meta.field || meta.isFk) continue;
        if (!existingCols.has(colName)) continue;

        const existingInfo = existingColTypes.get(colName);
        if (!existingInfo) continue;

        const expectedSqlType = fieldTypeToSQL(meta.field.type);
        const classification = classifyTypeChange(existingInfo, expectedSqlType);

        // Skip if types already match
        if (classification.reason === "Same type") continue;

        if (classification.safe) {
          // Safe conversion — execute automatically
          validateIdentifier(colName, `column to alter in "${tableName}"`);
          const alterSQL = `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${expectedSqlType} USING ${colName}::${expectedSqlType}`;
          await pgSql.unsafe(alterSQL);
          alteredCount++;
          console.log(`[migrate] Altered column type: ${tableName}.${colName} (${classification.reason})`);
        } else {
          // Unsafe conversion — log warning, require manual intervention
          console.warn(
            `[migrate] WARNING: Column "${tableName}.${colName}" type mismatch. ` +
            `DB has "${existingInfo.dataType}", entity expects "${expectedSqlType}". ` +
            `Skipping: ${classification.reason}. Alter manually if needed.`
          );
        }
      }

      if (alteredCount > 0) {
        console.log(`[migrate] Altered ${alteredCount} column type(s) in "${tableName}"`);
      }

      // Warn about columns in DB that aren't in the entity definition
      // (never drop — data safety first)
      for (const existingCol of existingCols) {
        if (!expectedCols.has(existingCol)) {
          console.warn(
            `[migrate] WARNING: Column "${tableName}.${existingCol}" exists in DB but not in entity definition. ` +
            `It will NOT be dropped. Remove manually if no longer needed.`
          );
        }
      }

      if (addedCount > 0) {
        console.log(`[migrate] Evolved table "${tableName}": added ${addedCount} column(s)`);
      }
    }
  }
}

/**
 * Runs platform-level migrations for infrastructure tables.
 * These tables are NOT domain entities — they're part of the platform itself.
 *
 * Platform tables:
 *   - chat_sessions: AI chat session metadata (user, title, timestamps)
 *   - chat_messages: Individual messages within a session
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS.
 */
export async function runPlatformMigrations() {
  const { sql: pgSql } = getDatabase();

  // Chat sessions — tracks conversations
  const sessionsExists = await tableExists(pgSql, "chat_sessions");
  if (!sessionsExists) {
    await pgSql.unsafe(`
      CREATE TABLE chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE INDEX idx_chat_sessions_user ON chat_sessions(tenant_id, user_id, created_at DESC)`
    );
    console.log("[migrate] Created platform table: chat_sessions");
  }

  // Chat messages — individual messages within sessions
  const messagesExists = await tableExists(pgSql, "chat_messages");
  if (!messagesExists) {
    await pgSql.unsafe(`
      CREATE TABLE chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        action_id TEXT,
        result_data JSONB,
        is_error BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at)`
    );
    console.log("[migrate] Created platform table: chat_messages");
  }

  // Audit log — persistent record of all action executions
  const auditExists = await tableExists(pgSql, "audit_log");
  if (!auditExists) {
    await pgSql.unsafe(`
      CREATE TABLE audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        duration_ms INTEGER,
        input JSONB,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC)`
    );
    await pgSql.unsafe(
      `CREATE INDEX idx_audit_log_action ON audit_log(action_id, created_at DESC)`
    );
    console.log("[migrate] Created platform table: audit_log");
  }

  // Webhooks — registered HTTP callbacks for domain events
  const webhooksExists = await tableExists(pgSql, "webhooks");
  if (!webhooksExists) {
    await pgSql.unsafe(`
      CREATE TABLE webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id)`
    );
    await pgSql.unsafe(
      `CREATE INDEX idx_webhooks_event ON webhooks(tenant_id, event_type)`
    );
    console.log("[migrate] Created platform table: webhooks");
  }

  // Webhook deliveries — log of HTTP POST attempts and their outcomes
  const deliveriesExists = await tableExists(pgSql, "webhook_deliveries");
  if (!deliveriesExists) {
    await pgSql.unsafe(`
      CREATE TABLE webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        status_code INTEGER,
        attempt INTEGER NOT NULL DEFAULT 1,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC)`
    );
    console.log("[migrate] Created platform table: webhook_deliveries");
  }

  // Notifications — in-app notification center
  const notificationsExists = await tableExists(pgSql, "notifications");
  if (!notificationsExists) {
    await pgSql.unsafe(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'info',
        link TEXT,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE INDEX idx_notifications_user ON notifications(tenant_id, user_id, created_at DESC)`
    );
    await pgSql.unsafe(
      `CREATE INDEX idx_notifications_unread ON notifications(tenant_id, user_id, read) WHERE read = FALSE`
    );
    console.log("[migrate] Created platform table: notifications");
  }

  // Subscriptions — Stripe billing subscription records
  const subscriptionsExists = await tableExists(pgSql, "subscriptions");
  if (!subscriptionsExists) {
    await pgSql.unsafe(`
      CREATE TABLE subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE,
        stripe_customer_id TEXT NOT NULL,
        stripe_subscription_id TEXT UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[migrate] Created platform table: subscriptions");
  }

  // Invoices — Stripe invoice records
  const invoicesExists = await tableExists(pgSql, "invoices");
  if (!invoicesExists) {
    await pgSql.unsafe(`
      CREATE TABLE invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        stripe_invoice_id TEXT NOT NULL UNIQUE,
        amount_due INTEGER NOT NULL,
        amount_paid INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'usd',
        status VARCHAR(50) NOT NULL,
        invoice_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[migrate] Created platform table: invoices");
  }

  // Plans — subscription tier definitions (admin-managed)
  const plansExists = await tableExists(pgSql, "plans");
  if (!plansExists) {
    await pgSql.unsafe(`
      CREATE TABLE plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price_cents INTEGER NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'usd',
        interval VARCHAR(20) NOT NULL DEFAULT 'month',
        stripe_price_id TEXT,
        features JSONB NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgSql.unsafe(
      `CREATE UNIQUE INDEX idx_plans_stripe_price ON plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL`
    );
    await pgSql.unsafe(
      `CREATE INDEX idx_plans_active_sort ON plans(is_active, sort_order)`
    );
    console.log("[migrate] Created platform table: plans");
  }
}

/**
 * Maps a MetaSAAS field type to a PostgreSQL column type.
 */
function fieldTypeToSQL(type: string): string {
  switch (type) {
    case "text":
    case "rich_text":
    case "phone":
      return "TEXT";
    case "email":
    case "url":
      return "VARCHAR(512)";
    case "currency":
    case "number":
    case "percentage":
      return "NUMERIC";
    case "date":
    case "datetime":
      return "TIMESTAMPTZ";
    case "boolean":
      return "BOOLEAN";
    case "enum":
      return "VARCHAR(255)";
    default:
      return "TEXT";
  }
}
