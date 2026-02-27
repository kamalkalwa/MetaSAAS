# MetaSAAS — Vision, Phases & Milestones

> "With very few prompts I can change the entire application to a new business problem.
> The goal is if I want to launch a production-grade application at scale with all the
> best practices, it should be in the least effort."

**Related docs:**
- [docs/ROADMAP.md](docs/ROADMAP.md) — Living technical roadmap (what's next, what's done, module status)
- [docs/STRATEGY.md](docs/STRATEGY.md) — Strategic decisions, business model, licensing, revenue
- [docs/CUSTOMER-ACQUISITION-PLAYBOOK.md](docs/CUSTOMER-ACQUISITION-PLAYBOOK.md) — Outreach templates, pricing, launch plan

---

## The Problem

80% of every SaaS application is identical infrastructure — authentication, billing,
CRUD operations, email, file storage, admin interfaces, monitoring, CI/CD pipelines.
Developers rebuild this foundation every time. Weeks of work before a single line of
business logic. The remaining 20% — the unique business logic — is the only part that
actually matters.

With AI-agentic coding on the rise, people spin up applications from plain English
prompts. But every new idea starts from scratch. There is no reusable, production-grade
foundation that can be reshaped to fit any business problem.

## The Solution

MetaSAAS is not a code generator. It is not a low-code platform. It is a **business-
problem-agnostic application shell** where the domain logic is the only variable.
Everything else — auth, multi-tenancy, CRUD patterns, UI patterns, AI integration,
deployment, monitoring — stays constant.

```
Traditional app:     Code is the product.
MetaSAAS app:        BLUEPRINTs are the product. Code is the output.
```

When you want to pivot the application to a new business problem, you don't rewrite
code. You rewrite BLUEPRINTs. The domain BLUEPRINTs change (new entities, relationships,
rules). The platform BLUEPRINTs stay the same. AI agents read the new BLUEPRINTs and
generate the new code. The application is defined by its BLUEPRINTs, not by its code.

## Core Principles

### 1. AI-Native, Not AI-Integrated

> The UI is one possible interface, not THE interface.

A click on a "Create Contact" button and a spoken command "add John from Acme to my
contacts" and an AI agent deciding to create a contact — these are all the **same
operation**, just triggered differently. The core of the application isn't screens.
It's **actions**.

Systems surviving technological shifts — like Unix tools persisting for 50 years —
separate what the application does from how users interact with it. An AI-native
architecture means thinking in terms of intents and actions rather than screens and
routes.

### 2. The Living Architecture

A monorepo where platform code and domain code live in clearly separated spaces.
Platform updates can be pulled from upstream. Domain code is untouched by platform
updates. The separation between platform and domain is sacred.

```
Template repo (upstream)          Your project (fork)
─────────────────────            ────────────────────

packages/platform/  ──────────→  packages/platform/     (pull updates)
packages/contracts/ ──────────→  packages/contracts/    (pull updates)
apps/web/           ──────────→  apps/web/              (pull updates)

                                 packages/domain/       ← YOURS. Never touched by upstream.
```

### 3. Three Layers of Complexity

```
LAYER 1: Pure Declaration (~70% of any application)
─────────────────────────────────────────────────────
Entity definitions, field types, relationships, simple workflows,
basic AI (enrichment), standard views (list + detail + form).
AI generates these entirely from natural language.

LAYER 2: Configuration (~25% of any application)
─────────────────────────────────────────────────────
Custom views (kanban, calendar, dashboards), reactive automations,
multi-step AI workflows, complex validations, bulk operations.
AI generates most of these from short configuration prompts.

LAYER 3: Custom Code (~5% of any application)
─────────────────────────────────────────────────────
Custom pages, third-party integrations, unique interactions,
specialized algorithms, hardware integration.
The developer writes this. But it runs inside the platform pipeline.
```

### 4. Actions Are the Universal Interface

