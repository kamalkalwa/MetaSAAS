# Web Frontend

## Purpose

The Next.js 15 (App Router) frontend that renders entities dynamically from
metadata. Pages are entity-driven — the same page components render any entity
type by reading its definition from the API at runtime.

## Architecture

```
src/
  app/
    (auth)/            → Authentication pages (login, signup)
    (app)/             → Main app layout with sidebar navigation
      dashboard/       → Dashboard overview with entity counts
      [entity]/        → Dynamic entity routes:
        page.tsx         → Entity list page (table, kanban, or calendar view)
        new/page.tsx     → Create form (fields from entity definition)
        [id]/page.tsx    → Detail view (single record)
        [id]/edit/       → Edit form (pre-filled fields)
  components/
    chat-sidebar.tsx   → AI assistant panel (multi-turn, SSE streaming, sessions)
    command-bar.tsx    → Cmd+K natural language command interface
    kanban-view.tsx    → Kanban board (grouped by status field)
    calendar-view.tsx  → Calendar view (date-driven entities)
    field-input.tsx    → Re-exports FieldInput from @metasaas/ui
  lib/
    api-client.ts      → HTTP client for the Fastify backend (actions + chat)
    auth-context.tsx   → React context for Supabase auth state
    supabase.ts        → Supabase client initialization
    utils.ts           → Shared utility functions
```

## Data Flow

1. Layout fetches entity metadata from `/api/meta/entities` on mount
2. Sidebar navigation is generated from the entity list
3. Entity pages fetch data through the API client, which calls Action Bus endpoints
4. Forms are generated from entity field definitions (type, required, options)
5. AI chat sidebar dispatches commands through the streaming endpoint

## Key Patterns

- **Entity-driven pages**: `[entity]/page.tsx` reads the entity name from the URL,
  fetches its metadata, and renders the appropriate view (list, kanban, calendar)
- **Dynamic forms**: Create and edit pages generate form fields from entity definitions
- **View switching**: Entities with `defaultView: "kanban"` render the kanban view;
  others render a table. Calendar is available when `calendar.dateField` is set.
- **Auth guard**: The `(app)` layout checks for a valid Supabase session and
  redirects to `/login` if unauthenticated

## Rules

- NEVER hardcode entity names — all pages must work with any entity definition
- NEVER call the database directly — all data flows through the API client
- Forms must handle all field types defined in `@metasaas/contracts`
- Components must be responsive and accessible
- Use Tailwind CSS for styling; shadcn/ui for complex components
