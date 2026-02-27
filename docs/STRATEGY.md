# MetaSAAS — Strategy

> Single source of truth for all strategic, architectural, and business decisions.
> Cross-reference this doc from any chat session to maintain continuity.

---

## 1. Vision

MetaSAAS is an **AI-native SaaS framework** that handles ~80% of what every SaaS application needs:

- **Entity-driven**: Define entities declaratively → get CRUD, API, DB, UI auto-generated
- **Action Bus**: Universal dispatch pipeline (validation → permission → workflow → execute → log)
- **AI layer**: Natural language → intent resolution → Action Bus dispatch
- **Multi-domain**: One framework, any vertical (CRM, HR, project management, etc.)

MetaSAAS serves two purposes:
1. **Platform** — We use it to build AI applications ourselves
2. **Product** — We sell it to technical and non-technical people to build modern SaaS apps with AI

---

## 2. What's Built (Phases 1–9)

| Phase | What | Status |
|-------|------|--------|
| 1 | Monorepo, Contracts, Entity Definitions | Done |
| 2 | Action Bus, CRUD generation, Entity Manager | Done |
| 3 | REST Adapter, Fastify server | Done |
| 4 | PostgreSQL + Drizzle ORM, auto-migrations | Done |
| 5 | AI Gateway (Gemini/OpenAI/Anthropic), command system | Done |
| 6 | Event Bus, Webhooks, Permissions | Done |
| 7 | Supabase Auth + DevAuthProvider fallback | Done |
| 8 | Next.js frontend, entity-driven UI, chat sidebar | Done |
| 9 | Dark mode, UI component library, test suite (348 tests) | Done |

### Architecture Summary

```
apps/
  api/          → Fastify server (bootstrap.ts wires everything)
  web/          → Next.js frontend (entity-driven UI)
packages/
  contracts/    → Shared TypeScript interfaces (EntityDefinition, FieldType, etc.)
  platform/     → Core engine (Action Bus, DB, AI, REST adapter, licensing)
  domain/       → Business entities (5 domains, 13 entities)
  ui/           → Shared React components
```

### Key Patterns

- **Provider pattern**: Interface in contracts → multiple implementations (real + dev fallback)
- **Everything works without env vars**: DevAuthProvider, console email, local storage, etc.
- **Entity definitions are the source of truth**: DB schema, API routes, UI forms all derived from them
- **Action Bus is the universal funnel**: Every mutation flows through it regardless of entry point

---

## 3. Business Model — Open-Core (Two-Repo Strategy)

### Decision (Final)

Split into **two repositories**:

| | Public Repo (MIT) | Private Pro Repo |
|---|---|---|
| **What** | Full platform + all free features | Enterprise add-ons only |
| **Protection** | Code is visible, fully functional | Code physically absent from free version |
| **Revenue** | Drives adoption | Drives revenue |

### Why Two Repos?

A single-repo license key is a "software lock on an open door" — determined developers can bypass `isFeatureEnabled()` checks in open source code. With two repos, premium code is physically absent from the public repo. Users can't reverse-engineer what doesn't exist.

### Plugin Host System

The public repo defines extension points. The pro repo plugs into them:

```typescript
// Public repo — defines the interface
interface PluginHost {
  registerBillingProvider(provider: BillingProvider): void;
  registerSSOProvider(provider: SSOProvider): void;
  registerWhiteLabelConfig(config: WhiteLabelConfig): void;
  registerRBACProvider(provider: RBACProvider): void;
}

// Pro repo — registers implementations
import { pluginHost } from "@metasaas/platform";
import { StripeBilling } from "./billing/stripe.js";
pluginHost.registerBillingProvider(new StripeBilling());
```

---

## 4. Free vs. Pro Feature Split

### Guiding Principle

> Be as generous as Replit/Lovable. Don't lock out anything that prevents people from building and testing. Lock only enterprise-grade features that paying businesses need.

### FREE (Public Repo) — Everything You Need to Build

