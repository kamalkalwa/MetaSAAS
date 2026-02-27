/**
 * Billing Module
 *
 * Provides subscription management through the provider pattern.
 * Supports Stripe (production) and Console (development) providers.
 *
 * Pattern: Same as Email/Storage/Notifications — interface → providers → state → init.
 */

import { getDatabase } from "../database/connection.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  planId: string;
  planName: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  stripeInvoiceId: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  createdAt: string;
}

export interface CheckoutParams {
  tenantId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export interface PortalParams {
  tenantId: string;
  returnUrl: string;
}

export interface WebhookResult {
  handled: boolean;
  eventType: string;
  message?: string;
}

export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>;
  getSubscription(tenantId: string): Promise<Subscription | null>;
  cancelSubscription(tenantId: string): Promise<boolean>;
  createPortalSession(params: PortalParams): Promise<{ url: string }>;
  handleWebhook(payload: string, signature: string): Promise<WebhookResult>;
  getInvoices(tenantId: string): Promise<Invoice[]>;
}

// ---------------------------------------------------------------------------
// Console Provider (dev fallback)
// ---------------------------------------------------------------------------

export class ConsoleBillingProvider implements BillingProvider {
  readonly name = "console";

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    console.log("[billing:console] Checkout session:", params);
    return { url: params.successUrl, sessionId: "console-session-001" };
  }

  async getSubscription(tenantId: string): Promise<Subscription | null> {
    console.log("[billing:console] Get subscription for:", tenantId);
    return null;
  }

  async cancelSubscription(tenantId: string): Promise<boolean> {
    console.log("[billing:console] Cancel subscription for:", tenantId);
    return true;
  }

  async createPortalSession(params: PortalParams): Promise<{ url: string }> {
    console.log("[billing:console] Portal session:", params);
    return { url: params.returnUrl };
  }

  async handleWebhook(payload: string, signature: string): Promise<WebhookResult> {
    console.log("[billing:console] Webhook received, signature:", signature.slice(0, 20));
    return { handled: false, eventType: "unknown", message: "Console provider does not handle webhooks" };
  }

  async getInvoices(tenantId: string): Promise<Invoice[]> {
    console.log("[billing:console] Get invoices for:", tenantId);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Stripe Provider
// ---------------------------------------------------------------------------

export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";
  private secretKey: string;
  private webhookSecret: string;
  private stripe: any = null;

  constructor(secretKey: string, webhookSecret: string) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  private async getStripe(): Promise<any> {
    if (!this.stripe) {
      // Dynamic import — Stripe SDK is an optional peer dependency.
      // Use Function constructor to bypass TypeScript module resolution.
      const mod = await (new Function('return import("stripe")'))();
      const Stripe = mod.default ?? mod;
      this.stripe = new Stripe(this.secretKey);
    }
    return this.stripe;
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    const stripe = await this.getStripe();

    // Look up or create Stripe customer
    let customerId: string | undefined;
    const sub = await this.getSubscriptionFromDB(params.tenantId);
    if (sub) {
      customerId = sub.stripeCustomerId;
    }

    const sessionParams: any = {
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { tenantId: params.tenantId },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (params.customerEmail) {
      sessionParams.customer_email = params.customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { url: session.url!, sessionId: session.id };
  }

  async getSubscription(tenantId: string): Promise<Subscription | null> {
    return this.getSubscriptionFromDB(tenantId);
  }

  async cancelSubscription(tenantId: string): Promise<boolean> {
    const sub = await this.getSubscriptionFromDB(tenantId);
    if (!sub || !sub.stripeSubscriptionId) return false;

    const stripe = await this.getStripe();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local record
    const { sql: pgSql } = getDatabase();
    await pgSql.unsafe(
      `UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId]
    );

    return true;
  }

  async createPortalSession(params: PortalParams): Promise<{ url: string }> {
    const sub = await this.getSubscriptionFromDB(params.tenantId);
    if (!sub) throw new Error("No subscription found for this tenant");

    const stripe = await this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: string, signature: string): Promise<WebhookResult> {
    const stripe = await this.getStripe();

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch {
      return { handled: false, eventType: "unknown", message: "Invalid webhook signature" };
    }

    const { sql: pgSql } = getDatabase();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tenantId = session.metadata?.tenantId;
        if (!tenantId) break;

        // Fetch the subscription from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = stripeSub.items.data[0]?.price?.id ?? "";
        const productId = stripeSub.items.data[0]?.price?.product;
        let planName = "Pro";
        if (productId) {
          try {
            const product = await stripe.products.retrieve(productId);
            planName = product.name;
          } catch { /* use default */ }
        }

        await pgSql.unsafe(
          `INSERT INTO subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, status, plan_id, plan_name, current_period_start, current_period_end)
           VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), to_timestamp($8))
           ON CONFLICT (tenant_id) DO UPDATE SET
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             status = EXCLUDED.status,
             plan_id = EXCLUDED.plan_id,
             plan_name = EXCLUDED.plan_name,
             current_period_start = EXCLUDED.current_period_start,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = NOW()`,
          [
            tenantId,
            session.customer,
            session.subscription,
            stripeSub.status,
            priceId,
            planName,
            stripeSub.current_period_start,
            stripeSub.current_period_end,
          ]
        );

        return { handled: true, eventType: event.type };
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        await pgSql.unsafe(
          `UPDATE subscriptions SET
             status = $1,
             current_period_start = to_timestamp($2),
             current_period_end = to_timestamp($3),
             cancel_at_period_end = $4,
             updated_at = NOW()
           WHERE stripe_subscription_id = $5`,
          [sub.status, sub.current_period_start, sub.current_period_end, sub.cancel_at_period_end, sub.id]
        );
        return { handled: true, eventType: event.type };
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await pgSql.unsafe(
          `UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        return { handled: true, eventType: event.type };
      }

      case "invoice.paid": {
        const inv = event.data.object;
        const tenantRow = await pgSql.unsafe(
          `SELECT tenant_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
          [inv.customer]
        );
        if (tenantRow.length > 0) {
          await pgSql.unsafe(
            `INSERT INTO invoices (tenant_id, stripe_invoice_id, amount_due, amount_paid, currency, status, invoice_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (stripe_invoice_id) DO NOTHING`,
            [
              tenantRow[0].tenant_id,
              inv.id,
              inv.amount_due ?? 0,
              inv.amount_paid ?? 0,
              inv.currency ?? "usd",
              inv.status ?? "paid",
              inv.hosted_invoice_url ?? null,
            ]
          );
        }
        return { handled: true, eventType: event.type };
      }

      case "invoice.payment_failed": {
        const inv = event.data.object;
        const tenantRow = await pgSql.unsafe(
          `SELECT tenant_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
          [inv.customer]
        );
        if (tenantRow.length > 0) {
          await pgSql.unsafe(
            `UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE tenant_id = $1`,
            [tenantRow[0].tenant_id]
          );
        }
        return { handled: true, eventType: event.type };
      }

      default:
        return { handled: false, eventType: event.type, message: `Unhandled event: ${event.type}` };
    }

    return { handled: true, eventType: event.type };
  }

  async getInvoices(tenantId: string): Promise<Invoice[]> {
    const { sql: pgSql } = getDatabase();
    const rows = await pgSql.unsafe(
      `SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      stripeInvoiceId: r.stripe_invoice_id,
      amountDue: r.amount_due,
      amountPaid: r.amount_paid,
      currency: r.currency,
      status: r.status,
      invoiceUrl: r.invoice_url,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  private async getSubscriptionFromDB(tenantId: string): Promise<Subscription | null> {
    const { sql: pgSql } = getDatabase();
    const rows = await pgSql.unsafe(
      `SELECT * FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if (rows.length === 0) return null;
    const r = rows[0] as any;
    return {
      id: r.id,
      tenantId: r.tenant_id,
      stripeCustomerId: r.stripe_customer_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      status: r.status,
      planId: r.plan_id,
      planName: r.plan_name,
      currentPeriodStart: r.current_period_start instanceof Date ? r.current_period_start.toISOString() : String(r.current_period_start),
      currentPeriodEnd: r.current_period_end instanceof Date ? r.current_period_end.toISOString() : String(r.current_period_end),
      cancelAtPeriodEnd: r.cancel_at_period_end ?? false,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }
}

// ---------------------------------------------------------------------------
// State (singleton pattern)
// ---------------------------------------------------------------------------

let provider: BillingProvider = new ConsoleBillingProvider();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize billing — auto-detects Stripe keys or falls back to console.
 */
export function initBilling(): void {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (secretKey && webhookSecret) {
    provider = new StripeBillingProvider(secretKey, webhookSecret);
    console.log("[billing] Stripe billing provider initialized");
  } else {
    provider = new ConsoleBillingProvider();
    console.log("[billing] Console billing provider (no Stripe keys)");
  }
}

export function getBillingProvider(): BillingProvider {
  return provider;
}

export function setBillingProvider(p: BillingProvider): void {
  provider = p;
}

export function resetBilling(): void {
  provider = new ConsoleBillingProvider();
}
