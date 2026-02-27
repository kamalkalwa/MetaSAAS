# MetaSAAS — Technical Documentation

> Deep technical reference for the MetaSAAS platform internals. Covers every subsystem, data flow, and integration point.
>
> For the "why" → see [VISION.md](../VISION.md)
> For strategic decisions → see [STRATEGY.md](./STRATEGY.md)
> For the living roadmap → see [ROADMAP.md](./ROADMAP.md)

*Last updated: 2026-02-26*

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Bootstrap Sequence](#3-bootstrap-sequence)
4. [Contracts Package](#4-contracts-package)
5. [Entity Manager](#5-entity-manager)
6. [Database Layer](#6-database-layer)
7. [Action Bus](#7-action-bus)
8. [Event Bus](#8-event-bus)
9. [REST Adapter](#9-rest-adapter)
10. [Authentication](#10-authentication)
11. [AI Layer](#11-ai-layer)
12. [Licensing](#12-licensing)
13. [Email Module](#13-email-module)
14. [File Storage Module](#14-file-storage-module)
15. [Webhooks](#15-webhooks)
16. [Audit Log](#16-audit-log)
17. [Frontend Architecture](#17-frontend-architecture)
18. [Testing Strategy](#18-testing-strategy)
19. [Deployment](#19-deployment)
20. [Data Flow Diagrams](#20-data-flow-diagrams)

---

## 1. Architecture Overview

MetaSAAS is a **three-layer architecture** where entities declared in Layer 1 drive everything downstream — database tables, CRUD actions, REST routes, UI rendering, and AI capabilities.

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Dashboard │  │ Entity   │  │  Forms   │  │   AI Chat        │ │
│  │          │  │ Lists    │  │  (CRUD)  │  │   Sidebar        │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              @metasaas/ui (Lit Web Components)               │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ HTTP (REST API)
┌──────────────────────────────────▼───────────────────────────────┐
│                      API SERVER (Fastify)                         │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                 REST Adapter (Hono-style)                     │ │
│  │  /api/:pluralName  /api/actions/:id  /api/ai/command         │ │
│  │  /api/meta/*       /api/chat/*       /api/webhooks           │ │
│  │  /api/files/*      /api/email/send   /api/entities/install   │ │
│  └──────────────────────────────┬───────────────────────────────┘ │
│                                  │                                │
│  ┌──────────────────────────────▼───────────────────────────────┐ │
│  │                      ACTION BUS                               │ │
│  │  Validate → Authorize → Before Hook → Execute → After Hook   │ │
│  │  → Side Effects → Audit Log → Event Emit                     │ │
│  └──────────┬──────────────────┬────────────────┬───────────────┘ │
│             │                  │                │                 │
│  ┌──────────▼──┐  ┌───────────▼────┐  ┌────────▼──────────┐     │
│  │  Database   │  │   Event Bus    │  │   AI Gateway      │     │
│  │  (Drizzle + │  │  (Pub/Sub)     │  │  (NL→Actions)     │     │
│  │  PostgreSQL)│  │                │  │                    │     │
│  └─────────────┘  └──────┬─────────┘  └────────────────────┘     │
│                          │                                        │
│           ┌──────────────┼──────────────┐                        │
│           │              │              │                         │
│  ┌────────▼──┐  ┌────────▼──┐  ┌────────▼──┐                    │
│  │ Webhooks  │  │   Email   │  │  Audit    │                    │
│  │           │  │           │  │  Log      │                    │
│  └───────────┘  └───────────┘  └───────────┘                    │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                      PostgreSQL 16                              │
│  Entity tables (auto-generated) + Platform tables              │
└────────────────────────────────────────────────────────────────┘
```

### Three-Layer Architecture

| Layer | What | How |
|-------|------|-----|
| **Layer 1: Declarative** | Entity definitions (JSON) | `defineEntity()` — fields, relationships, workflows, permissions, UI hints, AI capabilities |
| **Layer 2: Platform** | Auto-generated infrastructure | CRUD actions, DB schemas, REST routes, validation, audit — all derived from Layer 1 |
| **Layer 3: Escape Hatches** | Custom business logic | `beforeCreate`, `afterUpdate`, custom actions, event subscribers — runs inside the Action Bus pipeline |

### Key Design Principles

- **Entity-driven**: One entity definition generates database table, 5 CRUD actions, REST endpoints, form UI, and AI capabilities
- **Provider pattern**: Every external integration has an interface + real implementation + dev fallback
- **Never break the app**: AI errors use fallbacks. Audit logging is fire-and-forget. Webhooks fail silently. Missing env vars use dev providers.
- **Multi-tenant by default**: Every table has `tenant_id`. Every query is scoped. No data leaks.
- **Secure by default**: Default-deny permissions. Input validation via Zod. SQL identifiers validated. UUID format enforced at API boundary.

---

## 2. Monorepo Structure

```
MetaSAAS/
├── apps/
│   ├── api/                    # Fastify HTTP server
│   │   └── src/
│   │       ├── bootstrap.ts    # Wires platform + domain (THE entry point)
│   │       └── server.ts       # HTTP listener
│   └── web/                    # Next.js frontend
│       └── src/app/
│           ├── (app)/          # Authenticated routes
│           │   ├── [entity]/   # Dynamic entity pages (list, detail, edit, new)
│           │   └── dashboard/  # Dashboard
│           ├── (auth)/         # Login/signup
│           └── layout.tsx      # Root layout
├── packages/
│   ├── contracts/              # Shared TypeScript interfaces (zero runtime deps)
│   │   └── src/
│   │       ├── entity.ts       # EntityDefinition, FieldDefinition, EntityHooks
│   │       ├── field-types.ts  # 12 field types + Zod schema mapping
│   │       ├── action.ts       # ActionDefinition, ActionContext, Caller
│   │       ├── context.ts      # ActionContext (db, emit, logger)
│   │       ├── permission.ts   # PermissionRule, ALLOW_ALL
│   │       ├── relationship.ts # belongsTo, hasMany
│   │       ├── workflow.ts     # SimpleWorkflowDefinition
│   │       ├── ai-capability.ts# AICapabilityDefinition
│   │       ├── auth.ts         # AuthProvider interface
│   │       └── navigation.ts   # NavigationItem
│   ├── platform/               # Core engine (no domain knowledge)
│   │   └── src/
│   │       ├── core/
│   │       │   ├── action-bus/     # Dispatch pipeline + middleware
│   │       │   ├── database/       # Schema builder + migrations + client
│   │       │   ├── entity-manager/ # Entity registry + CRUD generator
│   │       │   ├── event-bus/      # Pub/sub system
│   │       │   ├── config/         # Environment config loader
│   │       │   ├── licensing/      # JWT/RSA license verification
│   │       │   ├── webhooks/       # HTTP POST delivery + retry
│   │       │   ├── email/          # Resend + console providers
│   │       │   ├── storage/        # S3 + local providers
│   │       │   └── audit/          # Persistent audit logger
│   │       ├── auth/               # Supabase + dev auth providers
│   │       ├── ai/                 # AI providers + gateway + command + chat
│   │       └── adapters/rest/      # HTTP route generation
│   ├── domain/                 # Business entities (the "replaceable" part)
│   │   └── src/
│   │       ├── entities/       # Entity definition files
│   │       └── index.ts        # Exports entities[], eventSubscribers[], navigation[]
│   └── ui/                     # Lit-based web component library
│       └── src/
│           └── index.ts        # Component exports
├── docker-compose.yml          # PostgreSQL for local dev
├── .github/workflows/ci.yml   # CI pipeline (test + build)
├── .env.example                # All environment variables documented
└── pnpm-workspace.yaml         # Monorepo workspace config
```

### Dependency Graph

```
contracts  ←──  platform  ←──  domain
    │               │              │
    │               ▼              │
    │           adapters/rest      │
    │               │              │
    └───────────────┼──────────────┘
                    ▼
                  api (apps/api)
                    │
                  web (apps/web) ← ui
```

- `contracts` has zero runtime dependencies (types + Zod only)
- `platform` depends on `contracts`, `drizzle-orm`, `postgres`, `zod`
- `domain` depends on `contracts` (declares entities using shared types)
- `api` wires `platform` + `domain` in `bootstrap.ts`
- `web` consumes the REST API
- `ui` has zero platform dependencies (standalone Lit components)

---

## 3. Bootstrap Sequence

`apps/api/src/bootstrap.ts` is the **single integration point** between the platform engine and the domain layer. Called once at server startup.

```
bootstrap()
  │
  ├── 1. loadConfig()              → Read env vars, validate DATABASE_URL
  ├── 2. initLicensing()           → Verify license key (JWT/RSA), set feature flags
  ├── 3. initDatabase(config)      → Connect to PostgreSQL via postgres.js + Drizzle
  ├── 4. initAuthProvider()        → Select Supabase or DevAuthProvider
  ├── 5. registerEntities()        → Load domain entities into Entity Registry
  ├── 6. buildTableSchema()        → For each entity → Drizzle table definition
  ├── 7. generateCRUDActions()     → For each entity → 5 ActionDefinitions
  │   └── registerActions()        → Register on Action Bus
  ├── 8. runPlatformMigrations()   → CREATE TABLE for chat, audit, webhooks tables
  ├── 9. runMigrations(entities)   → CREATE/ALTER TABLE for entity tables
  ├── 10. initEmail()              → Auto-detect Resend or Console provider
  ├── 11. initStorage()            → Auto-detect S3 or Local provider
  ├── 12. initAIGateway()          → Auto-detect Gemini/OpenAI/Anthropic/Null
  │   └── registerEntityAICapabilities() → For each entity with AI capabilities
  └── 13. subscribeAll()           → Register domain event subscribers
```

**Key constraint**: The app must start with only `DATABASE_URL` set. All other services (email, storage, AI, auth) gracefully fall back to dev/null providers.

---

## 4. Contracts Package

`packages/contracts/src/` — Pure TypeScript interfaces with zero runtime dependencies (only `zod` for schema validation).

### EntityDefinition

The central type that drives the entire platform. Located in `packages/contracts/src/entity.ts`.

```typescript
interface EntityDefinition {
  name: string;              // PascalCase: "Contact"
  pluralName: string;        // "Contacts"
  description: string;       // Plain English — used by AI
  fields: FieldDefinition[];
  relationships?: RelationshipDefinition[];
  constraints?: ConstraintDefinition[];
  workflows?: SimpleWorkflowDefinition[];
  hooks?: EntityHooks;       // Layer 3 escape hatches
  aiCapabilities?: AICapabilityDefinition[];
  ui: EntityUIConfig;
}
```

### 12 Field Types

Defined in `packages/contracts/src/field-types.ts`. Each maps to a database column type, Zod validator, and UI component:

| Field Type | DB Column | Zod Schema | UI Input |
|-----------|-----------|------------|----------|
| `text` | TEXT | `z.string()` | Text input |
| `email` | VARCHAR(512) | `z.string().email()` | Email input |
| `phone` | TEXT | `z.string()` | Phone input |
| `url` | VARCHAR(512) | `z.string().url()` | URL input |
| `currency` | NUMERIC | `z.number()` | Currency input |
| `date` | TIMESTAMPTZ | `z.string().datetime()` | Date picker |
| `datetime` | TIMESTAMPTZ | `z.string().datetime()` | Datetime picker |
| `number` | NUMERIC | `z.number()` | Number input |
| `percentage` | NUMERIC | `z.number()` | Percentage input |
| `enum` | VARCHAR(255) | `z.enum([...])` | Select dropdown |
| `rich_text` | TEXT | `z.string()` | Rich text editor |
| `boolean` | BOOLEAN | `z.boolean()` | Toggle/checkbox |

### Relationships

```typescript
type RelationshipDefinition =
  | { type: "belongsTo"; entity: string; foreignKey?: string; as?: string }
  | { type: "hasMany"; entity: string; foreignKey?: string; as?: string };
```

- `belongsTo` adds a UUID foreign key column to the table
- `hasMany` is metadata-only (no column added — used for UI navigation)

### Workflows (State Machines)

```typescript
interface SimpleWorkflowDefinition {
  name: string;
  field: string;           // The enum field that holds state
  transitions: {
    from: string;
    to: string;
    requires?: string[];   // Fields that must have values for this transition
    triggers?: string[];   // Event names to fire after transition
  }[];
}
```

Workflows are validated at the Action Bus level during update actions. Invalid transitions throw `WorkflowError` (HTTP 422).

### Permissions

```typescript
interface PermissionRule {
  callerTypes?: ("human" | "system" | "ai-agent")[];
  roles?: string[];
  ownership?: "any" | "own";
  effect: "allow" | "deny";
}
```

Rules are evaluated in order — first match wins. Default: deny. `ALLOW_ALL` is a convenience constant: `{ effect: "allow" }`.

### Entity Hooks (Layer 3)

```typescript
interface EntityHooks {
  beforeCreate?: (input, ctx) => Promise<input>;
  afterCreate?: (result, input, ctx) => Promise<result>;
  beforeUpdate?: (input, ctx) => Promise<input>;
  afterUpdate?: (result, input, ctx) => Promise<result>;
  beforeDelete?: (input, ctx) => Promise<input>;
}
```

Hooks run inside the Action Bus pipeline — after validation and permission checks, before/after the database operation. They can transform input, modify results, or throw to abort.

---

## 5. Entity Manager

`packages/platform/src/core/entity-manager/` — The bridge between domain declarations and the platform engine.

### Entity Registry (`entity-registry.ts`)

In-memory `Map<string, EntityDefinition>` keyed by entity name.

| Function | Purpose |
|----------|---------|
| `registerEntity(entity)` | Add to registry (throws on duplicate) |
| `registerEntities(list)` | Batch register |
| `getEntity(name)` | Lookup by PascalCase name |
| `getEntityByPlural(name)` | Lookup by pluralName (URL routing) |
| `getAllEntities()` | Return all registered entities |
| `clearEntityRegistry()` | Test isolation |

### CRUD Generator (`crud-generator.ts`)

Takes an `EntityDefinition` and produces 5 `ActionDefinition` objects:

| Action ID | HTTP Equivalent | Input Schema | Output |
|-----------|----------------|--------------|--------|
| `{entity}.create` | POST | All fields (required enforced) | Created record |
| `{entity}.findAll` | GET (list) | `{ where?, search?, orderBy?, limit?, offset? }` | `{ data: [], total: N }` |
| `{entity}.findById` | GET (single) | `{ id: UUID }` | Record or null |
| `{entity}.update` | PATCH | `{ id: UUID, data: { ...partial } }` | Updated record |
| `{entity}.delete` | DELETE | `{ id: UUID }` | `{ success: boolean }` |

Key behaviors:
- **Create**: Validates initial workflow state (must be a valid "from" state). Emits `{entity}.created` event.
- **FindAll**: Supports `where` filters, `search` (ILIKE across searchFields), `orderBy`, `limit/offset`. Runs count query in parallel for total.
- **Update**: Validates workflow transitions against current record state. Emits `{entity}.updated` event. Emits `{entity}.workflow.transitioned` for workflow changes.
- **Delete**: Emits `{entity}.deleted` event. Returns boolean success.

All CRUD actions use `ALLOW_ALL` permissions by default. Domain code can override by registering custom actions with the same ID before bootstrap.

---

## 6. Database Layer

`packages/platform/src/core/database/` — PostgreSQL via postgres.js + Drizzle ORM.

### Connection (`connection.ts`)

```typescript
initDatabase(config) → { sql: PostgresClient, db: DrizzleInstance }
getDatabase()        → { sql, db } (throws if not initialized)
closeDatabase()      → Graceful shutdown
```

### Schema Builder (`schema-builder.ts`)

Converts `EntityDefinition` → Drizzle `pgTable()`. Stored in an in-memory `Map<string, PgTable>`.

**System columns** (added to every entity table):

| Column | Type | Properties |
|--------|------|------------|
| `id` | UUID | Primary key, auto-generated |
| `tenant_id` | UUID | NOT NULL — multi-tenancy isolation |
| `created_at` | TIMESTAMPTZ | NOT NULL, default NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default NOW() |

**Column type mapping**:

| Field Type | PostgreSQL Type |
|-----------|----------------|
| text, rich_text, phone | TEXT |
| email, url | VARCHAR(512) |
| currency, number, percentage | NUMERIC |
| date, datetime | TIMESTAMPTZ |
| boolean | BOOLEAN |
| enum | VARCHAR(255) |

**Name conventions**:
- Entity "Contact" → table `contacts`
- Entity "PurchaseOrder" → table `purchase_orders`
- Field "firstName" → column `first_name`
- Column `first_name` → API field `firstName` (bidirectional mapping)

### Migration System (`migrate.ts`)

Capabilities:
1. **CREATE TABLE IF NOT EXISTS** — for new entities
2. **ALTER TABLE ADD COLUMN** — for fields added to existing entities
3. **ALTER COLUMN TYPE** — for safe type changes only (widening conversions)
4. **Warnings** for removed fields (never drops columns — data safety)
5. **Warnings** for unsafe type changes (narrowing conversions)

Safe type changes (automatic):
- VARCHAR(N) → TEXT (widening)
- VARCHAR(N) → VARCHAR(M) where M > N
- NUMERIC → TEXT/VARCHAR
- BOOLEAN → TEXT

Unsafe type changes (warning only, manual intervention):
- TEXT → BOOLEAN
- TEXT → NUMERIC
- Wider → narrower VARCHAR

**Security**: All identifiers are validated against `/^[a-z][a-z0-9_]*$/`. Default values are type-checked and escaped. No raw string interpolation.

### Platform Tables

Created by `runPlatformMigrations()` — idempotent (CREATE TABLE IF NOT EXISTS):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `chat_sessions` | AI chat session metadata | id, tenant_id, user_id, title |
| `chat_messages` | Messages within sessions | id, session_id, role, content, action_id, result_data |
| `audit_log` | Action execution records | id, tenant_id, user_id, action_id, success, duration_ms, input (JSONB) |
| `webhooks` | Registered webhook URLs | id, tenant_id, event_type, url, secret, active |
| `webhook_deliveries` | HTTP POST delivery log | id, webhook_id, event_type, status, status_code, attempt, error |

### Database Client (`client.ts`)

`createDatabaseClient(tenantId)` returns a `DatabaseClient` scoped to a tenant. Every query includes `WHERE tenant_id = $tenantId` automatically.

Methods: `findMany()`, `findById()`, `create()`, `update()`, `delete()`, `count()`.

Key behaviors:
- Automatic camelCase ↔ snake_case mapping (API consumers never see DB naming)
- Date string coercion (ISO strings → Date objects for Drizzle timestamp columns)
- ILIKE search across multiple fields (OR-combined)
- Dynamic ORDER BY with direction
- LIMIT/OFFSET pagination

---

## 7. Action Bus

`packages/platform/src/core/action-bus/` — The central dispatch pipeline. **Every operation** in MetaSAAS goes through here — UI clicks, API calls, AI commands, cron jobs.

### Dispatch Pipeline (`bus.ts`)

```
dispatch(actionId, input, caller)
  │
  ├── 1. LOOKUP          → Find action in registry (404 if missing)
  ├── 2. VALIDATE        → Zod schema validation (400 on failure)
  ├── 3. AUTHORIZE       → Permission rules against caller (403 on failure)
  ├── 4. BUILD CONTEXT   → { caller, db, emit, logger }
  ├── 5. BEFORE HOOK     → action.beforeExecute(input, ctx) — can transform or abort
  ├── 6. EXECUTE         → action.execute(input, ctx) — business logic
  ├── 7. AFTER HOOK      → action.afterExecute(result, input, ctx)
  ├── 8. SIDE EFFECTS    → Fire-and-forget: emit_event, notify, webhook
  ├── 9. LOG             → Duration, success/failure metrics
  └── 10. AUDIT          → Persistent audit_log entry (fire-and-forget)
```

### Action Result

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; errorType: ActionErrorType; details?: unknown };

type ActionErrorType = "not_found" | "validation" | "permission" | "workflow" | "unknown";
```

### Error Type → HTTP Status Mapping

| Error Type | HTTP Status | Cause |
|-----------|-------------|-------|
| `not_found` | 404 | Action ID not in registry |
| `validation` | 400 | Zod schema failed |
| `permission` | 403 | No matching allow rule |
| `workflow` | 422 | Invalid state transition |
| `unknown` | 500 | Unhandled exception |

### Action Registry (`registry.ts`)

In-memory `Map<string, ActionDefinition>`. Functions: `registerAction()`, `registerActions()`, `getAction()`, `getAllActions()`, `getActionsForEntity()`, `clearActionRegistry()`.

### Middleware

**Validation** (`middleware/validation.ts`):
- Runs `action.inputSchema.safeParse(input)`
- Returns structured field-level errors: `[{ field, message, code }]`

**Permission** (`middleware/permission.ts`):
- Evaluates rules in order — first match wins
- Checks: `callerTypes`, `roles`, `ownership`
- Default deny if no rules match

**Workflow** (`middleware/workflow.ts`):
- Pure function: `validateWorkflowTransitions(workflows, data, currentRecord)`
- Checks if `from → to` transition exists in the workflow definition
- Validates required fields for transitions
- Returns transition results with triggers to fire

### Side Effects

Declared on `ActionDefinition.sideEffects`. Fire-and-forget — never break the action:

| Type | Behavior |
|------|----------|
| `emit_event` | Publishes a DomainEvent to the Event Bus |
| `notify` | Logs a notification (extensible to email/push) |
| `webhook` | HTTP POST to configured URL |

---

## 8. Event Bus

`packages/platform/src/core/event-bus/index.ts` — Pub/sub system for domain events.

### API

```typescript
subscribe(subscriber: EventSubscriber): void
subscribeAll(subscribers: EventSubscriber[]): void
publish(event: DomainEvent): Promise<void>
```

### Matching Rules

1. **Exact match**: `"task.created"` matches subscribers for `"task.created"`
2. **Wildcard**: `"*"` matches ALL events

### Event Shape

```typescript
interface DomainEvent {
  type: string;        // e.g., "contact.created", "task.workflow.transitioned"
  payload: unknown;    // Event-specific data
  timestamp?: Date;    // Auto-set if not provided
}
```

### Design Principles

- Subscribers registered at startup (not dynamically)
- All handlers invoked concurrently via `Promise.allSettled`
- Failed handlers are logged but **never re-thrown** — the emitting action is never affected
- Used by: CRUD generators (entity events), webhooks (wildcard subscriber), AI triggers (entity events), domain event subscribers

### Event Naming Convention

| Pattern | When Emitted |
|---------|-------------|
| `{entity}.created` | After create action |
| `{entity}.updated` | After update action |
| `{entity}.deleted` | After delete action |
| `{entity}.workflow.transitioned` | When a workflow field changes state |

---

## 9. REST Adapter

`packages/platform/src/adapters/rest/adapter.ts` — Fastify HTTP routing layer.

### Route Categories

**Meta routes** (frontend configuration):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/config` | Auth provider public config (Supabase URL, etc.) |
| GET | `/api/meta/entities` | All entity definitions (drives frontend rendering) |
| GET | `/api/meta/entities/:pluralName` | Single entity definition |
| GET | `/api/meta/actions` | All registered actions (for AI and docs) |
| GET | `/api/meta/features` | Enabled features + license info |

**Per-entity routes** (auto-generated for each registered entity):

| Method | Path | Action Dispatched |
|--------|------|-------------------|
| GET | `/api/:pluralName` | `{entity}.findAll` |
| GET | `/api/:pluralName/:id` | `{entity}.findById` |
| POST | `/api/:pluralName` | `{entity}.create` |
| PATCH | `/api/:pluralName/:id` | `{entity}.update` |
| DELETE | `/api/:pluralName/:id` | `{entity}.delete` |
| GET | `/api/:pluralName/:id/transitions` | Workflow valid next states |

**Module routes**:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/actions/:actionId` | Generic action dispatch |
| POST | `/api/ai/command` | Natural language → action |
| POST | `/api/ai/command/stream` | SSE streaming version |
| GET/POST/PATCH/DELETE | `/api/chat/sessions[/:id]` | Chat persistence |
| POST | `/api/chat/sessions/:id/messages` | Add chat message |
| POST | `/api/entities/install` | Hot-install entity at runtime |
| POST | `/api/email/send` | Send test email |
| POST | `/api/files/upload` | Upload file (base64 JSON) |
| GET | `/api/files/*` | Get file URL |
| DELETE | `/api/files/*` | Delete file |
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Register webhook |
| DELETE | `/api/webhooks/:id` | Remove webhook |
| GET | `/api/webhooks/:id/deliveries` | Delivery log |

### Query Parameters (List Endpoint)

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `search` | ILIKE search across entity's `searchFields` | `?search=john` |
| `orderBy` | Sort field (must be a declared field) | `?orderBy=name` |
| `direction` | Sort direction | `?direction=desc` |
| `limit` | Page size (max 100) | `?limit=25` |
| `offset` | Pagination offset | `?offset=50` |
| `{fieldName}` | Exact-match filter on any declared field | `?status=active` |

### Security

- **Auth middleware**: Runs before every request via `preHandler` hook
- **UUID validation**: All `:id` parameters validated against UUID regex before reaching the database
- **Filter whitelist**: Only fields declared in the `EntityDefinition` are accepted as query filters
- **Action ID validation**: Must match `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/`
- **AI input length guard**: Command text limited to 2000 characters
- **Chat history sanitization**: Only `user`/`assistant` roles, max 10 messages, 5000 char limit per message
- **File key sanitization**: Path traversal prevention (`..` stripped)

---

## 10. Authentication

`packages/platform/src/auth/` — Provider-based authentication.

### Provider Interface

```typescript
interface AuthProvider {
  verifyToken(token: string): Promise<{ userId: string; tenantId: string; roles: string[] }>;
  getPublicConfig(): Record<string, unknown>;
}
```

### Provider Selection

| Condition | Provider | Behavior |
|-----------|----------|----------|
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set | `SupabaseAuthProvider` | JWT verification via Supabase |
| Non-production + no config | `DevAuthProvider` | Bypasses auth, returns dev tenant |
| Production + no config | THROWS | Fail fast — no silent auth bypass |

### Auth Middleware

Runs as a Fastify `preHandler` hook on every request:

1. Extract `Authorization: Bearer <token>` header
2. Call `provider.verifyToken(token)`
3. Set `request.caller = { userId, tenantId, roles, type: "human" }`
4. On failure: 401 Unauthorized

### DevAuthProvider

Returns a fixed caller for local development:
```typescript
{
  userId: "dev-user",
  tenantId: "00000000-0000-0000-0000-000000000001",
  roles: ["admin"],
  type: "human"
}
```

---

## 11. AI Layer

`packages/platform/src/ai/` — Multi-provider AI integration.

### Provider Interface (`provider.ts`)

```typescript
interface AIProvider {
  readonly name: string;
  complete(messages: AIMessage[], options?: AIRequestOptions): Promise<string>;
}
```

### Provider Implementations

| Provider | Class | API Key Env Var | Default Model |
|----------|-------|----------------|---------------|
| Gemini | `GeminiProvider` | `GOOGLE_AI_API_KEY` | gemini-pro |
| OpenAI | `OpenAIProvider` | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic | `AnthropicProvider` | `ANTHROPIC_API_KEY` | claude-sonnet |
| Null | `NullAIProvider` | (none) | Always throws → forces fallback |

**Provider selection** (in `initAIGateway()`):
1. If `AI_PROVIDER` env var is set → use that provider explicitly (fail fast if key missing)
2. Otherwise auto-detect by checking keys in order: Gemini → OpenAI → Anthropic → Null

### AI Gateway (`gateway.ts`)

Bridges `AICapabilityDefinition` (from domain entities) to the Action Bus.

For each AI capability:
1. Creates an `ActionDefinition` with the capability's ID
2. The action's execute function: extract context fields → build prompt → call provider → parse output with Zod → return fallback on any error
3. Registers the action on the Action Bus

**Auto-triggers**: Capabilities with `trigger: "on_create"` or `"on_update"` are wired as Event Bus subscribers. When the entity event fires, the AI action is dispatched automatically, and the output is merged back into the record via an update action.

### Command Interpreter (`command.ts`)

Translates natural language → Action Bus dispatch.

```
User input: "Create a task called Fix login bug with high priority"
     │
     ├── 1. Collect all registered actions (IDs, descriptions, examples)
     ├── 2. Build system prompt teaching AI about available actions
     ├── 3. Include conversation history (last 10 messages)
     ├── 4. Send to AI provider (JSON response format, temperature=0)
     ├── 5. Parse AI response: { actionId, input, explanation }
     │
     ├── 5a. actionId = "domain.generate" → Entity generator (creates new entities)
     ├── 5b. actionId = "domain.modify"   → Entity evolution (modifies existing)
     └── 5c. actionId = "{entity}.{action}" → dispatch() through Action Bus
```

**Security**: The AI only resolves intent. The Action Bus enforces ALL rules (validation, permissions, workflows). A natural language command has exactly the same security as a button click.

### Entity Generator (`entity-generator.ts`)

AI-powered entity creation:
1. User describes a business domain in natural language
2. AI generates `EntityDefinition[]` with fields, relationships, workflows, AI capabilities
3. Writes `.entity.ts` files to `packages/domain/src/entities/`
4. Updates `packages/domain/src/index.ts` with imports and exports

### Entity Installer (`entity-installer.ts`)

Hot-installs entities at runtime without restarting the server:

```
installEntity(entity)
  ├── 1. Register in Entity Registry (skip if exists)
  ├── 2. Build Drizzle table schema
  ├── 3. Generate CRUD actions
  ├── 4. Register actions on Action Bus (skip duplicates)
  ├── 5. Run database migration (CREATE TABLE / ALTER TABLE)
  └── 6. Register AI capabilities (if any)
```

Never throws — returns `InstallResult { success, entityName, actions, warnings, error }`.

### Chat Persistence (`chat-store.ts`)

PostgreSQL-backed session and message storage:

| Function | Purpose |
|----------|---------|
| `createSession({ tenantId, userId, title })` | New chat session |
| `listSessions(tenantId, userId, limit, offset)` | Paginated session list |
| `getSession(id, tenantId)` | Session by ID (tenant-scoped) |
| `updateSessionTitle(id, tenantId, title)` | Rename session |
| `deleteSession(id, tenantId)` | Delete + cascade messages |
| `createMessage({ sessionId, role, content, ... })` | Add message to session |
| `listMessages(sessionId)` | All messages for a session |

---

## 12. Licensing

`packages/platform/src/core/licensing/` — JWT/RSA license verification.

### Architecture

License keys are JWTs signed with an RSA private key. The platform verifies with an embedded public key. No network calls needed.

```
License Key (JWT) → RSA verification → { features: string[], expiresAt: Date }
```

### Feature Split

**13 FREE features** (always enabled, no license needed):

| Feature | ID |
|---------|----|
| AI Chat | `ai.chat` |
| AI Commands | `ai.commands` |
| AI Entity Generation | `ai.entity_generation` |
| AI Entity Evolution | `ai.entity_evolution` |
| Kanban View | `views.kanban` |
| Calendar View | `views.calendar` |
| Webhooks | `webhooks` |
| Email | `email` |
| Storage | `storage` |
| Bulk Actions | `bulk_actions` |
| Import/Export | `import_export` |
| Audit Log | `audit_log` |
| Multi-Tenancy | `multi_tenancy` |

**4 PRO features** (require license key — code in private repo):

| Feature | ID |
|---------|----|
| Billing (Stripe) | `billing` |
| SSO / SAML | `sso` |
| White-label | `white_label` |
| Advanced RBAC | `advanced_rbac` |

### Two-Repo Open-Core Model

- **Public repo** (MIT): Contains all 13 free features. PRO feature code is physically absent.
- **Private repo**: Contains PRO feature implementations. Only accessible to license holders.
- License key only verifies — it doesn't gate code that exists in the free repo.

---

## 13. Email Module

`packages/platform/src/core/email/index.ts` — Provider-based email sending.

### Providers

| Provider | Class | Env Var | Behavior |
|----------|-------|---------|----------|
| Resend | `ResendEmailProvider` | `RESEND_API_KEY` | Production — calls Resend API via fetch |
| Console | `ConsoleEmailProvider` | (none) | Dev fallback — logs to console |

### Provider Selection

```
initEmail():
  RESEND_API_KEY set → ResendEmailProvider
  otherwise         → ConsoleEmailProvider (logs email content to stdout)
```

### API

```typescript
sendEmail({ to, subject, html, from? }): Promise<EmailResult>
registerEmailTrigger({ eventType, handler }): void  // Event Bus integration
```

### Event-Triggered Emails

`registerEmailTrigger()` subscribes to an Event Bus event. When the event fires, the handler function produces email parameters, and `sendEmail()` is called automatically.

```typescript
registerEmailTrigger({
  eventType: "contact.created",
  handler: (event) => ({
    to: event.payload.email,
    subject: "Welcome!",
    html: "<h1>Welcome to our platform</h1>",
  }),
});
```

---

## 14. File Storage Module

`packages/platform/src/core/storage/index.ts` — S3-compatible file storage.

### Providers

| Provider | Class | Env Vars | Behavior |
|----------|-------|----------|----------|
| S3-compatible | `S3StorageProvider` | `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Works with AWS S3, Cloudflare R2, MinIO |
| Local | `LocalStorageProvider` | (none) | Saves to `./uploads/` directory |

### Provider Selection

```
initStorage():
  STORAGE_ENDPOINT + STORAGE_BUCKET + keys set → S3StorageProvider
  otherwise                                    → LocalStorageProvider
```

### API

```typescript
uploadFile({ key, body, contentType }): Promise<UploadResult>
getFileUrl(key): Promise<string>
deleteFile(key): Promise<boolean>
fileExists(key): Promise<boolean>
```

### S3 Provider — No SDK

The S3 provider uses **raw HTTP with AWS Signature V4 signing** — zero dependencies. This means it works with any S3-compatible service (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces) without vendor lock-in.

Key implementation details:
- HMAC-SHA256 signing for AWS Sig V4
- PUT for upload, GET for download (pre-signed URL), DELETE for removal
- Content-Type preserved on upload
- Configurable region, public URL prefix

---

## 15. Webhooks

`packages/platform/src/core/webhooks/index.ts` — HTTP POST delivery on domain events.

### Architecture

The webhook system registers a **wildcard Event Bus subscriber** (`eventType: "*"`). When any event fires:

1. Query `webhooks` table for active webhooks matching the event type (or `*`)
2. For each matching webhook, deliver via HTTP POST
3. Retry on 5xx errors with exponential backoff

### Delivery

```
HTTP POST to registered URL:
  Headers:
    Content-Type: application/json
    X-MetaSAAS-Event: {event_type}
    X-MetaSAAS-Delivery: {uuid}
  Body:
    { event: "task.created", data: { ... }, timestamp: "..." }
```

### Retry Strategy

| Attempt | Delay | Condition |
|---------|-------|-----------|
| 1 | 0 | Always |
| 2 | 1 second | Previous got HTTP 5xx |
| 3 | 5 seconds | Previous got HTTP 5xx |

Max 3 attempts. 10-second timeout per request.

### Storage

- **With database**: Persists to `webhooks` and `webhook_deliveries` PostgreSQL tables
- **Without database**: In-memory fallback (for tests, max 1000 delivery log entries)

### API

```typescript
registerWebhook({ eventType, url, secret, tenantId }): Promise<WebhookRegistration>
removeWebhook(id): Promise<boolean>
listWebhooks(tenantId): Promise<WebhookRegistration[]>
getDeliveryLog(webhookId?): Promise<WebhookDelivery[]>
initWebhooks(): void  // Call once at startup
```

---

## 16. Audit Log

`packages/platform/src/core/audit/index.ts` — Automatic action execution logging.

### How It Works

The Action Bus calls `writeAuditLog()` after every `dispatch()` — both success and failure. It's fire-and-forget (never blocks or breaks the action).

### Audit Entry

```typescript
{
  tenantId: string,
  userId: string,
  actionId: string,    // e.g., "contact.create"
  success: boolean,
  durationMs: number,
  input?: JSONB,       // Truncated to 10KB
  error?: string,
}
```

### Table Schema

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  input JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexed on `(tenant_id, created_at DESC)` and `(action_id, created_at DESC)`.

### Fail-Safe

If the audit_log table doesn't exist yet (first boot before migrations), the write silently skips. Audit logging NEVER breaks the application.

---

## 17. Frontend Architecture

### Next.js App Router (`apps/web/`)

```
src/app/
├── layout.tsx              # Root layout (ThemeProvider, fonts)
├── providers.tsx           # Client providers (auth, theme, API)
├── page.tsx                # Root page (redirect based on auth)
├── (auth)/
│   ├── layout.tsx          # Auth layout (centered card)
│   ├── login/page.tsx      # Login form
│   └── signup/page.tsx     # Signup form
└── (app)/
    ├── layout.tsx          # App layout (sidebar, topbar, chat)
    ├── dashboard/page.tsx  # Dashboard (entity stats, recent activity)
    └── [entity]/           # Dynamic entity routes
        ├── page.tsx        # Entity list view (table/kanban/calendar)
        ├── [id]/page.tsx   # Entity detail view
        ├── [id]/edit/page.tsx  # Entity edit form
        └── new/page.tsx    # Entity create form
```

### Dynamic Entity Pages

The `[entity]` route segment is the entity's `pluralName` (lowercase). The page fetches the entity definition from `/api/meta/entities/:pluralName` and renders dynamically:

- **List view**: Columns from `entity.ui.listColumns`, sort from `entity.ui.defaultSort`, search across `entity.ui.searchFields`
- **Detail view**: All fields rendered based on field type
- **Form**: Input components selected by field type (text, email, phone, date picker, select, toggle, etc.)
- **Kanban**: Groups records by `entity.ui.kanban.groupBy` field (enum type)
- **Calendar**: Positions records by `entity.ui.calendar.dateField`

### Web Component Library (`packages/ui/`)

Standalone Lit-based web components. Zero dependency on the platform — can be used in any HTML page.

### Dark Mode

CSS custom properties architecture:
- Light/dark mode via `data-theme` attribute or system preference
- All colors defined as CSS variables
- Tailwind `dark:` variant for utility classes

### AI Chat Sidebar

Integrated chat interface in the app layout:
- Session management (create, list, delete)
- Message persistence via `/api/chat/sessions` API
- Natural language commands dispatched via `/api/ai/command/stream` (SSE)
- Streaming response display with typing effect

---

## 18. Testing Strategy

### Framework

- **Vitest** for unit and integration tests
- Tests co-located with source files (`*.test.ts` next to `*.ts`)

### Test Counts

| Package | Test Files | Tests | Notes |
|---------|-----------|-------|-------|
| Platform | 18 | 279+ | Action Bus, Database, Entity Manager, Licensing, Email, Storage, Webhooks, AI |
| Contracts | 2 | — | Entity validation, field types |
| Domain | 1 | — | Entity definition tests |
| **Total** | **18+** | **279+** | All passing |

### Provider Mocking Pattern

Every module with an external dependency follows this pattern:

```typescript
// Set a mock provider before tests
setEmailProvider(new ConsoleEmailProvider());

// Test the module's logic without real API calls
const result = await sendEmail({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
expect(result.success).toBe(true);

// Reset after tests
resetEmail();
```

### Database Mocking

Tests that need database operations mock the `migrate.ts` module:

```typescript
vi.mock("../core/database/migrate.js", () => ({
  runMigrations: vi.fn(async () => {}),
}));
```

The database client, schema builder, and entity registry all support `clear*()` functions for test isolation.

### Test Structure

```typescript
describe("Module Name", () => {
  beforeEach(() => {
    clearRegistries();  // Prevent state leaks
    vi.clearAllMocks();
  });

  describe("functionName()", () => {
    it("describes expected behavior", async () => {
      // Arrange → Act → Assert
    });
  });
});
```

---

## 19. Deployment

### Local Development

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
pnpm install

# Build packages
pnpm build

# Run API server (port 4000)
cd apps/api && pnpm dev

# Run web app (port 3000)
cd apps/web && pnpm dev
```

### Docker Compose (`docker-compose.yml`)

PostgreSQL 16 Alpine with:
- Configurable port (default 5433)
- Persistent volume (`pgdata`)
- Health check (`pg_isready`)
- Configurable user/password/database via env vars

### Environment Variables

**Required** (app won't start without):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |

**Optional** (graceful fallback if missing):

| Variable | Purpose | Fallback |
|----------|---------|----------|
| `API_PORT` | API server port | 4000 |
| `API_HOST` | API server host | 0.0.0.0 |
| `NEXT_PUBLIC_API_URL` | Web app URL | http://localhost:3000 |
| `SUPABASE_URL` | Supabase project URL | DevAuthProvider |
| `SUPABASE_SERVICE_KEY` | Supabase service key | DevAuthProvider |
| `SUPABASE_ANON_KEY` | Supabase anon key (frontend) | — |
| `AI_PROVIDER` | Force specific AI provider | Auto-detect |
| `GOOGLE_AI_API_KEY` | Gemini API key | NullAIProvider |
| `OPENAI_API_KEY` | OpenAI API key | NullAIProvider |
| `ANTHROPIC_API_KEY` | Anthropic API key | NullAIProvider |
| `RESEND_API_KEY` | Resend email API key | ConsoleEmailProvider |
| `EMAIL_FROM` | Default sender address | noreply@example.com |
| `STORAGE_ENDPOINT` | S3-compatible endpoint | LocalStorageProvider |
| `STORAGE_BUCKET` | S3 bucket name | LocalStorageProvider |
| `STORAGE_ACCESS_KEY` | S3 access key | LocalStorageProvider |
| `STORAGE_SECRET_KEY` | S3 secret key | LocalStorageProvider |
| `STORAGE_REGION` | S3 region | us-east-1 |
| `STORAGE_PUBLIC_URL` | Public URL prefix for files | — |
| `METASAAS_LICENSE_KEY` | PRO license key (JWT) | Free tier (13 features) |

### CI/CD (`.github/workflows/ci.yml`)

Runs on every push/PR to main:
1. Checkout code
2. Setup Node 20 + pnpm with cache
3. Install dependencies
4. Build all packages
5. Run all tests

---

## 20. Data Flow Diagrams

### HTTP Request → CRUD → Response

```
Client                  Fastify              REST Adapter           Action Bus           Database
  │                       │                      │                      │                    │
  │  GET /api/contacts    │                      │                      │                    │
  │──────────────────────►│                      │                      │                    │
  │                       │  preHandler (auth)   │                      │                    │
  │                       │─────────────────────►│                      │                    │
  │                       │                      │  dispatch("contact.  │                    │
  │                       │                      │  findAll", input,    │                    │
  │                       │                      │  caller)             │                    │
  │                       │                      │─────────────────────►│                    │
  │                       │                      │                      │  1. Lookup action  │
  │                       │                      │                      │  2. Validate input │
  │                       │                      │                      │  3. Check perms    │
  │                       │                      │                      │  4. Build context  │
  │                       │                      │                      │     (db scoped to  │
  │                       │                      │                      │     tenant_id)     │
  │                       │                      │                      │  5. Execute:       │
  │                       │                      │                      │     db.findMany()  │
  │                       │                      │                      │────────────────────►│
  │                       │                      │                      │  SELECT * FROM     │
  │                       │                      │                      │  contacts WHERE    │
  │                       │                      │                      │  tenant_id = $1    │
  │                       │                      │                      │◄────────────────────│
  │                       │                      │                      │  6. Audit log      │
  │                       │                      │◄─────────────────────│     (fire&forget)  │
  │                       │  { success: true,    │                      │                    │
  │                       │    data: { data: [], │                      │                    │
  │  200 OK               │    total: N } }      │                      │                    │
  │◄──────────────────────│◄─────────────────────│                      │                    │
```

### AI Command Flow

```
User                    REST Adapter           Command Interpreter        AI Provider         Action Bus
  │                         │                        │                        │                   │
  │ POST /api/ai/command    │                        │                        │                   │
  │ { text: "Create a      │                        │                        │                   │
  │   task called Fix       │                        │                        │                   │
  │   login bug" }          │                        │                        │                   │
  │────────────────────────►│                        │                        │                   │
  │                         │ interpretCommand(text, │                        │                   │
  │                         │ caller, history)       │                        │                   │
  │                         │───────────────────────►│                        │                   │
  │                         │                        │  1. Get all actions    │                   │
  │                         │                        │  2. Build system       │                   │
  │                         │                        │     prompt with        │                   │
  │                         │                        │     action catalog     │                   │
  │                         │                        │  3. Call AI provider   │                   │
  │                         │                        │───────────────────────►│                   │
  │                         │                        │  { actionId:           │                   │
  │                         │                        │    "task.create",      │                   │
  │                         │                        │    input: { title:     │                   │
  │                         │                        │    "Fix login bug" },  │                   │
  │                         │                        │    explanation: "..." }│                   │
  │                         │                        │◄───────────────────────│                   │
  │                         │                        │  4. dispatch(          │                   │
  │                         │                        │     "task.create",     │                   │
  │                         │                        │     { title: "..." },  │                   │
  │                         │                        │     caller)            │                   │
  │                         │                        │──────────────────────────────────────────►│
  │                         │                        │                        │  Same pipeline    │
  │                         │                        │                        │  as any other     │
  │                         │                        │                        │  action dispatch  │
  │                         │                        │◄──────────────────────────────────────────│
  │                         │  CommandResult         │                        │                   │
  │  200 OK                 │◄───────────────────────│                        │                   │
  │◄────────────────────────│                        │                        │                   │
```

### Entity Installation Flow

```
POST /api/entities/install
  { name: "Widget", fields: [...] }
       │
       ▼
  installEntity(entity)
       │
       ├── registerEntity()          → Entity Registry
       ├── buildTableSchema()        → Drizzle table definition
       ├── generateCRUDActions()     → 5 ActionDefinitions
       ├── registerActions()         → Action Bus registry
       ├── runMigrations([entity])   → CREATE TABLE widgets (...)
       └── registerEntityAICapabilities() → AI Gateway (if aiCapabilities defined)
       │
       ▼
  InstallResult { success: true, actions: ["widget.create", ...] }
       │
       ▼
  Entity is immediately live:
    GET  /api/widgets        → lists widgets
    POST /api/widgets        → creates a widget
    AI: "Create a widget"   → works via command interpreter
```

### Webhook Delivery Flow

```
Action Bus                Event Bus              Webhook System           External URL
    │                        │                        │                       │
    │ ctx.emit({             │                        │                       │
    │   type: "task.created",│                        │                       │
    │   payload: {...}       │                        │                       │
    │ })                     │                        │                       │
    │───────────────────────►│                        │                       │
    │                        │  publish(event)        │                       │
    │                        │  → wildcard subscriber │                       │
    │                        │───────────────────────►│                       │
    │                        │                        │  1. Query webhooks    │
    │                        │                        │     WHERE event_type  │
    │                        │                        │     = "task.created"  │
    │                        │                        │     OR event_type     │
    │                        │                        │     = "*"             │
    │                        │                        │                       │
    │                        │                        │  2. For each match:   │
    │                        │                        │     POST with payload │
    │                        │                        │─────────────────────►│
    │                        │                        │                       │ 200 OK
    │                        │                        │◄─────────────────────│
    │                        │                        │  3. Log delivery      │
    │                        │                        │     (success)         │
    │                        │                        │                       │
    │                        │                        │  If 5xx:              │
    │                        │                        │  Retry after 1s, 5s, │
    │                        │                        │  15s (max 3 attempts) │
```

---

## Appendix: Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x |
| Package Manager | pnpm | 9.x |
| API Server | Fastify | 4.x |
| Database | PostgreSQL | 16 |
| ORM | Drizzle + postgres.js | Latest |
| Validation | Zod | 3.x |
| Frontend Framework | Next.js (App Router) | 14.x |
| UI Components | Lit Web Components | 3.x |
| Styling | Tailwind CSS | 3.x |
| Auth | Supabase Auth | Latest |
| AI | Gemini / OpenAI / Anthropic | Latest |
| Email | Resend | Latest |
| Storage | S3-compatible (no SDK) | — |
| Testing | Vitest | Latest |
| CI/CD | GitHub Actions | — |
| Containerization | Docker (PostgreSQL only) | — |
