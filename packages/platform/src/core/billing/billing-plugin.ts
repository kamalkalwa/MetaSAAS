/**
 * Billing Plugin
 *
 * MetaSAASPlugin that registers billing REST routes.
 * Requires the "billing" feature flag to be enabled.
 * Routes are added to the Fastify instance via the plugin system.
 */

import type { MetaSAASPlugin, PluginContext } from "../plugins/index.js";
import { getBillingProvider } from "./index.js";
import { listPlans, getPlan, createPlan, updatePlan, deletePlan } from "./plans.js";

export const billingPlugin: MetaSAASPlugin = {
  name: "billing",
  version: "1.0.0",

  async register(ctx: PluginContext) {
    ctx.registerRoutes(async (fastify) => {
      // -----------------------------------------------------------------------
      // Plan routes (public read, auth required for write)
      // -----------------------------------------------------------------------

      // GET /api/billing/plans — list active plans (public, for pricing display)
      fastify.get("/api/billing/plans", async () => {
        const plans = await listPlans(true);
        return { success: true, data: plans };
      });

      // GET /api/billing/plans/:id — single plan (public)
      fastify.get("/api/billing/plans/:id", async (request) => {
        const { id } = request.params as { id: string };
        const plan = await getPlan(id);
        if (!plan) return { success: false, error: "Plan not found" };
        return { success: true, data: plan };
      });

      // POST /api/billing/plans — create plan (auth required)
      fastify.post("/api/billing/plans", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const body = request.body as any;
        const plan = await createPlan(body);
        return { success: true, data: plan };
      });

      // PATCH /api/billing/plans/:id — update plan (auth required)
      fastify.patch("/api/billing/plans/:id", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const { id } = request.params as { id: string };
        const body = request.body as any;
        const plan = await updatePlan(id, body);
        if (!plan) return reply.status(404).send({ success: false, error: "Plan not found" });
        return { success: true, data: plan };
      });

      // DELETE /api/billing/plans/:id — soft-delete plan (auth required)
      fastify.delete("/api/billing/plans/:id", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const { id } = request.params as { id: string };
        const deleted = await deletePlan(id);
        if (!deleted) return reply.status(404).send({ success: false, error: "Plan not found" });
        return { success: true, data: { deleted: true } };
      });

      // -----------------------------------------------------------------------
      // Billing routes
      // -----------------------------------------------------------------------

      // POST /api/billing/checkout — create a Stripe Checkout Session
      fastify.post("/api/billing/checkout", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const body = request.body as { planId?: string; successUrl?: string; cancelUrl?: string; customerEmail?: string } | undefined;

        // Look up the plan to get the Stripe price ID
        let priceId = "";
        if (body?.planId) {
          const plan = await getPlan(body.planId);
          if (!plan) return reply.status(400).send({ success: false, error: "Invalid plan" });
          if (!plan.stripePriceId) return reply.status(400).send({ success: false, error: "Plan has no Stripe price configured" });
          priceId = plan.stripePriceId;
        } else {
          // Fallback to env var for backwards compatibility
          priceId = process.env.STRIPE_PRICE_ID_PRO ?? "";
        }

        if (!priceId) return reply.status(400).send({ success: false, error: "No price ID available" });

        const billing = getBillingProvider();

        const result = await billing.createCheckoutSession({
          tenantId: caller.tenantId,
          priceId,
          successUrl: body?.successUrl ?? `${request.headers.origin ?? ""}/billing?success=true`,
          cancelUrl: body?.cancelUrl ?? `${request.headers.origin ?? ""}/billing?canceled=true`,
          customerEmail: body?.customerEmail,
        });

        return { success: true, data: result };
      });

      // GET /api/billing/subscription — current subscription for the tenant
      fastify.get("/api/billing/subscription", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const billing = getBillingProvider();
        const sub = await billing.getSubscription(caller.tenantId);
        return { success: true, data: sub };
      });

      // POST /api/billing/cancel — cancel subscription at period end
      fastify.post("/api/billing/cancel", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const billing = getBillingProvider();
        const canceled = await billing.cancelSubscription(caller.tenantId);
        return { success: true, data: { canceled } };
      });

      // POST /api/billing/portal — create a Stripe Customer Portal session
      fastify.post("/api/billing/portal", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const billing = getBillingProvider();
        const result = await billing.createPortalSession({
          tenantId: caller.tenantId,
          returnUrl: `${request.headers.origin ?? ""}/billing`,
        });

        return { success: true, data: result };
      });

      // POST /api/billing/webhook — Stripe webhook (PUBLIC, no auth)
      fastify.post("/api/billing/webhook", {
        config: { rawBody: true },
      }, async (request, reply) => {
        const signature = request.headers["stripe-signature"] as string;
        if (!signature) {
          return reply.status(400).send({ success: false, error: "Missing stripe-signature header" });
        }

        const billing = getBillingProvider();
        const rawBody = typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);

        const result = await billing.handleWebhook(rawBody, signature);
        return { success: true, data: result };
      });

      // GET /api/billing/invoices — invoice history
      fastify.get("/api/billing/invoices", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const billing = getBillingProvider();
        const invoices = await billing.getInvoices(caller.tenantId);
        return { success: true, data: invoices };
      });
    });

    ctx.logger.info("Billing routes registered");
  },
};
