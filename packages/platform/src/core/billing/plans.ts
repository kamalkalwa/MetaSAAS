/**
 * Plan Management
 *
 * CRUD operations for subscription plans (tiers).
 * Plans are admin-managed and stored in the database.
 * Each plan can be tied to a Stripe price ID for checkout.
 */

import { getDatabase } from "../database/connection.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: "month" | "year" | "one_time";
  stripePriceId: string | null;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  interval?: "month" | "year" | "one_time";
  stripePriceId?: string;
  features?: string[];
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  interval?: "month" | "year" | "one_time";
  stripePriceId?: string;
  features?: string[];
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRow(r: any): Plan {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    priceCents: Number(r.price_cents),
    currency: r.currency,
    interval: r.interval,
    stripePriceId: r.stripe_price_id ?? null,
    features: Array.isArray(r.features) ? r.features : [],
    sortOrder: Number(r.sort_order),
    isActive: r.is_active,
    isDefault: r.is_default,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** List plans ordered by sort_order. Optionally filter to active-only. */
export async function listPlans(activeOnly = true): Promise<Plan[]> {
  const { sql: pgSql } = getDatabase();
  const where = activeOnly ? "WHERE is_active = TRUE" : "";
  const rows = await pgSql.unsafe(
    `SELECT * FROM plans ${where} ORDER BY sort_order ASC, created_at ASC`
  );
  return rows.map(mapRow);
}

/** Fetch a single plan by ID. */
export async function getPlan(id: string): Promise<Plan | null> {
  const { sql: pgSql } = getDatabase();
  const rows = await pgSql.unsafe(
    `SELECT * FROM plans WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/** Create a new plan. */
export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const { sql: pgSql } = getDatabase();
  const rows = await pgSql.unsafe(
    `INSERT INTO plans (name, description, price_cents, currency, interval, stripe_price_id, features, sort_order, is_active, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.priceCents,
      input.currency ?? "usd",
      input.interval ?? "month",
      input.stripePriceId ?? null,
      JSON.stringify(input.features ?? []),
      input.sortOrder ?? 0,
      input.isActive ?? true,
      input.isDefault ?? false,
    ]
  );
  return mapRow(rows[0]);
}

/** Update an existing plan. Returns null if not found. */
export async function updatePlan(id: string, input: UpdatePlanInput): Promise<Plan | null> {
  const { sql: pgSql } = getDatabase();

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (input.name !== undefined) { sets.push(`name = $${idx++}`); params.push(input.name); }
  if (input.description !== undefined) { sets.push(`description = $${idx++}`); params.push(input.description); }
  if (input.priceCents !== undefined) { sets.push(`price_cents = $${idx++}`); params.push(input.priceCents); }
  if (input.currency !== undefined) { sets.push(`currency = $${idx++}`); params.push(input.currency); }
  if (input.interval !== undefined) { sets.push(`interval = $${idx++}`); params.push(input.interval); }
  if (input.stripePriceId !== undefined) { sets.push(`stripe_price_id = $${idx++}`); params.push(input.stripePriceId); }
  if (input.features !== undefined) { sets.push(`features = $${idx++}::jsonb`); params.push(JSON.stringify(input.features)); }
  if (input.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(input.sortOrder); }
  if (input.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(input.isActive); }
  if (input.isDefault !== undefined) { sets.push(`is_default = $${idx++}`); params.push(input.isDefault); }

  if (sets.length === 0) return getPlan(id);

  sets.push("updated_at = NOW()");
  params.push(id);

  const rows = await pgSql.unsafe(
    `UPDATE plans SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/** Soft-delete a plan (set is_active=false). */
export async function deletePlan(id: string): Promise<boolean> {
  const { sql: pgSql } = getDatabase();
  const rows = await pgSql.unsafe(
    `UPDATE plans SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

const DEFAULT_PLANS: (CreatePlanInput & { priceCents: number })[] = [
  {
    name: "Free",
    description: "Get started with the basics",
    priceCents: 0,
    interval: "month",
    features: ["Up to 100 records", "1 user", "Community support"],
    sortOrder: 0,
    isDefault: true,
  },
  {
    name: "Pro",
    description: "For growing teams and serious builders",
    priceCents: 2900,
    interval: "month",
    features: ["Unlimited records", "Up to 10 users", "Priority support", "AI assistant", "Custom workflows"],
    sortOrder: 1,
  },
  {
    name: "Enterprise",
    description: "For organizations with advanced needs",
    priceCents: 9900,
    interval: "month",
    features: ["Unlimited everything", "Unlimited users", "Dedicated support", "SSO / SAML", "Custom integrations", "SLA"],
    sortOrder: 2,
  },
];

/**
 * Seeds default plans if the plans table is empty.
 * Idempotent — safe to call on every startup.
 */
export async function seedDefaultPlans(): Promise<void> {
  try {
    const { sql: pgSql } = getDatabase();
    const countRows = await pgSql.unsafe(`SELECT COUNT(*)::int AS count FROM plans`);
    if (countRows[0].count > 0) return;

    for (const plan of DEFAULT_PLANS) {
      await pgSql.unsafe(
        `INSERT INTO plans (name, description, price_cents, currency, interval, features, sort_order, is_active, is_default)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, TRUE, $8)`,
        [
          plan.name,
          plan.description ?? null,
          plan.priceCents,
          plan.currency ?? "usd",
          plan.interval ?? "month",
          JSON.stringify(plan.features ?? []),
          plan.sortOrder ?? 0,
          plan.isDefault ?? false,
        ]
      );
    }
    console.log("[billing] Seeded default plans: Free, Pro, Enterprise");
  } catch (err) {
    // Seeding is non-critical — if plans table doesn't exist yet, skip silently
    const message = err instanceof Error ? err.message : "Unknown error";
    if (!message.includes("does not exist")) {
      console.error("[billing] Failed to seed plans:", message);
    }
  }
}