| Category | Features | Notes |
|----------|----------|-------|
| Core | Entity Manager, Action Bus, CRUD generation | Unlimited entities |
| AI | Chat, commands, entity generation, entity evolution | Full AI capabilities |
| Views | List, Kanban, Calendar | All view types |
| Integrations | Webhooks, Email (Resend), File Storage (S3/R2) | Full integrations |
| Billing | Stripe checkout, subscriptions, portal, plans | Full billing stack |
| Notifications | In-app notifications, Event Bus auto-dispatch | Real-time alerts |
| Data | Bulk actions, Import/Export, Audit log | No limits |
| Auth | Supabase Auth, DevAuthProvider | Standard auth |
| Deployment | Docker, docker-compose | Full deployment |
| UI | Dark mode, component library, responsive | Complete frontend |

### PRO (Private Repo) — Enterprise Features (3 total)

| Feature | Why Pro | What It Does |
|---------|---------|--------------|
| **SSO / SAML** | Enterprise security requirement | Single sign-on for large orgs |
| **White-label** | Custom branding for resellers | Remove MetaSAAS branding, custom themes |
| **Advanced RBAC** | Fine-grained permissions | Role hierarchies, field-level access, custom policies |

### What This Means

- Someone can clone the public repo, build a full SaaS app with AI, billing, and notifications, deploy it, and make money — without paying us anything
- They only need PRO when they land enterprise clients (SSO, white-label) or need fine-grained permissions
- This maximizes adoption and creates a natural upgrade path

---

## 5. Licensing Architecture

### How It Works

1. **Feature IDs** defined in `packages/platform/src/core/licensing/features.ts`
2. **License keys** are JWTs signed with our RSA private key
3. **Validator** (`validator.ts`) verifies signatures with the embedded public key
4. **`isFeatureEnabled(feature)`** and **`requireFeature(feature)`** used to gate code
5. **`FeatureLockedError`** caught by REST adapter → returns HTTP 402

### Key Files

| File | Purpose |
|------|---------|
| `packages/platform/src/core/licensing/features.ts` | Feature ID constants, FREE_FEATURES list |
| `packages/platform/src/core/licensing/validator.ts` | JWT/RSA signature verification (public key embedded) |
| `packages/platform/src/core/licensing/index.ts` | Main API: init, check, require, error class |
| `packages/platform/src/core/licensing/licensing.test.ts` | 17 tests |
| `tools/license-keygen/generate.ts` | PRIVATE — RSA key + CLI to generate license keys (gitignored) |

### Design Principles

- **Tier mapping lives in the license key**, NOT in source code — platform has no knowledge of "pro" or "enterprise"
- **Never throws** — invalid/expired keys fall back to free tier with a warning
- **Loosely coupled** — one function call to gate anything: `isFeatureEnabled(FEATURES.BILLING)`
- **Offline** — no phone-home, no remote validation

### Current State (Updated 2026-02-27)

Licensing has been simplified to match the final decision:

- `FREE_FEATURES` includes 14 features (AI, all views, webhooks, email, storage, billing, etc.)
- `PRO_FEATURES` includes only 3: SSO, white-label, advanced RBAC
- Billing moved from PRO to FREE — ships in public repo with Stripe integration
- `FREE_ENTITY_LIMIT` removed — unlimited entities for everyone
- `bootstrap.ts` — no entity limits, no AI gating, everything initializes always
- `adapter.ts` — no route gates on AI/webhook/chat endpoints
- 16 licensing tests passing

---

## 6. Module Roadmap (Build Order)

### Priority 1: Email Module
- **Provider**: Resend ($0 for 3K emails/month)
- **Path**: `packages/platform/src/core/email/`
- **Pattern**: `initEmail()`, `sendEmail()`, `sendTemplatedEmail()`
- **Fallback**: Console provider (logs to console, no API key needed)
- **Status**: FREE — in public repo
- **Env vars**: `RESEND_API_KEY`, `EMAIL_FROM`

### Priority 2: File Storage Module
- **Provider**: S3-compatible (AWS S3, Cloudflare R2, MinIO)
- **Path**: `packages/platform/src/core/storage/`
- **Pattern**: `initStorage()`, `uploadFile()`, `getFileUrl()`, `deleteFile()`
- **Fallback**: Local provider (saves to `./uploads/`)
- **Status**: FREE — in public repo
- **Env vars**: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
- **New field type**: `file` in contracts (stores URL as text)

