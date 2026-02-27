/**
 * Event Bus
 *
 * A simple, synchronous-dispatch event bus that routes DomainEvents
 * to registered EventSubscriber handlers.
 *
 * Design principles:
 *   - Subscribers are registered at startup (not dynamically at runtime)
 *   - Events are dispatched asynchronously but errors are caught and logged
 *     (a failing subscriber never breaks the action that emitted the event)
 *   - Supports exact match ("task.created") and wildcard ("*") subscriptions
 *   - Thread-safe for single-process Node.js (no concurrency issues)
 *
 * Future extensions:
 *   - Pattern matching ("task.*" for all task events)
 *   - Priority ordering
 *   - Dead letter queue for failed handlers
 */

import type { DomainEvent, EventSubscriber } from "@metasaas/contracts";
import { captureException } from "../observability/index.js";

/** All registered subscribers, keyed by event type */
const subscribers = new Map<string, EventSubscriber[]>();

/**
 * Register an event subscriber.
 * Call this at startup (in domain/src/index.ts or bootstrap).
 *
 * @param subscriber - The subscriber to register
 */
export function subscribe(subscriber: EventSubscriber): void {
  const existing = subscribers.get(subscriber.eventType) ?? [];
  existing.push(subscriber);
  subscribers.set(subscriber.eventType, existing);
}

/**
 * Register multiple subscribers at once.
 * Convenience wrapper for subscribe().
 */
export function subscribeAll(subs: EventSubscriber[]): void {
  for (const sub of subs) {
    subscribe(sub);
  }
}

/**
 * Publish a domain event to all matching subscribers.
 *
 * Matching rules:
 *   1. Exact match on event type (e.g., "task.created" matches "task.created")
 *   2. Wildcard "*" matches all events
 *
 * All matching handlers are invoked concurrently via Promise.allSettled.
 * Failed handlers are logged but never re-thrown — they don't break the
 * calling action.
 *
 * @param event - The domain event to publish
 */
export async function publish(event: DomainEvent): Promise<void> {
  // Add timestamp if not already set
  const enrichedEvent: DomainEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date(),
  };

  // Collect matching subscribers
  const handlers: EventSubscriber[] = [];

  // Exact match
  const exact = subscribers.get(enrichedEvent.type);
  if (exact) handlers.push(...exact);

  // Wildcard match
  const wildcard = subscribers.get("*");
  if (wildcard) handlers.push(...wildcard);

  if (handlers.length === 0) return;

  // Execute all handlers concurrently, catching failures
  const results = await Promise.allSettled(
    handlers.map((sub) => sub.handler(enrichedEvent))
  );

  // Log failures (don't throw — event handlers must not break the emitter)
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      console.error(
        `[event-bus] Subscriber "${handlers[i].name}" failed for event "${enrichedEvent.type}":`,
        result.reason
      );
      // Capture subscriber failure in observability
      if (result.reason instanceof Error) {
        captureException(result.reason, {
          subscriber: handlers[i].name,
          eventType: enrichedEvent.type,
        });
      }
    }
  }
}

/**
 * Returns the count of registered subscribers (for testing/debugging).
 */
export function getSubscriberCount(): number {
  let count = 0;
  for (const subs of subscribers.values()) {
    count += subs.length;
  }
  return count;
}

/**
 * Clears all registered subscribers.
 * Used for test isolation — prevents subscriber state from leaking between tests.
 */
export function clearSubscribers(): void {
  subscribers.clear();
}