Every Action is:
- **Typed** — input and output validated with Zod
- **Described** — AI agents can discover and understand it
- **Permissioned** — the platform enforces who can execute it
- **Observable** — the platform logs, meters, and traces it

The UI triggers actions via clicks. The REST API triggers them via HTTP.
The AI triggers them via natural language. The EventBus triggers them via events.
All through the same pipeline: Validate → Authorize → Hook → Execute → Log.

### 5. BLUEPRINTs ARE the Architecture

Every directory has a BLUEPRINT.md. Before you build anything, read its BLUEPRINT.
The architecture lives in the BLUEPRINTs, not in the code. The code is an
implementation of the architecture. When the architecture evolves, the BLUEPRINTs
evolve, and the code follows naturally.

### 6. Sacred Laws

1. The perfect amount of code to maintain is 0 lines.
2. Assume your users are either black hat hackers or people who never used a computer.
3. The solution should be so obvious you can't understand why it wasn't done that way
   in the first place.
   - 3.1. A good solution is one a 5-year-old could understand, but only a genius
     could have come up with.

---

## Phases & Milestones

### Phase 0: Validate the Abstraction ✅ COMPLETE

**Goal**: Prove the contracts are expressive enough for any SaaS business problem.

**What was done**:
- Expressed three wildly different domains using Entity, Action, and AI Capability
  contracts: CRM (Company, Contact), Project Management (Project, Task), Inventory
  (Warehouse, Product)
- Validated contracts cover: field types, relationships, workflows, AI capabilities,
  UI configuration, hooks, side effects, permissions
- Confirmed the schema captures 70-90% of each app without custom code

**Milestone**: Contracts work for all three domains. Proceed.

---

### Phase 1: Prove the Core ✅ COMPLETE

**Goal**: Build the smallest thing that demonstrates the architecture works end-to-end.

**What was built**:
- Action Bus — register, dispatch, validate, permission check, workflow checks, hooks
- 6 entities — fully working CRUD through the Action Bus
- Web UI — Next.js 15 with App Router, entity-driven pages (list, detail, create, edit)
- REST Adapter — auto-generated from action definitions (generic + RESTful per-entity)
- Auth — Supabase JWT (production) + DevAuthProvider (local development)
- Platform/Domain/Contracts separation — verified clean, no violations
- Database — Drizzle ORM, schema builder, migration runner, schema evolution
- Event Bus — pub/sub with exact match and wildcard subscriptions
- Entity Manager — registry + CRUD generator (5 actions per entity)

**Milestone**: "I can define an entity, and the platform gives me a working app." ✅

**Test count**: 307 tests passing.

---

### Phase 2: Add the AI Layer ✅ COMPLETE

**Goal**: Prove the AI-native architecture works, not just the CRUD architecture.

**What was built**:
- AI Gateway — 3 providers (Google Gemini, OpenAI, Anthropic), auto-detection,
  explicit selection via `AI_PROVIDER` env var
- AI Capability declarations — entities declare what AI should do, platform handles how
- Auto-triggers — `on_create` and `on_update` events automatically fire AI capabilities
- Entity enrichment — product.describe generates descriptions via Gemini on create
- Command Bar (Cmd+K) — natural language → Action Bus dispatch, same security pipeline
- AI Command Interpreter — maps natural language to registered actions using AI

**Security**:
- API keys server-side only
- AI responses validated through Zod schemas
- AI errors never break the application (graceful fallback)
- Command interpreter length-limited (2000 chars)
- AI only selects from registered actions — cannot fabricate action IDs
- Command Bar dispatches through the same Action Bus (same permissions, validation)

**Milestone**: "A natural language command has the same security as a button click." ✅

**Test count**: 320 tests passing (13 new tests for AI command + side effects).

---

### Phase 3: Expand Modules ✅ COMPLETE

**Goal**: Add modules based on demand, each following the contracts.