### Priority 3: Billing Module (Stripe)
- **Provider**: Stripe (ConsoleBillingProvider fallback)
- **Path**: `packages/platform/src/core/billing/`
- **Pattern**: `initBilling()`, `createCheckoutSession()`, `handleWebhook()`
- **Status**: FREE — ships in public repo. Admin-managed plans with database CRUD.
- **Env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Plugin integration**: Registers via billingPlugin (MetaSAASPlugin)

### Priority 4: One-Command Entity Installer
- **Path**: `packages/platform/src/ai/entity-installer.ts`
- **What**: AI generates entity JSON → installer writes `.entity.ts`, updates imports, runs migration
- **Goal**: "Few prompts → running app" magic moment

### Priority 5: CI/CD Pipeline
- **Path**: `.github/workflows/ci.yml`
- **What**: Test + build on every push, tag-based releases, Docker image publishing

### Priority 6: Monitoring (Week 2)
- Sentry integration for error tracking
- Health dashboard

---

## 7. Revenue Strategy

### Two Revenue Streams

| Stream | Price | Target |
|--------|-------|--------|
| **A. Framework Sales** | $149 early access → $299 | Technical founders, agencies, CTOs |
| **B. Build Service** | $1,500/MVP | Non-technical founders who want an app built |

### Revenue Stream A: Framework Sales

**Delivery**: GitHub repo access (private repo invite) or zip download
**Platform**: Gumroad or Lemonsqueezy
**What they get**: Full source code, 5 example domains, documentation, pro features

### Revenue Stream B: Build Service

**Pitch**: "I'll build your SaaS MVP in 48 hours — $1,500"
**Competitive advantage**: MetaSAAS lets us deliver in hours, not weeks
**Channels**: LinkedIn DMs, Twitter, Indie Hackers, Upwork

### Launch Channels

- LinkedIn announcement
- Twitter/X
- Reddit: r/SaaS, r/webdev, r/nextjs, r/typescript
- Indie Hackers product launch
- Dev.to technical deep-dive
- Product Hunt

### Detailed Playbook

See [docs/CUSTOMER-ACQUISITION-PLAYBOOK.md](./CUSTOMER-ACQUISITION-PLAYBOOK.md) for:
- Copy-paste outreach templates
- Pricing tiers
- Day-by-day schedule
- Objection handling
- Tracking metrics

---

## 8. Key Architectural Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Two-repo open-core model | Single-repo license key is bypassable; two repos = true code protection |
| 2 | Only 3 features in PRO | Generous free tier drives adoption; compare with Replit/Lovable |
| 3 | Unlimited entities in free tier | Entity limits frustrate users and block real evaluation |
| 4 | AI is free | AI is the primary differentiator; locking it defeats the purpose |
| 5 | All views (kanban/calendar) free | Locking views prevents proper testing; bad UX |
| 6 | Webhooks, email, storage free | These are core infrastructure; locking them blocks deployment |
| 7 | Billing is FREE | Stripe integration ships in public repo — maximizes adoption; monetize on service layer |
| 8 | SSO/SAML is PRO | Only enterprise customers need this |
| 9 | White-label is PRO | Only resellers/agencies need this |
| 10 | Advanced RBAC is PRO | Basic RBAC is free; fine-grained policies are enterprise |
| 11 | License key = JWT signed with RSA | Offline verification, no phone-home, users can decode but can't forge |
| 12 | Tier mapping in key, not source | Platform has no knowledge of pricing/tiers; we control mapping at key generation |
| 13 | Provider pattern everywhere | Every module has interface + real impl + dev fallback |
| 14 | Everything works without env vars | Clone → run → works. No setup friction. |

---

## 9. Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict) |
| Backend | Fastify |
| Frontend | Next.js 15 (App Router) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Supabase Auth (optional, DevAuthProvider fallback) |
| AI | Google Gemini / OpenAI / Anthropic (auto-detect) |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest (348 tests across 21 test files) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Docker + docker-compose |

---

## 10. Environment Variables

### Required
| Var | Default | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | `postgresql://metasaas:metasaas@localhost:5433/metasaas` | PostgreSQL connection |

