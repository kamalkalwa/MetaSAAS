/**
 * Billing Module Tests
 *
 * Tests the ConsoleBillingProvider and module initialization.
 * Stripe provider is tested via integration tests (requires Stripe SDK).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ConsoleBillingProvider,
  initBilling,
  getBillingProvider,
  setBillingProvider,
  resetBilling,
} from "./index.js";

describe("Billing Module", () => {
  beforeEach(() => {
    resetBilling();
  });

  describe("ConsoleBillingProvider", () => {
    it("returns success URL as checkout session URL", async () => {
      const provider = new ConsoleBillingProvider();
      const result = await provider.createCheckoutSession({
        tenantId: "t1",
        priceId: "price_test",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });
      expect(result.url).toBe("https://example.com/success");
      expect(result.sessionId).toBe("console-session-001");
    });

    it("returns null for subscription", async () => {
      const provider = new ConsoleBillingProvider();
      const sub = await provider.getSubscription("t1");
      expect(sub).toBeNull();
    });

    it("returns true for cancel", async () => {
      const provider = new ConsoleBillingProvider();
      const result = await provider.cancelSubscription("t1");
      expect(result).toBe(true);
    });

    it("returns return URL for portal session", async () => {
      const provider = new ConsoleBillingProvider();
      const result = await provider.createPortalSession({
        tenantId: "t1",
        returnUrl: "https://example.com/billing",
      });
      expect(result.url).toBe("https://example.com/billing");
    });

    it("returns unhandled for webhook", async () => {
      const provider = new ConsoleBillingProvider();
      const result = await provider.handleWebhook("{}", "sig_test");
      expect(result.handled).toBe(false);
    });

    it("returns empty invoices", async () => {
      const provider = new ConsoleBillingProvider();
      const invoices = await provider.getInvoices("t1");
      expect(invoices).toEqual([]);
    });
  });

  describe("Module state", () => {
    it("defaults to console provider", () => {
      const provider = getBillingProvider();
      expect(provider.name).toBe("console");
    });

    it("initBilling selects console when no Stripe keys", () => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      initBilling();
      expect(getBillingProvider().name).toBe("console");
    });

    it("setBillingProvider overrides the provider", () => {
      const custom = new ConsoleBillingProvider();
      Object.defineProperty(custom, "name", { value: "custom" });
      setBillingProvider(custom);
      expect(getBillingProvider().name).toBe("custom");
    });

    it("resetBilling reverts to console", () => {
      const custom = new ConsoleBillingProvider();
      Object.defineProperty(custom, "name", { value: "custom" });
      setBillingProvider(custom);
      resetBilling();
      expect(getBillingProvider().name).toBe("console");
    });
  });
});
