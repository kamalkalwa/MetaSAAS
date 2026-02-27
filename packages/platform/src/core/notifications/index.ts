/**
 * Notifications Module
 *
 * In-app notification center with persistent storage.
 * Follows the provider pattern — pluggable backends with a console fallback.
 *
 * Provider: InAppNotificationProvider (PostgreSQL-backed)
 * Fallback: ConsoleNotificationProvider (logs to console, zero deps)
 *
 * Usage:
 *   import { initNotifications, sendNotification, getNotifications } from "./notifications";
 *
 *   initNotifications();  // Call once at startup — auto-detects from env
 *
 *   await sendNotification({
 *     tenantId: "t1", userId: "u1",
 *     title: "New Contact", body: "John Doe was created",
 *     type: "info", link: "/contacts/uuid-123",
 *   });
 *
 *   const { data, total, unread } = await getNotifications("t1", "u1");
 */

import { subscribe } from "../event-bus/index.js";
import type { DomainEvent } from "@metasaas/contracts";
import { getDatabase } from "../database/connection.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationInput {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
}

export interface NotificationListOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResult {
  data: Notification[];
  total: number;
  unread: number;
}

/** The provider contract. Every notification backend implements this. */
export interface NotificationProvider {
  readonly name: string;
  send(input: NotificationInput): Promise<Notification>;
  getForUser(tenantId: string, userId: string, options?: NotificationListOptions): Promise<NotificationListResult>;
  markRead(id: string, tenantId: string): Promise<boolean>;
  markAllRead(tenantId: string, userId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Console Provider (dev fallback — zero deps)
// ---------------------------------------------------------------------------

export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";
  private notifications: Notification[] = [];

  async send(input: NotificationInput): Promise<Notification> {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...input,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(notification);
    console.log(
      `[notifications:console] ${input.type.toUpperCase()}: ${input.title} → user ${input.userId}`
    );
    return notification;
  }

  async getForUser(
    tenantId: string,
    userId: string,
    options?: NotificationListOptions
  ): Promise<NotificationListResult> {
    let filtered = this.notifications.filter(
      (n) => n.tenantId === tenantId && n.userId === userId
    );
    const unread = filtered.filter((n) => !n.read).length;
    const total = filtered.length;

    if (options?.unreadOnly) {
      filtered = filtered.filter((n) => !n.read);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const data = filtered.slice(offset, offset + limit);

    return { data, total, unread };
  }

  async markRead(id: string, tenantId: string): Promise<boolean> {
    const notif = this.notifications.find(
      (n) => n.id === id && n.tenantId === tenantId
    );
    if (!notif) return false;
    notif.read = true;
    return true;
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    let count = 0;
    for (const n of this.notifications) {
      if (n.tenantId === tenantId && n.userId === userId && !n.read) {
        n.read = true;
        count++;
      }
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// InApp Provider (PostgreSQL-backed)
// ---------------------------------------------------------------------------

export class InAppNotificationProvider implements NotificationProvider {
  readonly name = "inapp";

  async send(input: NotificationInput): Promise<Notification> {
    const { sql: pgSql } = getDatabase();

    const rows = await pgSql.unsafe(
      `INSERT INTO notifications (tenant_id, user_id, title, body, type, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, user_id, title, body, type, link, read, created_at`,
      [input.tenantId, input.userId, input.title, input.body, input.type, input.link ?? null]
    );

    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      title: row.title,
      body: row.body,
      type: row.type,
      link: row.link ?? undefined,
      read: row.read,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  async getForUser(
    tenantId: string,
    userId: string,
    options?: NotificationListOptions
  ): Promise<NotificationListResult> {
    const { sql: pgSql } = getDatabase();
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const baseWhere = `WHERE tenant_id = $1 AND user_id = $2`;
    const readFilter = options?.unreadOnly ? ` AND read = FALSE` : "";

    // Get total count
    const totalRows = await pgSql.unsafe(
      `SELECT COUNT(*)::int AS count FROM notifications ${baseWhere}`,
      [tenantId, userId]
    );

    // Get unread count
    const unreadRows = await pgSql.unsafe(
      `SELECT COUNT(*)::int AS count FROM notifications ${baseWhere} AND read = FALSE`,
      [tenantId, userId]
    );

    // Get paginated data
    const dataRows = await pgSql.unsafe(
      `SELECT id, tenant_id, user_id, title, body, type, link, read, created_at
       FROM notifications ${baseWhere}${readFilter}
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, userId, limit, offset]
    );

    return {
      data: dataRows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        type: row.type,
        link: row.link ?? undefined,
        read: row.read,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      })),
      total: totalRows[0].count,
      unread: unreadRows[0].count,
    };
  }

  async markRead(id: string, tenantId: string): Promise<boolean> {
    const { sql: pgSql } = getDatabase();
    const result = await pgSql.unsafe(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND tenant_id = $2 AND read = FALSE`,
      [id, tenantId]
    );
    return result.count > 0;
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    const { sql: pgSql } = getDatabase();
    const result = await pgSql.unsafe(
      `UPDATE notifications SET read = TRUE WHERE tenant_id = $1 AND user_id = $2 AND read = FALSE`,
      [tenantId, userId]
    );
    return result.count;
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let provider: NotificationProvider = new ConsoleNotificationProvider();

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the notifications module.
 * If a database is available, uses the InApp provider (PostgreSQL).
 * Otherwise falls back to console provider.
 *
 * Also subscribes to the Event Bus to auto-generate notifications
 * for entity CRUD events.
 *
 * Safe to call multiple times. Never throws.
 */
export function initNotifications(): void {
  try {
    getDatabase();
    provider = new InAppNotificationProvider();
    console.log("[notifications] Initialized with InApp provider (PostgreSQL)");
  } catch {
    provider = new ConsoleNotificationProvider();
    console.log("[notifications] No database — using console provider");
  }

  // Subscribe to domain events for auto-notifications
  subscribe({
    name: "notification-dispatcher",
    eventType: "*",
    async handler(event: DomainEvent) {
      try {
        // Only handle entity CRUD events (e.g., "contact.created")
        const parts = event.type.split(".");
        if (parts.length !== 2) return;

        const [entityName, action] = parts;
        if (!["created", "updated", "deleted"].includes(action)) return;

        // Extract record data from the event payload (set by CRUD side effects)
        const result = event.payload?.result as Record<string, unknown> | undefined;
        const data = result?.data as Record<string, unknown> | undefined;
        const tenantId = (data?.tenantId ?? event.payload?.tenantId) as string | undefined;
        const userId = (data?.userId ?? event.payload?.userId) as string | undefined;
        if (!tenantId || !userId) return;

        // Build notification content
        const displayName = (data?.name ?? data?.title ?? data?.id ?? "") as string;
        const title = `${entityName} ${action}`;
        const body = displayName
          ? `${entityName} "${displayName}" was ${action}`
          : `A ${entityName} was ${action}`;
        const type: NotificationType = action === "deleted" ? "warning" : "info";
        const recordId = data?.id as string | undefined;
        const link = action !== "deleted" && recordId
          ? `/${entityName.toLowerCase()}s/${recordId}`
          : undefined;

        await provider.send({
          tenantId,
          userId,
          title,
          body,
          type,
          link,
        });
      } catch (err) {
        // Fire-and-forget — never break the event bus
        console.error("[notifications] Auto-notification failed:", err);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Send a notification to a specific user */
export async function sendNotification(input: NotificationInput): Promise<Notification> {
  return provider.send(input);
}

/** Get notifications for a user (paginated) */
export async function getNotifications(
  tenantId: string,
  userId: string,
  options?: NotificationListOptions
): Promise<NotificationListResult> {
  return provider.getForUser(tenantId, userId, options);
}

/** Mark a single notification as read */
export async function markNotificationRead(id: string, tenantId: string): Promise<boolean> {
  return provider.markRead(id, tenantId);
}

/** Mark all notifications as read for a user */
export async function markAllNotificationsRead(tenantId: string, userId: string): Promise<number> {
  return provider.markAllRead(tenantId, userId);
}

/** Get the current notification provider (for testing/inspection) */
export function getNotificationProvider(): NotificationProvider {
  return provider;
}

/** Override the notification provider (for testing) */
export function setNotificationProvider(p: NotificationProvider): void {
  provider = p;
}

// ---------------------------------------------------------------------------
// Testing Helpers
// ---------------------------------------------------------------------------

/** Reset notification module state (for testing only) */
export function resetNotifications(): void {
  provider = new ConsoleNotificationProvider();
}
