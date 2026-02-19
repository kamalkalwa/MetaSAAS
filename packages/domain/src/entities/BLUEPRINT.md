# Entity

## Purpose

An entity is a business object your application manages. Each entity gets its
own directory with a standard set of files. The platform automatically provides
CRUD API, database table, list/detail/form pages, search, and audit logging.

Entities support three layers of complexity:
- **Layer 1 (Declarative)**: Fields, relationships, UI config — zero code
- **Layer 2 (Configuration)**: Workflows, views (kanban, calendar), event triggers
- **Layer 3 (Custom Code)**: Hooks (beforeCreate, afterUpdate, etc.) for business logic

## Pattern

Directory: `domain/src/entities/{name}/`

Files:
  {name}.entity.ts      → Fields, relationships, UI config (REQUIRED)
  {name}.actions.ts      → Custom actions beyond CRUD (optional)
  BLUEPRINT.md           → What this entity is, its context (REQUIRED)

### Layer 1: Basic Entity (fields + relationships + UI)

```typescript
import { defineEntity } from "@metasaas/contracts";

export const {Name}Entity = defineEntity({
  name: "{Name}",
  pluralName: "{Names}",
  description: "{What this thing IS in plain English}",

  fields: [
    // type options: text, email, phone, url, currency, date, datetime,
    //               number, percentage, enum, rich_text, boolean
    { name: "title", type: "text", required: true, description: "..." },
    { name: "status", type: "enum", required: true,
      options: ["draft", "active", "archived"],
      defaultValue: "draft", description: "..." },
    { name: "dueDate", type: "date", required: false, description: "..." },
  ],

  relationships: [
    // type options: belongsTo, hasMany, manyToMany
    { type: "belongsTo", entity: "{OtherEntity}", foreignKey: "{other}_id" },
  ],

  ui: {
    icon: "{icon-name}",
    listColumns: ["title", "status", "dueDate"],
    searchFields: ["title"],
    defaultSort: { field: "title", direction: "asc" },
  },
});
```

### Layer 2: Workflows + Views

Add state machine validation and alternative UI views:

```typescript
export const {Name}Entity = defineEntity({
  // ... Layer 1 fields, relationships, ui ...

  workflows: [
    {
      name: "{name}Lifecycle",
      field: "status",
      transitions: [
        { from: "draft", to: "active" },
        { from: "active", to: "archived" },
        { from: "active", to: "draft" },
        // Transitions with required fields:
        { from: "draft", to: "active", requires: ["assignee"] },
        // Transitions with event triggers:
        { from: "active", to: "archived", triggers: ["notify_team"] },
      ],
    },
  ],

  ui: {
    icon: "{icon-name}",
    listColumns: ["title", "status", "dueDate"],
    searchFields: ["title"],
    defaultSort: { field: "title", direction: "asc" },
    // View configuration
    defaultView: "kanban",           // "list" | "kanban" | "calendar"
    kanban: { groupBy: "status" },   // Required when defaultView is "kanban"
    calendar: { dateField: "dueDate" }, // Required when defaultView is "calendar"
  },
});
```

### Layer 3: Custom Hooks

Inject business logic into CRUD actions without replacing them:

```typescript
export const {Name}Entity = defineEntity({
  // ... Layer 1 + Layer 2 ...

  hooks: {
    // Transform input before creating a record
    beforeCreate: async (input, ctx) => {
      input.slug = input.title.toLowerCase().replace(/\s+/g, "-");
      return input;
    },
    // Trigger side effects after creating a record
    afterCreate: async (result, input, ctx) => {
      await ctx.emit({ type: "{name}.created.custom", payload: result });
      return result;
    },
    // Validate or enrich before updating
    beforeUpdate: async (input, ctx) => {
      // input is { id, data }
      return input;
    },
    // Side effects after update
    afterUpdate: async (result, input, ctx) => {
      return result;
    },
    // Guard against deletion
    beforeDelete: async (input, ctx) => {
      // Throw to abort: throw new Error("Cannot delete active records");
      return input;
    },
  },
});
```

### AI Capabilities

Declare what AI should do for this entity. The platform handles the rest:

```typescript
import { defineEntity, defineAICapability } from "@metasaas/contracts";
import { z } from "zod";

const enrichCapability = defineAICapability({
  id: "{entity}.enrich",
  type: "generation",        // generation, enrichment, classification, extraction, analysis, suggestion
  intent: "Generate a one-sentence summary from the record's title and category.",
  input: {
    contextFields: ["title", "category", "price"],  // fields sent as AI context
  },
  output: {
    schema: z.object({ summary: z.string().max(200) }),  // Zod schema for structured output
    fallback: { summary: "" },  // REQUIRED — used when AI is unavailable
  },
  trigger: "on_create",      // on_demand | on_create | on_update | on_schedule
  preferences: {
    quality: "fast",          // fast | balanced | quality
  },
});

export const {Name}Entity = defineEntity({
  // ... fields, relationships, workflows, hooks, ui ...
  aiCapabilities: [enrichCapability],
});
```

Triggers:
- `on_create`: AI runs automatically when a record is created (via EventBus)
- `on_update`: AI runs automatically when a record is updated (via EventBus)
- `on_demand`: AI runs only when explicitly called via the Action Bus
- `on_schedule`: Not implemented yet (requires scheduler infrastructure)

## Example

See `product/product.entity.ts` for a complete example with Layer 1 + 2 + AI capabilities.
See `task/task.entity.ts` for a working example with Layer 1 + 2 (workflows + views).
See `contact/contact.entity.ts` for a basic Layer 1 example.

## Rules

- Every field MUST have a description (AI agents and the command bar use this)
- Sensitive fields (PII) MUST be marked with `sensitive: true`
- listColumns: 3-5 fields maximum (more clutters the screen)
- Entity name: singular, PascalCase (Contact, not Contacts or contact)
- File names: lowercase (contact.entity.ts, not Contact.entity.ts)
- description on the entity: write as if explaining to someone who knows nothing about the business
- Workflows: define only transitions that make business sense. Unlisted transitions are blocked.
- Hooks: prefer Layer 1 (fields) or Layer 2 (workflows) before reaching for Layer 3 hooks
- Views: kanban requires an enum field as groupBy. Calendar requires a date/datetime field.
- Multi-tenancy is automatic — every record is scoped to the caller's tenant. Domain code never handles tenant_id.
- AI capabilities: every capability MUST declare a fallback. AI errors never break the application.
- AI capabilities: use `on_create` or `on_update` triggers for automatic enrichment. Use `on_demand` for user-initiated actions.
- AI capabilities: the output Zod schema is what gets written back to the record. Only include fields that exist on the entity.
