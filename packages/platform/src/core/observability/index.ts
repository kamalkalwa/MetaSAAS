/**
 * Observability Module
 *
 * Captures errors, structured logs, and operational telemetry.
 * Follows the provider pattern — pluggable backends with a console fallback.
 *
 * Provider: Sentry (production error tracking)
 * Fallback: ConsoleObservabilityProvider (enhanced console, zero deps)
 *
 * Usage:
 *   import { initObservability, captureException, captureMessage } from "./observability";
 *
 *   initObservability();  // Call once at startup — auto-detects provider from env
 *
 *   captureException(error, { userId: "abc", tenantId: "t1" });
 *   captureMessage("Slow query detected", "warning", { durationMs: 5200 });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity levels for messages (aligned with Sentry's taxonomy) */
export type ObservabilitySeverity = "fatal" | "error" | "warning" | "info" | "debug";

/** Context tags attached to every event for filtering */
export interface ObservabilityContext {
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

/** The provider contract. Every observability backend implements this. */
export interface ObservabilityProvider {
  /** Provider name (for logging) */
  readonly name: string;

  /** Capture an exception / error */
  captureException(error: Error, context?: ObservabilityContext): void;

  /** Capture a message with severity level */
  captureMessage(
    message: string,
    level: ObservabilitySeverity,
    context?: ObservabilityContext
  ): void;

  /** Set user/tenant context for all subsequent captures */
  setContext(context: ObservabilityContext): void;

  /** Flush pending events to the backend (for graceful shutdown) */
  flush(timeoutMs?: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Console Provider (dev fallback — zero deps, enhanced console)
// ---------------------------------------------------------------------------

export class ConsoleObservabilityProvider implements ObservabilityProvider {
  readonly name = "console";

  captureException(error: Error, context?: ObservabilityContext): void {
    console.error(
      JSON.stringify({
        level: "error",
        context: "observability",
        event: "exception",
        message: error.message,
        stack: error.stack,
        ...context,
        timestamp: new Date().toISOString(),
      })
    );
  }

  captureMessage(
    message: string,
    level: ObservabilitySeverity,
    context?: ObservabilityContext
  ): void {
    const logFn =
      level === "fatal" || level === "error"
        ? console.error
        : level === "warning"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log;

    logFn(
      JSON.stringify({
        level,
        context: "observability",
        event: "message",
        message,
        ...context,
        timestamp: new Date().toISOString(),
      })
    );
  }

  setContext(_context: ObservabilityContext): void {
    // Console provider: no-op (context is passed per-call)
  }

  async flush(): Promise<void> {
    // Console provider: no-op (console writes are synchronous)
  }
}

// ---------------------------------------------------------------------------
// Sentry Provider
// ---------------------------------------------------------------------------

/**
 * Sentry-backed observability provider.
 * Uses dynamic import to avoid requiring @sentry/node when not used.
 * All methods guard against sentry being null (fail-safe).
 */
export class SentryObservabilityProvider implements ObservabilityProvider {
  readonly name = "sentry";
  private sentry: any = null;

  constructor(dsn: string, environment?: string) {
    this.initSentry(dsn, environment);
  }

  private async initSentry(dsn: string, environment?: string): Promise<void> {
    try {
      // Dynamic import — @sentry/node is an optional peer dependency.
      // Use string variable to prevent TypeScript from resolving the module at compile time.
      const moduleName = "@sentry/node";
      const Sentry = await import(/* @vite-ignore */ moduleName);
      Sentry.init({
        dsn,
        environment: environment ?? process.env.NODE_ENV ?? "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      });
      this.sentry = Sentry;
    } catch (err) {
      console.error(
        "[observability:sentry] Failed to initialize — @sentry/node may not be installed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  private applyContext(scope: any, context?: ObservabilityContext): void {
    if (!context) return;
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.tenantId) scope.setTag("tenantId", String(context.tenantId));
    for (const [key, value] of Object.entries(context)) {
      if (key !== "userId" && key !== "tenantId") {
        scope.setExtra(key, value);
      }
    }
  }

  captureException(error: Error, context?: ObservabilityContext): void {
    if (!this.sentry) return;
    this.sentry.withScope((scope: any) => {
      this.applyContext(scope, context);
      this.sentry.captureException(error);
    });
  }

  captureMessage(
    message: string,
    level: ObservabilitySeverity,
    context?: ObservabilityContext
  ): void {
    if (!this.sentry) return;
    this.sentry.withScope((scope: any) => {
      this.applyContext(scope, context);
      this.sentry.captureMessage(message, level);
    });
  }

  setContext(context: ObservabilityContext): void {
    if (!this.sentry) return;
    if (context.userId) {
      this.sentry.setUser({ id: context.userId });
    }
    if (context.tenantId) {
      this.sentry.setTag("tenantId", String(context.tenantId));
    }
  }

  async flush(timeoutMs = 2000): Promise<void> {
    if (!this.sentry) return;
    await this.sentry.flush(timeoutMs);
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let provider: ObservabilityProvider = new ConsoleObservabilityProvider();

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the observability module.
 * Auto-detects provider from environment variables:
 *   - SENTRY_DSN set → Sentry provider
 *   - Otherwise → Console provider (structured console output)
 *
 * Safe to call multiple times. Never throws.
 */
export function initObservability(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;

  if (sentryDsn) {
    provider = new SentryObservabilityProvider(sentryDsn, environment);
    console.log("[observability] Initialized with Sentry provider");
  } else {
    provider = new ConsoleObservabilityProvider();
    console.log("[observability] No SENTRY_DSN — using console provider");
  }
}

// ---------------------------------------------------------------------------
// Public API (delegates to provider)
// ---------------------------------------------------------------------------

/** Capture an exception through the observability provider */
export function captureException(
  error: Error,
  context?: ObservabilityContext
): void {
  provider.captureException(error, context);
}

/** Capture a message with severity level */
export function captureMessage(
  message: string,
  level: ObservabilitySeverity = "info",
  context?: ObservabilityContext
): void {
  provider.captureMessage(message, level, context);
}

/** Set user/tenant context for subsequent captures */
export function setObservabilityContext(context: ObservabilityContext): void {
  provider.setContext(context);
}

/** Flush pending events (call during graceful shutdown) */
export async function flushObservability(timeoutMs?: number): Promise<void> {
  await provider.flush(timeoutMs);
}

/** Get the current observability provider (for testing/inspection) */
export function getObservabilityProvider(): ObservabilityProvider {
  return provider;
}

/** Override the observability provider (for testing) */
export function setObservabilityProvider(p: ObservabilityProvider): void {
  provider = p;
}

// ---------------------------------------------------------------------------
// Testing Helpers
// ---------------------------------------------------------------------------

/** Reset observability module state (for testing only) */
export function resetObservability(): void {
  provider = new ConsoleObservabilityProvider();
}
