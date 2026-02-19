/**
 * Action Context
 *
 * Provided by the platform to every action execution.
 * Contains everything an action needs to do its work:
 * the caller's identity, database access, event emitter, and logger.
 *
 * The domain NEVER constructs this — the platform does.
 */

import type { CallerType } from "./permission.js";

/**
 * Identifies who or what is executing an action.
 * In v0, this is a hardcoded demo user.
 */
export interface Caller {
  /** Unique user identifier */
  userId: string;

  /** Tenant the caller belongs to (for data isolation) */
  tenantId: string;

  /** Roles assigned to this caller */
  roles: string[];

  /** What kind of caller this is */
  type: CallerType;
}

/**
 * Structured logger provided to actions.
 * Actions should use this instead of console.log.
 */
export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

/**
 * A domain event emitted after an action completes.
 * Platform routes these to subscribers (automations, webhooks, etc.).
 */
export interface DomainEvent {
  /** Event name. Convention: "entity.verb_past_tense" (e.g., "contact.created") */
  type: string;

  /** The data associated with this event */
  payload: Record<string, unknown>;

  /** When the event occurred */
  timestamp?: Date;
}

/**
 * An event subscriber — a function that reacts to domain events.
 *
 * Subscribers are registered at startup and receive events that match
 * their declared event type pattern. The platform calls all matching
 * subscribers asynchronously after the action that emitted the event
 * has completed.
 *
 * @example
 * const onTaskCreated: EventSubscriber = {
 *   eventType: "task.created",
 *   name: "SendTaskNotification",
 *   handler: async (event) => {
 *     console.log("New task:", event.payload.title);
 *   },
 * };
 */
export interface EventSubscriber {
  /** The event type to listen for. Supports exact match or wildcard "*" for all events. */
  eventType: string;

  /** Human-readable name for logging and debugging */
  name: string;

  /** The function called when a matching event is emitted */
  handler: (event: DomainEvent) => Promise<void>;
}

/**
 * The context object passed to every action's execute function.
 * This is the action's window into the platform's capabilities.
 */
export interface ActionContext {
  /** Who is executing this action */
  caller: Caller;

  /**
   * Database access, scoped to the caller's tenant.
   * In v0 this is a simple query interface.
   * Future versions will enforce tenant isolation automatically.
   */
  db: DatabaseClient;

  /** Emit a domain event (platform routes it to subscribers) */
  emit: (event: DomainEvent) => Promise<void>;

  /** Structured logger */
  logger: Logger;
}

/**
 * Simplified database client interface for v0.
 * The platform provides the concrete implementation (Drizzle-based).
 *
 * Actions use this to read/write data without knowing about
 * the underlying database engine.
 */
export interface DatabaseClient {
  /**
   * Execute a query against a named entity table.
   * Returns matching rows.
   */
  findMany(
    entity: string,
    options?: {
      where?: Record<string, unknown>;
      orderBy?: { field: string; direction: "asc" | "desc" };
      limit?: number;
      offset?: number;
    }
  ): Promise<Record<string, unknown>[]>;

  /** Find a single record by ID */
  findById(entity: string, id: string): Promise<Record<string, unknown> | null>;

  /** Insert a new record. Returns the created record with generated ID. */
  create(
    entity: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>;

  /** Update a record by ID. Returns the updated record. */
  update(
    entity: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>;

  /** Delete a record by ID. Returns true if deleted. */
  delete(entity: string, id: string): Promise<boolean>;

  /** Count records matching optional filter */
  count(entity: string, where?: Record<string, unknown>): Promise<number>;
}
