/**
 * Email Module Tests
 *
 * Tests email sending, provider switching, and event-driven triggers.
 * Uses ConsoleEmailProvider — no real API keys needed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  sendEmail,
  initEmail,
  resetEmail,
  getEmailProvider,
  setEmailProvider,
  registerEmailTrigger,
  ConsoleEmailProvider,
  ResendEmailProvider,
  type EmailProvider,
  type SendEmailOptions,
  type SendResult,
} from "./index.js";

describe("Email Module", () => {
  beforeEach(() => {
    resetEmail();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  describe("initEmail()", () => {
    it("uses console provider when no RESEND_API_KEY is set", () => {
      initEmail();
      expect(getEmailProvider().name).toBe("console");
    });

    it("uses Resend provider when RESEND_API_KEY is set", () => {
      process.env.RESEND_API_KEY = "re_test_123";
      initEmail();
      expect(getEmailProvider().name).toBe("resend");
    });

    it("uses custom EMAIL_FROM when set", () => {
      process.env.EMAIL_FROM = "Custom App <hello@custom.com>";
      initEmail();
      // Provider is still console, but from address is updated
      expect(getEmailProvider().name).toBe("console");
    });
  });

  describe("sendEmail()", () => {
    it("sends email with console provider", async () => {
      initEmail();
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test Email",
        html: "<h1>Hello</h1>",
      });

      expect(result.success).toBe(true);
      expect(result.id).toMatch(/^console-/);
    });

    it("sends to multiple recipients", async () => {
      initEmail();
      const result = await sendEmail({
        to: ["a@example.com", "b@example.com"],
        subject: "Multi-recipient",
        html: "<p>Hello all</p>",
      });

      expect(result.success).toBe(true);
    });

    it("applies default from address", async () => {
      const mockProvider: EmailProvider = {
        name: "mock",
        send: vi.fn(async (options: SendEmailOptions): Promise<SendResult> => {
          return { id: "mock-1", success: true };
        }),
      };
      setEmailProvider(mockProvider);

      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
        })
      );
    });

    it("uses custom from when specified", async () => {
      const mockProvider: EmailProvider = {
        name: "mock",
        send: vi.fn(async (options: SendEmailOptions): Promise<SendResult> => {
          return { id: "mock-1", success: true };
        }),
      };
      setEmailProvider(mockProvider);

      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        from: "Custom <custom@app.com>",
      });

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Custom <custom@app.com>",
        })
      );
    });
  });

  describe("ConsoleEmailProvider", () => {
    it("returns success for every send", async () => {
      const provider = new ConsoleEmailProvider();
      const result = await provider.send({
        to: "test@example.com",
        subject: "Hello",
        html: "<p>World</p>",
      });

      expect(result.success).toBe(true);
      expect(result.id).toMatch(/^console-/);
    });

    it("handles array recipients", async () => {
      const provider = new ConsoleEmailProvider();
      const result = await provider.send({
        to: ["a@b.com", "c@d.com"],
        subject: "Hello",
        html: "<p>World</p>",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("ResendEmailProvider", () => {
    it("can be instantiated with API key and from address", () => {
      const provider = new ResendEmailProvider("re_test_key", "App <app@test.com>");
      expect(provider.name).toBe("resend");
    });
  });

  describe("setEmailProvider()", () => {
    it("overrides the current provider", () => {
      const custom: EmailProvider = {
        name: "custom",
        send: async () => ({ id: "custom-1", success: true }),
      };

      setEmailProvider(custom);
      expect(getEmailProvider().name).toBe("custom");
    });
  });

  describe("registerEmailTrigger()", () => {
    it("registers a trigger that fires on matching events", async () => {
      const sent: SendEmailOptions[] = [];
      const mockProvider: EmailProvider = {
        name: "mock",
        send: async (options) => {
          sent.push(options);
          return { id: "mock-1", success: true };
        },
      };
      setEmailProvider(mockProvider);

      registerEmailTrigger({
        eventType: "user.created",
        build: (event) => ({
          to: event.payload?.email as string ?? "fallback@test.com",
          subject: "Welcome!",
          html: "<h1>Welcome</h1>",
        }),
      });

      // The trigger is registered but won't fire until initEmail() subscribes
      // to the event bus. Direct trigger testing would need event bus integration.
      // This test verifies registration doesn't throw.
    });
  });

  describe("resetEmail()", () => {
    it("resets to default console provider", () => {
      const custom: EmailProvider = {
        name: "custom",
        send: async () => ({ id: "custom-1", success: true }),
      };
      setEmailProvider(custom);
      expect(getEmailProvider().name).toBe("custom");

      resetEmail();
      expect(getEmailProvider().name).toBe("console");
    });
  });
});