**What was built**:
- Multi-tenancy — `tenant_id` on all tables, all queries scoped by caller's tenant
- Authentication — Supabase JWT flow (signup, login, token forwarding, tenant scoping)
- Side Effects — `SideEffect` contract wired in Action Bus (`emit_event`, `notify`, `webhook`)
- Event Subscribers — 3 domain subscribers proving EventBus end-to-end:
  - Task workflow transitions (status changes)
  - Product discontinued notifications
  - Wildcard audit logging (all creation events)
- Layer 3 Hooks — `beforeExecute`/`afterExecute` in Action Bus pipeline
- Kanban + Calendar views — entity-driven, groupBy/dateField from entity definition
- Schema evolution — auto-migration when entity fields change

**Deferred (by design)**:
- Billing module — too app-specific for a template; architecture supports it
- Full notification module — EventBus + subscribers prove the pattern; production
  apps extend with email/push
- Platform update mechanism — structural separation makes it possible; needs stable
  v1 as first upstream version

**Milestone**: "Architecture proven extensible. Modules follow contracts." ✅

---

### Phase 4: The "Few Prompts" Experience ✅ COMPLETE

**Goal**: Build the developer experience where AI generates domain schemas from natural
language descriptions. This is the capstone, not the foundation.

**What was built**:
- AI Chat Sidebar — persistent right panel replacing the Cmd+K popup
  - Multi-turn conversations — sends last 10 messages as context to the AI
  - Session history — browse, load, delete previous conversations
  - Database-backed persistence — `chat_sessions` + `chat_messages` tables
  - Streaming responses via SSE — real-time progress (thinking → interpreting → executing)
- Production-grade UI polish:
  - Indigo/blue primary color palette (professional, accessible)
  - Dark mode support (automatic via `prefers-color-scheme`)
  - Custom scrollbar styling, font smoothing, selection highlights
  - Responsive mobile backdrop for the chat sidebar
- CORS fix — auth middleware now skips OPTIONS preflight (was blocking PATCH/DELETE)
- Platform migration system — `runPlatformMigrations()` for non-entity tables

**Remaining (deferred)**:
- Conversational entity creation — AI generates entity definitions from description
- BLUEPRINT generation — AI writes BLUEPRINT.md from natural language
- Schema suggestion — AI proposes fields, relationships, workflows from intent

**Success criteria**: ✅ Chat sidebar with session persistence, streaming, multi-turn
context, and production-grade UI polish. Entity generation is Phase 6.

---

### Phase 5: Hardening & Production Readiness ✅ COMPLETE

**Goal**: Make MetaSAAS production-deployable with confidence.

**What was built**:
- Database-backed chat persistence (platform migration system)
- Streaming AI responses (SSE endpoint with progress events)
- CORS fix for PATCH/DELETE methods (OPTIONS preflight handling)
- Meta endpoint auth bypass (public metadata routes)
- `defaultValue` fix in CRUD generator — required fields with `defaultValue` are now
  optional in Zod schemas via `.optional().default(field.defaultValue)`. Previously
  `defaultValue` was dead code; callers always had to send the value explicitly.
  This is a platform-wide fix affecting all entities, all entry points (AI, REST, UI).
- AI field-name accuracy — the system prompt now includes exact field names, types,
  required/optional status, default values, and enum options for every action. Previously
  the AI had zero field information and guessed wrong names (e.g., `name` instead of
  `title`). Fixed by embedding field hints into action descriptions and examples in the
  CRUD generator, and reinforcing exact field name usage in the system prompt.
- Rate limiting (`@fastify/rate-limit`) — 100 requests/minute per IP, configurable
  via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` env vars. Public routes exempted.
- Security headers (`@fastify/helmet`) — XSS protection, clickjacking prevention,
  MIME sniffing, HSTS, referrer policy, cross-origin isolation.
- Environment-based CORS lockdown — set `CORS_ORIGIN=https://your-app.com` to restrict
  origins. In dev mode, all origins are allowed for convenience.
- Persistent audit logging — `audit_log` table records every Action Bus dispatch with
  tenant, user, action ID, success/failure, duration, input payload, and errors.
  Fire-and-forget — never blocks or breaks action execution.
