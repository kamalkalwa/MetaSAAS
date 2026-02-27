/**
 * Persistent Audit Logger
 *
 * Records every action execution to the audit_log database table.
 * This provides a tamper-resistant, queryable audit trail for compliance,
 * debugging, and security analysis.
 *
 * Design:
 *   - Fire-and-forget — audit logging never blocks or breaks action execution
 *   - Fail-safe — if the database write fails, the error is logged to stdout
 *   - Automatic — wired into the Action Bus, no domain code needed
 */

import { getDatabase } from "../database/connection.js";

// Re-export query functionality
export { queryAuditLog, type AuditLogQuery, type AuditLogEntry, type AuditLogResult } from "./query.js";

/**
 * Records an action execution in the persistent audit log.
 * Called by the Action Bus after every dispatch (success or failure).
 *
 * This function is fire-and-forget — it never throws.
 */
export async function writeAuditLog(entry: {
  tenantId: string;
  userId: string;
  actionId: string;
  success: boolean;
  durationMs: number;
  input?: unknown;
  error?: string;
}): Promise<void> {
  try {
    const { sql: pgSql } = getDatabase();

    // Truncate input to prevent storing massive payloads (e.g., file uploads).
    // The audit log stores context for debugging, not full request bodies.
    const inputJson = entry.input
      ? JSON.stringify(entry.input).slice(0, 10_000)
      : null;

    await pgSql.unsafe(
      `INSERT INTO audit_log (tenant_id, user_id, action_id, success, duration_ms, input, error)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        entry.tenantId,
        entry.userId,
        entry.actionId,
        entry.success,
        entry.durationMs,
        inputJson,
        entry.error ?? null,
      ]
    );
  } catch (err) {
    // Audit logging NEVER breaks the application.
    // If the audit table doesn't exist yet (first boot), silently skip.
    const message = err instanceof Error ? err.message : "Unknown error";
    if (!message.includes("does not exist")) {
      console.error("[audit] Failed to write audit log:", message);
    }
  }
}
