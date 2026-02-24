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
 *   - Thread-safe in-memory store (production: swap for DB-backed store)
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
// Store (in-memory — swap for DB-backed in production)
// ---------------------------------------------------------------------------

const webhooks = new Map<string, WebhookRegistration>();
const deliveryLog: WebhookDelivery[] = [];

const MAX_DELIVERY_LOG = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

export function registerWebhook(registration: Omit<WebhookRegistration, "id" | "createdAt">): WebhookRegistration {
  const id = crypto.randomUUID();
  const webhook: WebhookRegistration = {
    ...registration,
    id,
    createdAt: new Date(),
  };
  webhooks.set(id, webhook);
  return webhook;
}

export function removeWebhook(id: string): boolean {
  return webhooks.delete(id);
}

export function listWebhooks(tenantId: string): WebhookRegistration[] {
  return Array.from(webhooks.values()).filter((w) => w.tenantId === tenantId);
}

export function getDeliveryLog(webhookId?: string): WebhookDelivery[] {
  if (webhookId) return deliveryLog.filter((d) => d.webhookId === webhookId);
  return [...deliveryLog];
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

    const delivery: WebhookDelivery = {
      webhookId: webhook.id,
      eventType: event.type,
      url: webhook.url,
      status: response.ok ? "success" : "failed",
      statusCode: response.status,
      attempt,
      timestamp: new Date(),
    };

    logDelivery(delivery);

    // Retry on server errors (5xx) or network errors
    if (!response.ok && response.status >= 500 && attempt < MAX_RETRIES) {
      await delay(RETRY_DELAYS[attempt - 1] ?? 15000);
      return deliverWebhook(webhook, event, attempt + 1);
    }
  } catch (error) {
    const delivery: WebhookDelivery = {
      webhookId: webhook.id,
      eventType: event.type,
      url: webhook.url,
      status: "failed",
      attempt,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    };

    logDelivery(delivery);

    // Retry on network errors
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAYS[attempt - 1] ?? 15000);
      return deliverWebhook(webhook, event, attempt + 1);
    }
  }
}

function logDelivery(delivery: WebhookDelivery): void {
  deliveryLog.push(delivery);
  if (deliveryLog.length > MAX_DELIVERY_LOG) {
    deliveryLog.splice(0, deliveryLog.length - MAX_DELIVERY_LOG);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      const matching = Array.from(webhooks.values()).filter(
        (w) => w.active && (w.eventType === event.type || w.eventType === "*")
      );

      // Fire all webhook deliveries concurrently (non-blocking)
      await Promise.allSettled(
        matching.map((w) => deliverWebhook(w, event))
      );
    },
  });
}
