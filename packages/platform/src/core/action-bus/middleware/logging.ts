/**
 * Logging Middleware
 *
 * Logs every action execution with timing information.
 * In v0, this writes to console. Future versions will
 * integrate with OpenTelemetry for distributed tracing.
 */

import type { Logger } from "@metasaas/contracts";
import { captureMessage } from "../../observability/index.js";

/**
 * Creates a simple structured logger.
 * Prefixes all messages with a context identifier.
 */
export function createLogger(context: string): Logger {
  return {
    info(message, data) {
      console.log(
        JSON.stringify({ level: "info", context, message, ...data })
      );
    },
    warn(message, data) {
      console.warn(
        JSON.stringify({ level: "warn", context, message, ...data })
      );
      captureMessage(`[${context}] ${message}`, "warning", data);
    },
    error(message, data) {
      console.error(
        JSON.stringify({ level: "error", context, message, ...data })
      );
      captureMessage(`[${context}] ${message}`, "error", data);
    },
    debug(message, data) {
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          JSON.stringify({ level: "debug", context, message, ...data })
        );
      }
    },
  };
}

/**
 * Logs action execution with duration.
 */
export function logActionExecution(
  actionId: string,
  durationMs: number,
  success: boolean,
  error?: string
) {
  const entry = {
    level: success ? "info" : "error",
    context: "action-bus",
    event: "action.executed",
    actionId,
    durationMs,
    success,
    ...(error ? { error } : {}),
  };

  if (success) {
    console.log(JSON.stringify(entry));
  } else {
    console.error(JSON.stringify(entry));
  }
}
