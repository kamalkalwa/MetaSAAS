/**
 * Webhook System
 *
 * Dispatches HTTP POST requests to registered URLs when domain events fire.
 * Integrates with the Event Bus as a wildcard subscriber that routes
 * events to matching webhook registrations.
 *
 * Features:
 *   - Register webhooks per event type (e.g., "task.created", "*")
 *   - Automatic retry with exponential backoff (3 attempts)
 *   - Payload includes event type, data, and timestamp
 *   - Persistent storage via PostgreSQL (webhooks + webhook_deliveries tables)
 *   - Graceful fallback to in-memory when database is unavailable (tests)
 */

import { subscribe } from "../event-bus/index.js";
import type { DomainEvent } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookRegistration {
  id: string;
  /** The event type to listen for (e.g., "task.created", "*" for all) */
  eventType: string;
  /** The URL to POST to when the event fires */
  url: string;
  /** Optional secret for HMAC signature verification */
  secret?: string;
  /** Whether this webhook is active */
  active: boolean;
  /** Tenant scope */
  tenantId: string;
  createdAt: Date;
}

export interface WebhookDelivery {
  webhookId: string;
  eventType: string;
  url: string;
  status: "success" | "failed";
  statusCode?: number;
  attempt: number;
  error?: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

// ---------------------------------------------------------------------------
// Database helpers — lazy import to avoid circular deps at module load
// ---------------------------------------------------------------------------

function getDb() {
  try {
    const { getDatabase } = require("../database/connection.js");
    return getDatabase().sql;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (used when DB is not yet initialized, e.g. in tests)
// ---------------------------------------------------------------------------

const memoryWebhooks = new Map<string, WebhookRegistration>();
const memoryDeliveryLog: WebhookDelivery[] = [];
const MAX_MEMORY_LOG = 1000;

// ---------------------------------------------------------------------------
// Public API — CRUD
// ---------------------------------------------------------------------------

export async function registerWebhook(
  registration: Omit<WebhookRegistration, "id" | "createdAt">
): Promise<WebhookRegistration> {
  const pgSql = getDb();

  if (pgSql) {
    const rows = await pgSql.unsafe(
      `INSERT INTO webhooks (tenant_id, event_type, url, secret, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, event_type, url, secret, active, created_at`,
      [
        registration.tenantId,
        registration.eventType,
        registration.url,
        registration.secret ?? null,
        registration.active,
      ]
    );
    return rowToWebhook(rows[0]);
  }

  // Fallback: in-memory
  const id = crypto.randomUUID();
  const webhook: WebhookRegistration = {
    ...registration,
    id,
    createdAt: new Date(),
  };
  memoryWebhooks.set(id, webhook);
  return webhook;
}

export async function removeWebhook(id: string): Promise<boolean> {
  const pgSql = getDb();

  if (pgSql) {
    const result = await pgSql.unsafe(
      `DELETE FROM webhooks WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.length > 0;
  }

  return memoryWebhooks.delete(id);
}

export async function listWebhooks(tenantId: string): Promise<WebhookRegistration[]> {
  const pgSql = getDb();

  if (pgSql) {
    const rows = await pgSql.unsafe(
      `SELECT id, tenant_id, event_type, url, secret, active, created_at
       FROM webhooks
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return rows.map(rowToWebhook);
  }

  return Array.from(memoryWebhooks.values()).filter((w) => w.tenantId === tenantId);
}

export async function getDeliveryLog(webhookId?: string): Promise<WebhookDelivery[]> {
  const pgSql = getDb();

  if (pgSql) {
    const query = webhookId
      ? `SELECT webhook_id, event_type, url, status, status_code, attempt, error, created_at
         FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 100`
      : `SELECT webhook_id, event_type, url, status, status_code, attempt, error, created_at
         FROM webhook_deliveries ORDER BY created_at DESC LIMIT 100`;

    const rows = webhookId
      ? await pgSql.unsafe(query, [webhookId])
      : await pgSql.unsafe(query);

    return rows.map(rowToDelivery);
  }

  if (webhookId) return memoryDeliveryLog.filter((d) => d.webhookId === webhookId);
  return [...memoryDeliveryLog];
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToWebhook(row: Record<string, unknown>): WebhookRegistration {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    eventType: row.event_type as string,
    url: row.url as string,
    secret: (row.secret as string) || undefined,
    active: row.active as boolean,
    createdAt: new Date(row.created_at as string),
  };
}

function rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    webhookId: row.webhook_id as string,
    eventType: row.event_type as string,
    url: row.url as string,
    status: row.status as "success" | "failed",
    statusCode: row.status_code as number | undefined,
    attempt: row.attempt as number,
    error: (row.error as string) || undefined,
    timestamp: new Date(row.created_at as string),
  };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

async function deliverWebhook(
  webhook: WebhookRegistration,
  event: DomainEvent,
  attempt: number = 1
): Promise<void> {
  const payload = JSON.stringify({
    event: event.type,
    data: event.payload,
    timestamp: event.timestamp?.toISOString() ?? new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-MetaSAAS-Event": event.type,
    "X-MetaSAAS-Delivery": crypto.randomUUID(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    await logDelivery({
      webhookId: webhook.id,
      eventType: event.type,
      url: webhook.url,
      status: response.ok ? "success" : "failed",
      statusCode: response.status,
      attempt,
      timestamp: new Date(),
    });

    if (!response.ok && response.status >= 500 && attempt < MAX_RETRIES) {
      await delay(RETRY_DELAYS[attempt - 1] ?? 15000);
      return deliverWebhook(webhook, event, attempt + 1);
    }
  } catch (error) {
    await logDelivery({
      webhookId: webhook.id,
      eventType: event.type,
      url: webhook.url,
      status: "failed",
      attempt,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    });

    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAYS[attempt - 1] ?? 15000);
      return deliverWebhook(webhook, event, attempt + 1);
    }
  }
}

async function logDelivery(delivery: WebhookDelivery): Promise<void> {
  const pgSql = getDb();

  if (pgSql) {
    try {
      await pgSql.unsafe(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, url, status, status_code, attempt, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          delivery.webhookId,
          delivery.eventType,
          delivery.url,
          delivery.status,
          delivery.statusCode ?? null,
          delivery.attempt,
          delivery.error ?? null,
        ]
      );
    } catch {
      // Fire-and-forget — delivery logging never breaks webhook dispatch
    }
    return;
  }

  // Fallback: in-memory
  memoryDeliveryLog.push(delivery);
  if (memoryDeliveryLog.length > MAX_MEMORY_LOG) {
    memoryDeliveryLog.splice(0, memoryDeliveryLog.length - MAX_MEMORY_LOG);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Internal helper — get active webhooks matching an event (for dispatch)
// ---------------------------------------------------------------------------

async function getMatchingWebhooks(eventType: string): Promise<WebhookRegistration[]> {
  const pgSql = getDb();

  if (pgSql) {
    const rows = await pgSql.unsafe(
      `SELECT id, tenant_id, event_type, url, secret, active, created_at
       FROM webhooks
       WHERE active = TRUE AND (event_type = $1 OR event_type = '*')`,
      [eventType]
    );
    return rows.map(rowToWebhook);
  }

  return Array.from(memoryWebhooks.values()).filter(
    (w) => w.active && (w.eventType === eventType || w.eventType === "*")
  );
}

// ---------------------------------------------------------------------------
// Event Bus Integration
// ---------------------------------------------------------------------------

/**
 * Initializes the webhook system by subscribing to the Event Bus.
 * Call once at startup.
 */
export function initWebhooks(): void {
  subscribe({
    name: "webhook-dispatcher",
    eventType: "*",
    async handler(event: DomainEvent) {
      const matching = await getMatchingWebhooks(event.type);
      await Promise.allSettled(
        matching.map((w) => deliverWebhook(w, event))
      );
    },
  });
}
