# MetaSAAS

An AI-native, entity-driven SaaS application framework. Define your business entities declaratively and get a full production-grade application — CRUD API, database, dynamic UI, auth, multi-tenancy, and workflow engine — automatically.

**The 80% of SaaS infrastructure you rebuild every time, solved once.**

```
Traditional app:     Code is the product.
MetaSAAS app:        BLUEPRINTs are the product. Code is the output.
```

## What You Get

Define an entity like this:

```typescript
export const TaskEntity = defineEntity({
  name: "Task",
  pluralName: "Tasks",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "status", type: "enum", options: ["todo", "in_progress", "done"], defaultValue: "todo" },
    { name: "priority", type: "enum", options: ["low", "medium", "high"] },
  ],
  workflows: [{ name: "lifecycle", field: "status", transitions: [
    { from: "todo", to: "in_progress" },
    { from: "in_progress", to: "done" },
  ]}],
  ui: { icon: "check-square", listColumns: ["title", "status", "priority"], ... },
});
```

And the platform gives you:

- **5 CRUD actions** (create, findAll, findById, update, delete) through the Action Bus
- **REST API** (`GET /api/entities/tasks`, `POST`, `PATCH`, `DELETE`)
- **Database table** with auto-migration and schema evolution
- **Dynamic UI** (list view, detail page, create/edit forms, kanban board, calendar)
- **AI integration** (Cmd+K: "create a task called Fix login bug with high priority")
- **Workflow enforcement** (invalid state transitions are rejected with valid alternatives)
- **Audit logging** (every action recorded to `audit_log` table)
- **Multi-tenancy** (data isolation per tenant, enforced at database level)

## AI Entity Generation

Describe a business domain in natural language and MetaSAAS generates the complete entity definitions, writes them to disk, and registers them:

```
You: "I want to build a gym management system"

AI generates:
  → Member (7 fields, status workflow, kanban view)
  → Trainer (5 fields, specialization)
  → Class (6 fields, belongsTo Trainer, calendar view)
  → Enrollment (3 fields, belongsTo Member + Class)

Files written:
  → packages/domain/src/entities/member/member.entity.ts
  → packages/domain/src/entities/member/BLUEPRINT.md
  → packages/domain/src/entities/trainer/trainer.entity.ts
  → ... (8 files total)
  → packages/domain/src/index.ts (updated with imports + navigation)
```

Restart the dev server and the new domain is fully operational — CRUD, API, UI, AI, workflows.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
# Clone and install
git clone https://github.com/kamalkalwa/MetaSAAS.git && cd MetaSAAS
pnpm install

# Configure environment
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Build all packages
pnpm build

# Create database tables + load demo data
pnpm db:migrate && pnpm db:seed

# Start development servers (API on :4000, Web on :3000)
pnpm dev
```

Open http://localhost:3000 — you'll see the dashboard with 13 entities across 5 domains.

### Authentication

By default, MetaSAAS runs in **dev mode** (no authentication required). To enable Supabase auth, add to your `.env`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### AI Chat

To enable the AI chat sidebar (Cmd+K), add an AI provider key to `.env`:

```bash
AI_PROVIDER=gemini                    # gemini | openai | anthropic (auto-detects if omitted)
GOOGLE_AI_API_KEY=your-key            # for Gemini
# OPENAI_API_KEY=sk-your-key         # for OpenAI
# ANTHROPIC_API_KEY=sk-ant-your-key  # for Anthropic
```

## Architecture

```
packages/
  contracts/   → Shared TypeScript interfaces (platform ↔ domain boundary)
  platform/    → Infrastructure engine — Action Bus, DB, auth, AI, events
  domain/      → YOUR business entities, workflows, subscribers (the ONLY code you write)
  ui/          → Shared UI components
apps/
  api/         → Fastify backend (wires platform + domain at bootstrap)
  web/         → Next.js 15 frontend (renders entities dynamically from metadata)
