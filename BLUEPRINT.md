# MetaSAAS

## Purpose

MetaSAAS is an AI-native, entity-driven SaaS application framework. It separates
PLATFORM code (auth, billing, AI, infrastructure — never modified for business logic)
from DOMAIN code (your business entities, rules, and workflows — the only code you write).

Define your entities. The platform gives you a working application with full CRUD,
API, UI, and AI capabilities — automatically.

## Architecture

```
packages/contracts/   → Shared TypeScript interfaces (the boundary)
packages/platform/    → Infrastructure engine (Action Bus, DB, adapters) — NEVER edit for business logic
packages/ui/          → Shared UI components and page patterns
packages/domain/      → YOUR business entities, actions, and workflows — the only code you write
apps/api/             → Fastify backend that wires platform + domain
apps/web/             → Next.js frontend that renders entities dynamically
```

### Three Layers of Complexity

1. **Layer 1 (Declarative)**: Define entity fields, relationships, UI config. Zero code.
   The platform auto-generates CRUD actions, DB tables, API endpoints, and UI pages.

2. **Layer 2 (Configuration)**: Add workflows (state machines), views (kanban, calendar),
   and event triggers using platform primitives. Still declarative — no imperative code.

3. **Layer 3 (Custom Code)**: Use hooks (beforeCreate, afterUpdate, etc.) and custom
   actions for business logic that can't be expressed declaratively. Full TypeScript,
   full ActionContext access, but still runs inside the platform pipeline.

### What the Platform Handles Automatically

- **Multi-tenancy**: Every record is scoped by `tenant_id`. All queries are filtered.
  Domain code never touches tenant_id — it's injected by the Action Bus.
- **Authentication**: Supabase JWT verification (production) or DevAuthProvider (local).
  The auth middleware attaches a `Caller` (userId, tenantId, roles, type) to every request.
- **Authorization**: Permission rules on every action. First-match-wins evaluation.
  Default: denied if no rule matches (secure by default).
- **Validation**: Zod schemas on every action input. Invalid input never reaches execute().
- **Schema Evolution**: Adding fields to an entity definition automatically adds columns.
  Safe type changes (widening) are applied automatically. Unsafe changes are logged.
- **Event Bus**: Actions emit domain events. Workflow transitions emit trigger events.
  Subscribers react to events without coupling to the action that emitted them.

## Example

To add a new business concept (e.g., "Invoice"):
1. Create `packages/domain/src/entities/invoice/` directory
2. Read `packages/domain/src/entities/BLUEPRINT.md` for the exact pattern
3. Define `invoice.entity.ts` following the pattern
4. Create a `BLUEPRINT.md` explaining what this entity is
5. Add it to `packages/domain/src/index.ts` (entities array, navigation, seed data)
6. Run `pnpm db:migrate` — table is created automatically
7. Restart dev servers — entity appears in the UI with full CRUD

## Rules

- NEVER put business logic in `packages/platform/`
- NEVER put infrastructure code in `packages/domain/`
- NEVER import platform internals from domain — only import from `@metasaas/contracts`
- Every entity directory MUST have a BLUEPRINT.md explaining what it is
- All Actions go through the Action Bus — no direct database calls from domain code
- The platform knows NOTHING about specific entities (Contact, Deal, etc.)
- Multi-tenancy is transparent to domain code — never reference tenant_id
- Prefer Layer 1 over Layer 2, and Layer 2 over Layer 3 (least complexity wins)