### Optional (app works without them)
| Var | Purpose |
|-----|---------|
| `SUPABASE_URL` | Supabase Auth (falls back to DevAuthProvider) |
| `SUPABASE_SERVICE_KEY` | Supabase Auth server key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth client URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth client key |
| `AI_PROVIDER` | Force AI provider (gemini/openai/anthropic) |
| `GOOGLE_AI_API_KEY` | Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `METASAAS_LICENSE_KEY` | License key JWT (free tier without it) |
| `RESEND_API_KEY` | Email via Resend (console fallback without it) |
| `EMAIL_FROM` | Sender address for emails |
| `STORAGE_ENDPOINT` | S3-compatible endpoint (local fallback without it) |
| `STORAGE_BUCKET` | Storage bucket name |
| `STORAGE_ACCESS_KEY` | Storage access key |
| `STORAGE_SECRET_KEY` | Storage secret key |
| `STORAGE_REGION` | Storage region (defaults to "auto") |
| `STORAGE_PUBLIC_URL` | CDN URL for public file access |
| `STRIPE_SECRET_KEY` | Stripe billing — PRO only (planned) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification — PRO only (planned) |

---

## 11. Key File Paths

| Path | What |
|------|------|
| `apps/api/src/bootstrap.ts` | Wires platform + domain (THE single integration point) |
| `apps/api/src/server.ts` | Fastify server entry point |
| `apps/web/src/app/` | Next.js pages and layouts |
| `packages/contracts/src/` | Shared TypeScript interfaces |
| `packages/platform/src/core/action-bus/` | Action Bus (dispatch, middleware, registry) |
| `packages/platform/src/core/entity-manager/` | Entity registration and management |
| `packages/platform/src/core/database/` | Drizzle schema builder, migrations, connection |
| `packages/platform/src/core/licensing/` | Feature gating, JWT validation |
| `packages/platform/src/ai/` | AI gateway, command interpreter, chat store |
| `packages/platform/src/adapters/rest/` | REST adapter (Fastify routes) |
| `packages/platform/src/auth/` | Auth providers (Supabase, Dev) |
| `packages/platform/src/core/webhooks/` | Webhook registration, delivery, Event Bus integration |
| `packages/domain/src/` | Business entities (CRM, HR, projects, etc.) |
| `packages/ui/src/` | Shared React components |
| `tools/license-keygen/` | PRIVATE — license key generator (gitignored) |
| `docs/CUSTOMER-ACQUISITION-PLAYBOOK.md` | Outreach templates, pricing, launch plan |

---

## 12. Domains Validated

| Domain | Entities | Purpose |
|--------|----------|---------|
| CRM | Contact, Company, Deal, Activity | Sales pipeline |
| HR | Employee, Department, LeaveRequest | People management |
| Project | Project, Task | Project tracking |
| Content | Article | CMS/blog |
| Support | Ticket | Customer support |

Each domain proves the framework works for a different vertical. Total: **13 entities across 5 domains**.

---

## 13. Gap Analysis (Updated 2026-02-26)

| Gap | Priority | Status |
|-----|----------|--------|
| ~~Email module~~ | ~~P1~~ | **Done** — Resend + console fallback |
| ~~File storage module~~ | ~~P2~~ | **Done** — S3-compatible + local fallback |
| ~~Entity installer~~ | ~~P4~~ | **Done** — Hot-install at runtime |
| ~~CI/CD pipeline~~ | ~~P5~~ | **Done** — GitHub Actions |
| ~~Licensing simplification~~ | ~~Blocker~~ | **Done** — 4 PRO features only |
| Landing page with payment | P0 (revenue) | Not started |
| Plugin host system | P1 | Not started (prerequisite for PRO repo) |
| Billing module (PRO) | P2 | Not started (private repo) |
| Monitoring/Sentry | P2 | Deferred |
| SSO/SAML (PRO) | Future | Not started |
| White-label (PRO) | Future | Not started |
| Advanced RBAC (PRO) | Future | Not started |

---

## 14. Next Actions

See [docs/ROADMAP.md](./ROADMAP.md) for the living, prioritized task list.
