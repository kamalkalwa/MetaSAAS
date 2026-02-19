# Domain

## Purpose

This package contains YOUR business logic — the entities, actions, and workflows
that define what your application does. This is the ONLY package you modify
for business logic. Everything else is platform infrastructure.

## Pattern

```
src/
  index.ts              → Exports all entities, navigation, seed data
  entities/
    BLUEPRINT.md        → How to create a new entity (read this first!)
    {name}/
      BLUEPRINT.md      → What this entity is, its relationships, edge cases
      {name}.entity.ts  → Entity definition (fields, relationships, UI)
      {name}.actions.ts → Custom actions (optional — CRUD is auto-generated)
```

## Adding a New Entity

1. Create `src/entities/{name}/` directory
2. Read `src/entities/BLUEPRINT.md` for the full pattern (Layer 1, 2, 3)
3. Write `{name}.entity.ts` with fields, relationships, UI config
4. Write `BLUEPRINT.md` describing what the entity is
5. Update `src/index.ts`:
   - Import and add to the `entities` array (order matters: parent before child)
   - Add a navigation item
   - Add seed data (optional but recommended)
6. Run `pnpm db:migrate` — table is created automatically
7. Restart dev servers — entity appears with full CRUD, API, and UI

## What Happens Automatically

When you define an entity and register it:
- **Database**: Table created with all fields + id, tenant_id, created_at, updated_at
- **API**: REST endpoints created (GET /api/{plural}, POST, GET/:id, PUT/:id, DELETE/:id)
- **UI**: List page, detail page, create form, edit form — all auto-generated
- **Validation**: Zod schemas derived from field definitions
- **Multi-tenancy**: All data scoped by tenant — zero configuration needed
- **Search**: Quick-search on declared searchFields
- **Views**: List (default), Kanban (if kanban config set), Calendar (if calendar config set)

## Rules

- NEVER import from `@metasaas/platform` — only from `@metasaas/contracts`
- Every entity needs a BLUEPRINT.md
- Entity definitions are DECLARATIVE — no database calls, no HTTP, no side effects
- Custom business logic goes in hooks or action files, not in entity definitions directly
- Seed data goes in `index.ts` seedData export
- Entity order in the `entities` array matters: parent entities before children (for FK resolution)
- Multi-tenancy is automatic — never reference tenant_id in domain code
