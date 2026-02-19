# Contracts

## Purpose

This package defines the shared TypeScript interfaces that form the boundary between
platform and domain. Both sides import from here — neither imports from the other.
Changes here must be backwards-compatible.

## Key Contracts

| Contract | File | What It Defines |
|----------|------|-----------------|
| `EntityDefinition` | entity.ts | Fields, relationships, workflows, hooks, UI config |
| `EntityHooks` | entity.ts | Layer 3 hooks: beforeCreate, afterUpdate, etc. |
| `ActionDefinition` | action.ts | Input/output schema, permissions, execute, hooks |
| `PermissionRule` | permission.ts | Who can do what (callerTypes, roles, effect) |
| `SimpleWorkflowDefinition` | workflow.ts | State machine: field, transitions, requires, triggers |
| `ActionContext` | context.ts | What execute() receives: db, emit, caller, logger |
| `Caller` | context.ts | userId, tenantId, roles, type |
| `DatabaseClient` | context.ts | findMany, findById, create, update, delete, count |
| `AuthProvider` | auth.ts | verifyToken() interface for swappable auth |
| `EntityUIConfig` | entity.ts | icon, listColumns, defaultView, kanban, calendar |

## Pattern

Each file exports one or more TypeScript interfaces or types related to a single concept.
All public types are re-exported from `index.ts`.

```typescript
// src/entity.ts
export interface EntityDefinition {
  name: string;
  pluralName: string;
  description: string;
  fields: FieldDefinition[];
  relationships?: RelationshipDefinition[];
  workflows?: SimpleWorkflowDefinition[];
  hooks?: EntityHooks;
  ui: EntityUIConfig;
}

export interface EntityUIConfig {
  icon: string;
  listColumns: string[];
  searchFields: string[];
  defaultSort: SortConfig;
  defaultView?: "list" | "kanban" | "calendar";
  kanban?: { groupBy: string };
  calendar?: { dateField: string };
}

export interface EntityHooks {
  beforeCreate?: (input, ctx) => Promise<input>;
  afterCreate?: (result, input, ctx) => Promise<result>;
  beforeUpdate?: (input, ctx) => Promise<input>;
  afterUpdate?: (result, input, ctx) => Promise<result>;
  beforeDelete?: (input, ctx) => Promise<input>;
}
```

## Rules

- Every interface MUST have JSDoc comments explaining its purpose
- Every field MUST have a JSDoc or inline comment
- Use Zod for runtime validation schemas (not just TypeScript types)
- Keep interfaces minimal — add fields only when a concrete use case requires them
- NEVER import from `@metasaas/platform` or `@metasaas/domain` here
- Changes must be backwards-compatible (add optional fields, never remove or rename)
