/**
 * Domain Event Subscribers
 *
 * Reactive logic that responds to domain events published by the Action Bus.
 * Each subscriber listens for a specific event type and performs a side effect.
 *
 * Subscribers are registered at startup via the platform's EventBus.
 * They run asynchronously AFTER the action completes — a failing subscriber
 * never breaks the action that emitted the event.
 *
 * This is the "domain-level reaction" pattern:
 *   Action executes → Event published → Subscriber reacts
 *
 * Examples of what subscribers can do:
 *   - Log audit events
 *   - Send notifications
 *   - Trigger downstream actions
 *   - Update materialized views
 *   - Call external APIs
 */

import type { EventSubscriber } from "@metasaas/contracts";

/**
 * Logs when a task's workflow transitions (any status change).
 *
 * Listens for: "task.workflow.transitioned"
 * This event is emitted by the CRUD generator when a workflow field changes
 * and the transition has declared triggers.
 *
 * In a production app, this subscriber would dispatch notifications
 * to team members, update dashboards, or trigger automations.
 * For the template, it demonstrates the pattern with structured logging.
 */
const onTaskWorkflowTransition: EventSubscriber = {
  eventType: "task.workflow.transitioned",
  name: "LogTaskWorkflowTransition",
  async handler(event) {
    const { id, workflow, field, from, to, triggers } = event.payload;
    console.log(
      `[subscriber] Task ${id} workflow "${workflow}": ${field} ${from} → ${to}` +
        (triggers ? ` (triggers: ${(triggers as string[]).join(", ")})` : "")
    );
  },
};

/**
 * Logs when a product lifecycle status changes to "discontinued".
 *
 * Listens for: "product.workflow.transitioned"
 * Demonstrates filtering within a subscriber — only acts on specific transitions.
 *
 * In production, this would notify the sales team, update the storefront,
 * or trigger an inventory audit workflow.
 */
const onProductDiscontinued: EventSubscriber = {
  eventType: "product.workflow.transitioned",
  name: "LogProductDiscontinued",
  async handler(event) {
    const { id, to } = event.payload;

    // Only react to "discontinued" transitions — ignore others
    if (to !== "discontinued") return;

    console.log(
      `[subscriber] Product ${id} has been discontinued — team notified`
    );
  },
};

/**
 * Logs all entity creation events.
 *
 * Listens for: "*" (wildcard — receives ALL events)
 * Filters to only "*.created" events.
 *
 * Demonstrates the wildcard subscription pattern and the audit trail concept.
 * In production, this would write to an audit log table or external service.
 */
const auditLogCreations: EventSubscriber = {
  eventType: "*",
  name: "AuditLogCreations",
  async handler(event) {
    // Only log creation events
    if (!event.type.endsWith(".created")) return;

    const entity = event.type.split(".")[0];
    const recordId = event.payload.id;
    console.log(
      `[audit] ${entity} record created: ${recordId}`
    );
  },
};

/**
 * All domain event subscribers.
 * Registered with the platform's EventBus during bootstrap.
 */
export const eventSubscribers: EventSubscriber[] = [
  onTaskWorkflowTransition,
  onProductDiscontinued,
  auditLogCreations,
];