- Integration tests for multi-tenant isolation and RBAC (13 new tests):
  - Tenant context isolation (no cross-contamination between tenants)
  - Role-based access control (admin, member, system, no-roles)
  - Permission evaluation order (first-match-wins semantics)
  - Pipeline order (validation → permission → execution)
  - Structured error responses (validation, permission, not_found)

**Test count**: 334 tests passing (18 test files, zero failures).

**Remaining (deferred to future iterations)**:
- Ownership-based permissions (`owner` field in PermissionRule)
- Platform update mechanism (git remote tracking, merge strategies)

---

### Phase 6: Conversational Entity Generation ✅ COMPLETE

**Goal**: The user describes a business domain in natural language, and the AI
generates complete entity definitions with fields, relationships, workflows,
and TypeScript code.

**What was built**:
- Entity Generator (`platform/ai/entity-generator.ts`) — takes a natural language
  domain description and returns structured entity definitions via AI
- TypeScript Code Generator (`entityToTypeScript`) — converts generated entity
  definitions into ready-to-use `.entity.ts` files following the exact BLUEPRINT pattern
- Chat Sidebar Integration — the AI command interpreter recognizes domain generation
  requests (e.g., "I want to build a gym management system") and routes them to the
  entity generator via `domain.generate`
- Rich AI prompt engineering — the generation prompt includes the full MetaSAAS contract
  shape, field types, relationship types, workflow patterns, and naming conventions
- Result display — the chat sidebar shows generated entities with field counts,
  relationships, workflows, full TypeScript code, and structured JSON

**What this enables**:
- Describe a business domain in natural language → get production-ready entity definitions
- The generated code follows the exact BLUEPRINT pattern documented in `entities/BLUEPRINT.md`
- Generated entities include correct field types, enums with defaults, relationships,
  workflows with transitions, and UI configuration (views, kanban, calendar)

**Milestone**: "Describe a domain, get entity definitions." ✅

---

### Phase B: Thesis Validation ✅ COMPLETE

**Goal**: Prove that a developer (or AI) can create a new business domain by following
only the existing BLUEPRINTs and contracts, without modifying any platform code.

**What was done**:
- Built a complete Clinic / Healthcare domain from scratch:
  - Doctor (6 fields, availability status)
  - Patient (7 fields, active/inactive status)
  - Appointment (6 fields, belongsTo Doctor + Patient, 5-state workflow, calendar view)
- Followed only the entity BLUEPRINT pattern — zero platform code changes
- All 3 entities auto-generated: CRUD API, database tables, UI pages, AI integration
- Seed data for demo purposes
- Calendar view for appointments rendered automatically

**Friction found**: Only one issue — the domain test had a hardcoded entity count
(`toHaveLength(6)`) that broke when adding entities. Fixed by replacing with
relationship-ordering assertions (`indexOf("Doctor") < indexOf("Appointment")`).

**Milestone**: "Define entities, get a working app — for ANY domain." ✅

---

## Architecture Summary

### Package Structure

```
packages/
  contracts/   → Shared TypeScript interfaces (the boundary between platform and domain)
  platform/    → Infrastructure engine — Action Bus, DB, auth, AI, events
  domain/      → YOUR business entities, workflows, subscribers, custom actions
  ui/          → Shared UI components
apps/
  api/         → Fastify backend (wires platform + domain at bootstrap)
  web/         → Next.js 15 frontend (renders entities dynamically from metadata)
```

### Data Flow

```
User/AI/API  →  REST Adapter / AI Command  →  Action Bus Pipeline  →  Response
                                                    │
                                            Validate (Zod)
                                            Authorize (RBAC)
                                            Before Hook (Layer 3)
                                            Execute (business logic)
                                            After Hook (Layer 3)
                                            Side Effects (fire-and-forget)
                                            Log
                                                    │
                                            Domain Events  →  EventBus  →  Subscribers
```

### Platform Subsystems

