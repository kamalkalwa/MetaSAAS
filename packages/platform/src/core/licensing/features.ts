/**
 * Feature Flags
 *
 * All gatable features in the platform. The platform only knows feature IDs —
 * it has NO knowledge of tiers or pricing. Which features belong to which
 * tier is controlled entirely by the license key issuer (us).
 *
 * Philosophy: Be generous. Only gate enterprise-grade features that paying
 * businesses need. Everything else is free to maximize adoption.
 *
 * FREE: AI, all views, webhooks, email, storage, billing, entities (unlimited),
 *       bulk actions, import/export, audit log, multi-tenancy, deployment.
 *
 * PRO (3 features): SSO, White-label, Advanced RBAC.
 *       These live in a separate private repo — code physically absent from free.
 */

/**
 * Feature identifiers. Dot-notation namespacing for organization.
 * The platform checks these against the license key's `features` array.
 *
 * Only PRO features need gating. Free features are listed here for
 * completeness and so the /api/meta/features endpoint can report them.
 */
export const FEATURES = {
  // --- FREE (always enabled, no license needed) ---
  AI_CHAT: "ai.chat",
  AI_COMMANDS: "ai.commands",
  AI_ENTITY_GENERATION: "ai.entity_generation",
  AI_ENTITY_EVOLUTION: "ai.entity_evolution",
  VIEW_KANBAN: "views.kanban",
  VIEW_CALENDAR: "views.calendar",
  WEBHOOKS: "webhooks",
  EMAIL: "email",
  STORAGE: "storage",
  BULK_ACTIONS: "bulk_actions",
  IMPORT_EXPORT: "import_export",
  AUDIT_LOG: "audit_log",
  MULTI_TENANCY: "multi_tenancy",

  // --- PRO (requires license key) ---
  BILLING: "billing",
  SSO: "sso",
  WHITE_LABEL: "white_label",
  ADVANCED_RBAC: "advanced_rbac",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Features available without any license key.
 * This is deliberately generous — everything except the 3 PRO features.
 *
 * Core platform (Action Bus, CRUD, REST, DB, Event Bus, auth, AI, all views,
 * webhooks, email, storage) always works. No entity limits. No AI limits.
 */
export const FREE_FEATURES: readonly Feature[] = [
  FEATURES.AI_CHAT,
  FEATURES.AI_COMMANDS,
  FEATURES.AI_ENTITY_GENERATION,
  FEATURES.AI_ENTITY_EVOLUTION,
  FEATURES.VIEW_KANBAN,
  FEATURES.VIEW_CALENDAR,
  FEATURES.WEBHOOKS,
  FEATURES.EMAIL,
  FEATURES.STORAGE,
  FEATURES.BULK_ACTIONS,
  FEATURES.IMPORT_EXPORT,
  FEATURES.AUDIT_LOG,
  FEATURES.MULTI_TENANCY,
  FEATURES.BILLING,
];

/**
 * Features that require a valid license key (PRO).
 * These 3 features are the only ones gated. Their implementations
 * live in a separate private repository.
 */
export const PRO_FEATURES: readonly Feature[] = [
  FEATURES.SSO,
  FEATURES.WHITE_LABEL,
  FEATURES.ADVANCED_RBAC,
];
