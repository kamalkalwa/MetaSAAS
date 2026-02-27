/**
 * Action Bus
 *
 * The central dispatch for all operations in MetaSAAS.
 * Every action goes through this pipeline:
 *
 *   1. Lookup action by ID
 *   2. Validate input against the action's Zod schema
 *   3. Check caller permissions
 *   4. Execute the action's business logic
 *   5. Log the result
 *
 * The Bus is the SINGLE entry point for all operations —
 * whether triggered by the UI, an API call, an AI agent, or a cron job.
 */

import type { ActionContext, Caller, DomainEvent } from "@metasaas/contracts";
import type { SideEffect } from "@metasaas/contracts";
import { getAction } from "./registry.js";
import { validateInput, ValidationError } from "./middleware/validation.js";
import { checkPermission, PermissionError } from "./middleware/permission.js";
import { WorkflowError } from "./middleware/workflow.js";
import { createLogger, logActionExecution } from "./middleware/logging.js";
import { createDatabaseClient } from "../database/client.js";
import { publish } from "../event-bus/index.js";
import { writeAuditLog } from "../audit/index.js";
import { captureException } from "../observability/index.js";

/**
 * Error categories for structured error handling.
 * The REST adapter maps these to HTTP status codes:
 *   not_found  → 404
 *   validation → 400
 *   permission → 403
 *   workflow   → 422
 *   unknown    → 500
 */
export type ActionErrorType =
  | "not_found"
  | "validation"
  | "permission"
  | "workflow"
  | "unknown";

/**
 * The result of dispatching an action.
 * Always includes success status — callers should check this.
 * On failure, errorType identifies the category for HTTP mapping.
 */
export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; errorType: ActionErrorType; details?: unknown };

/**
 * Dispatches an action through the Action Bus pipeline.
 *
 * @param actionId - The action's unique ID (e.g., "contact.create")
 * @param input - The raw input data (will be validated)
 * @param caller - Who is executing this action
 *
 * @returns ActionResult with success/failure and data/error
 */
export async function dispatch<T = unknown>(
  actionId: string,
  input: unknown,
  caller: Caller
): Promise<ActionResult<T>> {
  const startTime = performance.now();
  const logger = createLogger(`action:${actionId}`);

  try {
    // 1. Lookup
    const action = getAction(actionId);
    if (!action) {
      return {
        success: false,
        error: `Action "${actionId}" not found`,
        errorType: "not_found",
      };
    }

    // 2. Validate
    const validatedInput = validateInput(action, input);

    // 3. Authorize
    const allowed = checkPermission(action, caller);
    if (!allowed) {
      throw new PermissionError(actionId, caller.userId);
    }

    // 4. Build context
    const context: ActionContext = {
      caller,
      db: createDatabaseClient(caller.tenantId),
      emit: async (event: DomainEvent) => {
        // Log the event
        logger.info("Domain event emitted", {
          eventType: event.type,
          payload: event.payload,
        });
        // Route to registered EventBus subscribers
        await publish(event);
      },
      logger,
    };

    // 5. Before hook (Layer 3 escape hatch)
    const hookInput = action.beforeExecute
      ? await action.beforeExecute(validatedInput, context)
      : validatedInput;

    // 6. Execute
    const rawResult = await action.execute(hookInput, context);

    // 7. After hook (Layer 3 escape hatch)
    const result = action.afterExecute
      ? await action.afterExecute(rawResult, hookInput, context)
      : rawResult;

    // 8. Process declared side effects (fire-and-forget, never break the action)
    if (action.sideEffects?.length) {
      await processSideEffects(action.sideEffects, actionId, result, context);
    }

    // 9. Log success
    const durationMs = Math.round(performance.now() - startTime);
    logActionExecution(actionId, durationMs, true);

    // 10. Persistent audit log (fire-and-forget — never blocks the response)
    writeAuditLog({
      tenantId: caller.tenantId,
      userId: caller.userId,
      actionId,
      success: true,
      durationMs,
      input,
    }).catch(() => { /* audit logging never breaks the action */ });

    return { success: true, data: result as T };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logActionExecution(actionId, durationMs, false, errorMessage);

    // Persistent audit log for failures too
    writeAuditLog({
      tenantId: caller.tenantId,
      userId: caller.userId,
      actionId,
      success: false,
      durationMs,
      input,
      error: errorMessage,
    }).catch(() => { /* audit logging never breaks the action */ });

    // Return structured errors for known error types
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: errorMessage,
        errorType: "validation",
        details: { fieldErrors: error.fieldErrors },
      };
    }

    if (error instanceof PermissionError) {
      return {
        success: false,
        error: errorMessage,
        errorType: "permission",
      };
    }

    if (error instanceof WorkflowError) {
      return {
        success: false,
        error: errorMessage,
        errorType: "workflow",
        details: {
          field: error.field,
          from: error.from,
          to: error.to,
          validTargets: error.validTargets,
        },
      };
    }

    // Unknown error — log full details server-side, return generic message
    logger.error("Action execution failed", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Capture unexpected errors in observability provider (Sentry, etc.)
    if (error instanceof Error) {
      captureException(error, {
        actionId,
        userId: caller.userId,
        tenantId: caller.tenantId,
      });
    }

    return {
      success: false,
      error: "An unexpected error occurred",
      errorType: "unknown",
    };
  }
}

// ---------------------------------------------------------------------------
// Side Effects Processor
// ---------------------------------------------------------------------------

/**
 * Processes declared side effects after a successful action execution.
 *
 * Side effects are fire-and-forget — they NEVER break the action that
 * triggered them. Each effect type is handled independently:
 *
 *   - emit_event: publishes a domain event to the EventBus
 *   - notify:     logs a notification (extend for email/push in production)
 *   - webhook:    sends an HTTP POST to a configured URL
 *
 * @param effects  - The side effects declared on the action
 * @param actionId - The action that triggered these effects
 * @param result   - The action's return value
 * @param context  - The action context (for emit and logging)
 */
async function processSideEffects(
  effects: SideEffect[],
  actionId: string,
  result: unknown,
  context: ActionContext
): Promise<void> {
  for (const effect of effects) {
    try {
      switch (effect.type) {
        case "emit_event": {
          const eventType = (effect.config.eventType as string) ?? `${actionId}.sideEffect`;
          await context.emit({
            type: eventType,
            payload: {
              actionId,
              result,
              ...(effect.config.payload as Record<string, unknown> ?? {}),
            },
          });
          break;
        }

        case "notify": {
          // In the template, notifications are logged.
          // Production apps extend this with email, push, or in-app delivery.
          context.logger.info("[side-effect] Notification", {
            actionId,
            channel: (effect.config.channel as string) ?? "log",
            message: (effect.config.message as string) ?? `Action ${actionId} completed`,
          });
          break;
        }

        case "webhook": {
          const url = effect.config.url as string;
          if (!url) {
            context.logger.warn("[side-effect] Webhook missing URL", { actionId });
            break;
          }

          // Fire-and-forget — don't await, don't block the response
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actionId,
              timestamp: new Date().toISOString(),
              result,
            }),
          }).catch((err) => {
            context.logger.error("[side-effect] Webhook delivery failed", {
              url,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          });
          break;
        }

        default: {
          context.logger.warn("[side-effect] Unknown type", {
            type: effect.type,
            actionId,
          });
        }
      }
    } catch (effectError) {
      // Side effects NEVER break the action — swallow and log
      context.logger.error("[side-effect] Processing failed", {
        type: effect.type,
        actionId,
        error:
          effectError instanceof Error ? effectError.message : "Unknown error",
      });
    }
  }
}