| Subsystem | Location | Purpose |
|-----------|----------|---------|
| Action Bus | `platform/core/action-bus/` | Universal dispatch pipeline |
| Event Bus | `platform/core/event-bus/` | Pub/sub for domain events |
| Database | `platform/core/database/` | Drizzle ORM, schema builder, migrations |
| Entity Manager | `platform/core/entity-manager/` | Registry + CRUD generation |
| Config | `platform/core/config/` | Env-based configuration, fail-fast |
| Auth | `platform/auth/` | Supabase + Dev providers |
| AI Gateway | `platform/ai/` | Multi-provider, capabilities, triggers, command interpreter |
| REST Adapter | `platform/adapters/rest/` | HTTP → Action Bus mapping |

### Tech Stack

- **TypeScript** everywhere (no JavaScript, no "any" escape hatches)
- **Turborepo** monorepo management
- **pnpm** package manager
- **Next.js 15** (App Router) frontend
- **Fastify** backend API
- **PostgreSQL** + **Drizzle ORM** database
- **Zod** runtime validation
- **Tailwind CSS** + **shadcn/ui** styling
- **Vitest** testing (334 unit tests across 18 test files)
- **Playwright** E2E testing (14 tests across 3 spec files)

### Entities (Current Domain)

| Entity | Domain | Relationships | Workflows | AI | Views |
|--------|--------|--------------|-----------|-----|-------|
| Company | CRM | — | — | — | List |
| Contact | CRM | belongsTo Company | status | — | List |
| Project | PM | — | status | — | Kanban |
| Task | PM | belongsTo Project | status (4-state) | — | Kanban, Calendar |
| Warehouse | Inventory | — | — | — | List |
| Product | Inventory | belongsTo Warehouse | status (3-state) | describe (on_create) | Kanban |
| Doctor | Clinic | — | — | — | List |
| Patient | Clinic | — | — | — | List |
| Appointment | Clinic | belongsTo Doctor, Patient | status (5-state) | — | Calendar |
| Member | Gym | — | status (3-state) | — | Kanban |
| Trainer | Gym | — | — | — | List |
| Class | Gym | belongsTo Trainer | — | — | Calendar |
| Enrollment | Gym | belongsTo Member, Class | — | — | List |

---

## What Has NOT Been Built (By Design)

These items were consciously deferred, not forgotten:

| Item | Why Deferred | When |
|------|-------------|------|
| Billing module | Too app-specific for a template | Phase 5+ |
| Full notification module | EventBus + subscribers prove the pattern | Phase 5 |
| Platform update mechanism | Needs stable v1 as upstream baseline | Phase 5 |
| RBAC stress testing | Basic auth verified; role permutations are app-specific | Phase 5 |
| Schema evolution (type changes) | ADD COLUMN tested; ALTER TYPE is risky and rare | Phase 5 |
| Complex multi-field workflows | Single-field workflows proven; multi-field is configuration | Phase 5 |
| Dark/light mode toggle | CSS variables ready; UI toggle is cosmetic | Phase 4 |
| ~~Streaming AI responses~~ | ~~Done in Phase 4~~ — SSE streaming with progress events | ✅ |
| ~~Persistent chat history~~ | ~~Done in Phase 5~~ — DB-backed `chat_sessions` + `chat_messages` | ✅ |

---

## Measuring Success

The ultimate measure of MetaSAAS is not lines of code or feature count. It is:

1. **Time to launch**: Can a developer go from business idea to working application
   in hours, not weeks?
2. **Time to pivot**: Can the application be reshaped to a new business problem by
   changing domain BLUEPRINTs, not rewriting infrastructure?
3. **Security by default**: Does a developer have to opt OUT of security, never opt IN?
4. **AI-native**: Can every operation be triggered by natural language with the same
   security as a button click?
5. **Maintainability**: Is the codebase smaller tomorrow than it is today?

---

### Phase 7: Multi-Platform Strategy ✅ PWA BASELINE