```

**Domain** only imports from **Contracts**. **Platform** only imports from **Contracts**. Neither imports from the other. This separation is what enables "define once, get everything" and future platform updates without touching domain code.

### Action Bus

Every operation flows through the same pipeline — whether triggered by a button click, REST call, AI command, or event subscriber:

```
Request → Validate (Zod) → Authorize (RBAC) → [Before Hook] → Execute → [After Hook] → Side Effects → Audit Log → Response
```

### Three Layers of Complexity

| Layer | What | How | Coverage |
|-------|------|-----|----------|
| **1. Declarative** | Fields, relationships, UI | `defineEntity({...})` | ~70% of any app |
| **2. Configuration** | Workflows, views, events | `workflows`, `ui.kanban` | ~25% of any app |
| **3. Custom Code** | Business logic hooks | `hooks.beforeCreate` | ~5% of any app |

### Domains Included

| Domain | Entities | Features |
|--------|----------|----------|
| **CRM** | Company, Contact | Relationships, status tracking |
| **Project Management** | Project, Task | 4-state workflow, kanban + calendar views |
| **Inventory** | Warehouse, Product | 3-state lifecycle, AI description generation |
| **Clinic** | Doctor, Patient, Appointment | 5-state workflow, calendar view, relationships |
| **Gym** *(AI-generated)* | Member, Trainer, Class, Enrollment | Status workflow, relationships, calendar view |

The Gym domain was generated entirely by the AI from a single prompt — proving the thesis that new business domains can be created from natural language.

## Adding a New Entity

1. Create `packages/domain/src/entities/{name}/` directory
2. Read `packages/domain/src/entities/BLUEPRINT.md` for the full pattern
3. Define `{name}.entity.ts` with fields, relationships, UI config
4. Create a `BLUEPRINT.md` explaining what this entity represents
5. Register in `packages/domain/src/index.ts` (entities, navigation, seed data)
6. Run `pnpm db:migrate`
7. Restart — entity appears with full CRUD, API, and UI

Or just open the AI chat sidebar and describe what you want to build.

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start all dev servers (API + Web) |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all 334 unit/integration tests |
| `pnpm test:e2e` | Run 14 Playwright E2E tests |
| `pnpm db:migrate` | Create/evolve database tables from entity definitions |
| `pnpm db:seed` | Load demo data for all 13 entities |

## Testing

- **334 unit/integration tests** across 18 test files (Vitest)
  - Action Bus pipeline, RBAC, multi-tenant isolation, workflow validation
  - Entity contracts, field types, CRUD generation
  - AI command interpreter, API client, UI components
- **14 E2E tests** across 3 Playwright specs
  - Login flow (redirect, form, credentials, success)
  - Entity CRUD lifecycle (navigation, list, create, detail)
  - AI chat sidebar (open/close, keyboard shortcut, send/receive, new chat)

## Security

- **Helmet** — XSS, clickjacking, MIME sniffing protection
- **Rate limiting** — per-IP, configurable, public routes exempted
- **CORS lockdown** — environment-based origin restriction
- **Audit logging** — every Action Bus dispatch recorded (tenant, user, action, duration, success)
- **RBAC** — role-based access control with first-match-wins permission evaluation
- **Multi-tenancy** — database-level tenant isolation, no cross-tenant data leakage
- **JWT handling** — automatic 401 interception and redirect to login

See [SECURITY.md](SECURITY.md) for the full security architecture.

## Documentation

Every directory has a `BLUEPRINT.md` — 24 total. These serve as documentation for humans and instruction sets for AI agents. Read the relevant BLUEPRINT before making changes.

| Document | What it covers |
|----------|---------------|
| [VISION.md](VISION.md) | Full project vision, phases, milestones, architecture |
| [SECURITY.md](SECURITY.md) | Security architecture and threat model |
| [BLUEPRINT.md](BLUEPRINT.md) | Root architecture overview |
| [HLD.md](HLD.md) | High-level design |
| [LLD.md](LLD.md) | Low-level design |

## Tech Stack

- **TypeScript** everywhere (no JavaScript, no `any` escape hatches)
- **Turborepo** monorepo management
- **pnpm** package manager
- **Next.js 15** (App Router) frontend
- **Fastify** backend API
- **PostgreSQL** + **Drizzle ORM** database
- **Zod** runtime validation
- **Tailwind CSS** styling
- **Vitest** + **Playwright** testing

## License

[MIT](LICENSE)
