/**
 * Audit Log Query
 *
 * Reads from the audit_log table with tenant-scoped filtering, pagination,
 * and optional entity/action/date range filters.
 *
 * The write side lives in index.ts (writeAuditLog). This module handles reads.
 */

import { getDatabase } from "../database/connection.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogQuery {
  tenantId: string;
  userId?: string;
  actionId?: string;
  /** Matches actionId prefix, e.g. "contact" matches "contact.create" */
  entity?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  actionId: string;
  success: boolean;
  durationMs: number;
  input: unknown;
  error: string | null;
  createdAt: string;
}

export interface AuditLogResult {
  data: AuditLogEntry[];
  total: number;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Query the audit log with filters and pagination.
 * Always scoped to a tenant for multi-tenancy isolation.
 */
export async function queryAuditLog(query: AuditLogQuery): Promise<AuditLogResult> {
  const { sql: pgSql } = getDatabase();

  const conditions: string[] = ["tenant_id = $1"];
  const params: (string | boolean | number)[] = [query.tenantId];
  let paramIndex = 2;

  if (query.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(query.userId);
  }

  if (query.actionId) {
    conditions.push(`action_id = $${paramIndex++}`);
    params.push(query.actionId);
  }

  if (query.entity) {
    conditions.push(`action_id LIKE $${paramIndex++}`);
    params.push(`${query.entity}.%`);
  }

  if (query.success !== undefined) {
    conditions.push(`success = $${paramIndex++}`);
    params.push(query.success);
  }

  if (query.dateFrom) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(query.dateFrom);
  }

  if (query.dateTo) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(query.dateTo);
  }

  const where = conditions.join(" AND ");
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  // Count total matching rows
  const countRows = await pgSql.unsafe(
    `SELECT COUNT(*)::int AS count FROM audit_log WHERE ${where}`,
    params as any[]
  );

  // Fetch paginated data
  const dataRows = await pgSql.unsafe(
    `SELECT id, tenant_id, user_id, action_id, success, duration_ms, input, error, created_at
     FROM audit_log WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset] as any[]
  );

  return {
    data: dataRows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      actionId: row.action_id,
      success: row.success,
      durationMs: row.duration_ms ?? 0,
      input: row.input,
      error: row.error ?? null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })),
    total: countRows[0].count,
  };
}
