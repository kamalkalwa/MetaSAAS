# Platform

## Purpose

The platform package is the engine of MetaSAAS. It provides the Action Bus,
database layer, entity management, event bus, authentication, and protocol adapters.
It knows NOTHING about specific business entities — it only understands the contracts.

## Architecture

```
src/
  core/
    action-bus/       → Central dispatch: register, validate, authorize, execute actions
      middleware/      → validation, permission, workflow, logging
    database/         → Drizzle ORM: connection, schema-builder, client, migration
    entity-manager/   → Auto-discovers entities and generates CRUD actions
    event-bus/        → Pub/sub for domain events (subscribe, publish, wildcard)
    config/           → Application configuration loading
  adapters/
    rest/             → Maps Action Bus actions to Fastify HTTP routes
  auth/
    index.ts          → Auth provider wiring (Supabase or Dev)
    supabase-provider → JWT verification via Supabase
    dev-provider      → No-auth dev mode (auto-activated when Supabase not configured)
```

## Action Bus Pipeline

Every operation flows through the Action Bus in this order:

1. **Lookup** — Find the registered action by ID
2. **Validate** — Run input through the action's Zod schema
3. **Authorize** — Evaluate permission rules against the Caller
4. **Build Context** — Create ActionContext (db scoped to tenant, emit, logger)
5. **Before Hook** — Run `beforeExecute` if defined (Layer 3)
6. **Execute** — Run the action's business logic
7. **After Hook** — Run `afterExecute` if defined (Layer 3)
8. **Log** — Record success/failure with duration

## Database Layer

- **Schema Builder**: Reads `EntityDefinition.fields` and creates Drizzle table schemas
  at runtime. Every table gets: `id` (UUID), `tenant_id` (UUID), `created_at`, `updated_at`.
- **Client**: `createDatabaseClient(tenantId)` returns a DatabaseClient where every
  query (findMany, findById, create, update, delete, count) is automatically scoped
  by `tenant_id`. Domain code never handles tenant filtering.
- **Migration**: `runMigrations(entities)` creates tables for new entities and evolves
  existing tables (ADD COLUMN for new fields, ALTER TYPE for safe type changes).

## Event Bus

- `subscribe(subscriber)` — Register a handler for an event type
- `publish(event)` — Dispatch to all matching handlers (exact + wildcard "*")
- Failed handlers are logged but never break the emitting action
- Workflow transitions emit `{entity}.workflow.transitioned` events with trigger names

## Authentication

- `AuthProvider` interface with `verifyToken(token)` returning a `Caller`
- `SupabaseAuthProvider` for production (JWT verification via Supabase)
- `DevAuthProvider` for local development (always returns admin caller)
- Auth middleware on Fastify: extracts Bearer token, verifies, attaches Caller to request

## CRUD Generator

Reads an `EntityDefinition` and auto-generates 5 actions:
- `{entity}.create` — with beforeCreate/afterCreate hooks
- `{entity}.findAll` — with pagination, sorting, filtering
- `{entity}.findById` — single record lookup
- `{entity}.update` — with workflow validation + beforeUpdate/afterUpdate hooks
- `{entity}.delete` — with beforeDelete hook

All generated actions have ALLOW_ALL permissions by default (override in domain actions).

## Rules

- NEVER reference domain-specific entities (Contact, Deal, etc.) by name
- NEVER import from `@metasaas/domain` — the domain registers with the platform
- All database access goes through the DatabaseClient interface
- All operations go through the Action Bus (no direct route handlers with business logic)
- Multi-tenancy is enforced at the database client level — never optional
