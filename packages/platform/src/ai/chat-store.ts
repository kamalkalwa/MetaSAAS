/**
 * Chat Store — Database persistence for AI chat sessions and messages.
 *
 * This is a platform-level data access layer. It uses raw SQL (via postgres.js)
 * instead of the entity DatabaseClient because chat sessions are infrastructure,
 * not domain entities.
 *
 * All queries are scoped by tenant_id for multi-tenancy isolation.
 *
 * Table schema:
 *   chat_sessions: id, tenant_id, user_id, title, created_at, updated_at
 *   chat_messages: id, session_id, role, content, action_id, result_data, is_error, created_at
 */

import { getDatabase } from "../core/database/connection.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A chat session (conversation thread) */
export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single message within a session */
export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  actionId: string | null;
  resultData: unknown | null;
  isError: boolean;
  createdAt: string;
}

/** Input for creating a new session */
export interface CreateSessionInput {
  tenantId: string;
  userId: string;
  title?: string;
}

/** Input for adding a message to a session */
export interface CreateMessageInput {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  actionId?: string;
  resultData?: unknown;
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Session operations
// ---------------------------------------------------------------------------

/**
 * Creates a new chat session.
 * Returns the created session with its generated UUID.
 */
export async function createSession(input: CreateSessionInput): Promise<ChatSession> {
  const { sql } = getDatabase();
  const rows = await sql.unsafe(
    `INSERT INTO chat_sessions (tenant_id, user_id, title)
     VALUES ($1, $2, $3)
     RETURNING id, tenant_id, user_id, title, created_at, updated_at`,
    [input.tenantId, input.userId, input.title ?? null]
  );
  return mapSession(rows[0]);
}

/**
 * Lists chat sessions for a user, ordered by most recent first.
 * Pagination via limit + offset.
 */
export async function listSessions(
  tenantId: string,
  userId: string,
  limit = 20,
  offset = 0
): Promise<ChatSession[]> {
  const { sql } = getDatabase();
  const rows = await sql.unsafe(
    `SELECT id, tenant_id, user_id, title, created_at, updated_at
     FROM chat_sessions
     WHERE tenant_id = $1 AND user_id = $2
     ORDER BY updated_at DESC
     LIMIT $3 OFFSET $4`,
    [tenantId, userId, limit, offset]
  );
  return rows.map(mapSession);
}

/**
 * Gets a single session by ID, scoped by tenant.
 */
export async function getSession(
  sessionId: string,
  tenantId: string
): Promise<ChatSession | null> {
  const { sql } = getDatabase();
  const rows = await sql.unsafe(
    `SELECT id, tenant_id, user_id, title, created_at, updated_at
     FROM chat_sessions
     WHERE id = $1 AND tenant_id = $2`,
    [sessionId, tenantId]
  );
  return rows.length > 0 ? mapSession(rows[0]) : null;
}

/**
 * Updates a session's title and bumps updated_at.
 */
export async function updateSessionTitle(
  sessionId: string,
  tenantId: string,
  title: string
): Promise<ChatSession | null> {
  const { sql } = getDatabase();
  const rows = await sql.unsafe(
    `UPDATE chat_sessions
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, tenant_id, user_id, title, created_at, updated_at`,
    [title, sessionId, tenantId]
  );
  return rows.length > 0 ? mapSession(rows[0]) : null;
}

/**
 * Deletes a session and all its messages (CASCADE).
 */
export async function deleteSession(
  sessionId: string,
  tenantId: string
): Promise<boolean> {
  const { sql } = getDatabase();
  const result = await sql.unsafe(
    `DELETE FROM chat_sessions WHERE id = $1 AND tenant_id = $2`,
    [sessionId, tenantId]
  );
  return result.count > 0;
}

// ---------------------------------------------------------------------------
// Message operations
// ---------------------------------------------------------------------------

/**
 * Adds a message to a session. Also bumps the session's updated_at.
 */
export async function createMessage(input: CreateMessageInput): Promise<ChatMessageRecord> {
  const { sql } = getDatabase();

  // Insert message
  const rows = await sql.unsafe(
    `INSERT INTO chat_messages (session_id, role, content, action_id, result_data, is_error)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, session_id, role, content, action_id, result_data, is_error, created_at`,
    [
      input.sessionId,
      input.role,
      input.content,
      input.actionId ?? null,
      input.resultData ? JSON.stringify(input.resultData) : null,
      input.isError ?? false,
    ]
  );

  // Bump session's updated_at
  await sql.unsafe(
    `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1`,
    [input.sessionId]
  );

  return mapMessage(rows[0]);
}

/**
 * Lists all messages in a session, ordered chronologically.
 */
export async function listMessages(sessionId: string): Promise<ChatMessageRecord[]> {
  const { sql } = getDatabase();
  const rows = await sql.unsafe(
    `SELECT id, session_id, role, content, action_id, result_data, is_error, created_at
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows.map(mapMessage);
}

// ---------------------------------------------------------------------------
// Row mappers (snake_case → camelCase)
// ---------------------------------------------------------------------------

function mapSession(row: Record<string, unknown>): ChatSession {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string,
    title: (row.title as string) ?? null,
    // Defensive: postgres.js returns Date objects in standalone Node,
    // but tsx watch (esbuild) may return ISO strings instead.
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

function mapMessage(row: Record<string, unknown>): ChatMessageRecord {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    actionId: (row.action_id as string) ?? null,
    resultData: row.result_data ?? null,
    isError: (row.is_error as boolean) ?? false,
    // Defensive: handle both Date objects and ISO strings from postgres.js
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}