**Goal**: Make MetaSAAS installable on every platform.

**What was built**:
- Progressive Web App (PWA) baseline:
  - Web app manifest (`manifest.json`) — installable on mobile and desktop
  - Service worker (`sw.js`) — network-first for API, cache-first for assets
  - Theme color and branded icons (SVG) for browser chrome and home screen
  - Apple Web App support (full-screen on iOS Safari)
  - Viewport configuration for mobile devices
- Multi-platform architecture documentation (`docs/MULTI-PLATFORM.md`):
  - Decision framework for when to add React Native or Tauri
  - Architecture diagram showing all clients use the same Action Bus API
  - Step-by-step guide for adding mobile (React Native + Expo) or desktop (Tauri)

**Milestone**: "MetaSAAS is installable on every platform via the browser." ✅

**Future extensions (when needed)**:
- React Native (`apps/mobile/`) — for App Store presence, push notifications,
  native hardware (camera, GPS, NFC)
- Tauri (`apps/desktop/`) — for native desktop experience (system tray, file system)

---

### Phase 8: Close UX Gaps + Scale + Complete AI Story + Production Deploy ✅ COMPLETE

**Goal**: Transform MetaSAAS from "technically works" to "obviously works" — close the
UX gaps that confuse users, make it usable at real-world data volumes, complete the
AI lifecycle (create → iterate → evolve), and make it deployable in 10 minutes.

**What was built (10 improvements across 4 sub-phases)**:

**Phase A — Close the UX gaps:**
- Workflow-aware status controls — edit forms show only valid next states, detail pages
  show transition buttons ("Start Work", "Complete"), cryptic 422 errors replaced with
  human-readable messages
- Kanban drag-and-drop — cards drag between columns with @dnd-kit, invalid moves bounce
  back with explanation, visual green/red feedback while hovering, optimistic UI with
  rollback on failure
- Related records on detail page — Company shows its Contacts, Doctor shows Appointments,
  reverse-relationship lookup from entity definitions, "+ Add" button pre-fills FK

**Phase B — Make it usable at scale:**
- Search and filtering — ILIKE text search across entity searchFields, per-enum dropdown
  filters, debounced queries, backend + frontend implementation
- Dashboard improvements — quick action buttons, workflow state overview with progress bars,
  recent activity feed (last 8 records), getting-started guide for empty tenants
- Bulk operations — checkbox selection, select-all, bulk status change via dropdown,
  bulk delete with confirmation, actions bar with progress indication

**Phase C — Complete the AI story:**
- Entity field evolution via AI — `domain.modify` action reads existing entity files from
  disk, sends to AI with modification request, writes updated file back. "Add a dueDate
  field to Task" or "Remove phone from Contact" from the AI chat sidebar

**Phase D — Production-ready:**
- Deploy story — multi-stage Dockerfiles for API and Web, production docker-compose with
  Postgres + API + Web, .env.example with all configuration documented, .dockerignore
- Import / export — client-side CSV export (downloads immediately), CSV import modal with
  file upload, header-to-field mapping, per-row error reporting
- Webhook notifications — Event Bus integration via wildcard subscriber, REST API for
  webhook CRUD, HTTP POST delivery with 10s timeout, exponential backoff retry (3 attempts),
  delivery log per webhook

**Key architecture decisions:**
- All new features follow the existing contract patterns — no new abstractions
- Kanban DnD, bulk ops, and search all flow through the same Action Bus pipeline
- Entity evolution reads/writes actual TypeScript files — the developer always owns the code
- Webhooks subscribe to the existing Event Bus — zero changes to the event infrastructure
- CSV import creates records through the standard `createEntity` API — same validation,
  same permissions, same audit logging

**Milestone**: "Define, iterate, evolve, deploy — the full lifecycle." ✅

---

*Last updated: February 2026*
*Phase 0-8 + Phase B + Phase B2 (Gym): Complete.*
*Entities: 13 across 5 domains. Tests: 334 unit + 14 E2E = 348 total.*
