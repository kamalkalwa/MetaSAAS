/**
 * Email Module
 *
 * Sends transactional emails (welcome, password reset, notifications).
 * Follows the provider pattern — pluggable backends with a console fallback.
 *
 * Provider: Resend (modern, $0 for 3K emails/month, simplest API)
 * Fallback: ConsoleEmailProvider (logs to console, no API key needed)
 *
 * Usage:
 *   import { initEmail, sendEmail } from "./email";
 *
 *   initEmail();  // Call once at startup — auto-detects provider from env
 *
 *   await sendEmail({
 *     to: "user@example.com",
 *     subject: "Welcome!",
 *     html: "<h1>Welcome to the app</h1>",
 *   });
 *
 * Event Bus integration:
 *   The module can subscribe to domain events and auto-send emails.
 *   Register templates with `registerEmailTrigger()` to map events → emails.
 */

import { subscribe } from "../event-bus/index.js";
import type { DomainEvent } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  /** Recipient email address */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain text fallback (auto-generated from HTML if omitted) */
  text?: string;
  /** Reply-to address (defaults to config) */
  replyTo?: string;
  /** Custom from address (defaults to config) */
  from?: string;
}

export interface SendResult {
  /** Provider-assigned message ID */
  id: string;
  /** Whether the email was accepted for delivery */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface EmailProvider {
  /** Provider name (for logging) */
  readonly name: string;
  /** Send a single email */
  send(options: SendEmailOptions): Promise<SendResult>;
}

export interface EmailTrigger {
  /** Domain event type to listen for (e.g., "employee.created") */
  eventType: string;
  /** Build the email from the event payload. Return null to skip. */
  build(event: DomainEvent): SendEmailOptions | null;
}

// ---------------------------------------------------------------------------
// Console Provider (dev fallback — no API key needed)
// ---------------------------------------------------------------------------

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(options: SendEmailOptions): Promise<SendResult> {
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    console.log(`[email:console] To: ${to} | Subject: ${options.subject}`);
    console.log(`[email:console] Body: ${options.html.slice(0, 200)}${options.html.length > 200 ? "..." : ""}`);
    return { id: `console-${Date.now()}`, success: true };
  }
}

// ---------------------------------------------------------------------------
// Resend Provider
// ---------------------------------------------------------------------------

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    const from = options.from ?? this.defaultFrom;
    const to = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[email:resend] API error ${response.status}: ${errorBody}`);
        return {
          id: "",
          success: false,
          error: `Resend API error: ${response.status}`,
        };
      }

      const data = (await response.json()) as { id: string };
      return { id: data.id, success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[email:resend] Send failed: ${message}`);
      return { id: "", success: false, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let provider: EmailProvider = new ConsoleEmailProvider();
let defaultFrom = "MetaSAAS <noreply@metasaas.dev>";
const triggers: EmailTrigger[] = [];

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the email module.
 * Auto-detects provider from environment variables:
 *   - RESEND_API_KEY set → Resend provider
 *   - Otherwise → Console provider (logs to console)
 *
 * Subscribes to the Event Bus for trigger-based emails.
 * Safe to call multiple times. Never throws.
 */
export function initEmail(): void {
  const resendKey = process.env.RESEND_API_KEY;
  defaultFrom = process.env.EMAIL_FROM ?? defaultFrom;

  if (resendKey) {
    provider = new ResendEmailProvider(resendKey, defaultFrom);
    console.log(`[email] Initialized with Resend provider (from: ${defaultFrom})`);
  } else {
    provider = new ConsoleEmailProvider();
    console.log("[email] No RESEND_API_KEY — using console provider (emails logged to stdout)");
  }

  // Subscribe to event bus for trigger-based emails
  subscribe({
    name: "email-trigger-dispatcher",
    eventType: "*",
    async handler(event: DomainEvent) {
      for (const trigger of triggers) {
        if (trigger.eventType === event.type || trigger.eventType === "*") {
          try {
            const emailOptions = trigger.build(event);
            if (emailOptions) {
              await sendEmail(emailOptions);
            }
          } catch (err) {
            // Fire-and-forget — never break the event bus
            console.error(`[email] Trigger failed for ${event.type}:`, err);
          }
        }
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an email using the configured provider.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendResult> {
  // Apply default from if not specified
  if (!options.from) {
    options.from = defaultFrom;
  }
  return provider.send(options);
}

/**
 * Register an email trigger — maps a domain event to an email.
 * When the event fires, the trigger's `build()` function creates the email.
 */
export function registerEmailTrigger(trigger: EmailTrigger): void {
  triggers.push(trigger);
}

/**
 * Get the current email provider (for testing/inspection).
 */
export function getEmailProvider(): EmailProvider {
  return provider;
}

/**
 * Override the email provider (for testing).
 */
export function setEmailProvider(p: EmailProvider): void {
  provider = p;
}

// ---------------------------------------------------------------------------
// Testing Helpers
// ---------------------------------------------------------------------------

/**
 * Reset email module state (for testing only).
 */
export function resetEmail(): void {
  provider = new ConsoleEmailProvider();
  defaultFrom = "MetaSAAS <noreply@metasaas.dev>";
  triggers.length = 0;
}
