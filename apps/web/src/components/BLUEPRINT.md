# Web Components

## Purpose

Shared React components used across the web application. These components are
entity-agnostic — they render based on metadata, not hardcoded entity knowledge.

## Components

| Component | File | Purpose |
|-----------|------|---------|
| ChatSidebar | chat-sidebar.tsx | AI assistant panel with multi-turn conversations, SSE streaming, session history |
| CommandBar | command-bar.tsx | Cmd+K keyboard shortcut for natural language AI commands |
| KanbanView | kanban-view.tsx | Drag-free kanban board grouped by a status field |
| CalendarView | calendar-view.tsx | Monthly calendar view for date-based entities |
| FieldInput | field-input.tsx | Re-exports `@metasaas/ui` FieldInput for form rendering |

## Patterns

### ChatSidebar

The AI assistant lives in a collapsible right panel. It:
- Sends natural language to the `/api/ai/command/stream` SSE endpoint
- Displays streaming responses (status, text, result events)
- Manages chat sessions (create, load, delete) via `/api/chat/sessions`
- Stores messages in the database for persistence across page reloads
- Formats action results into human-readable summaries

### View Components

KanbanView and CalendarView receive entity data and configuration:
```typescript
<KanbanView
  records={records}
  groupBy="status"
  columns={["todo", "in_progress", "review", "done"]}
/>
```

They are rendered by the entity list page based on `entity.ui.defaultView`.

## Rules

- Components must be entity-agnostic — never reference specific entities
- All API calls go through `lib/api-client.ts`, never direct fetch
- Error states must be handled gracefully with user-friendly messages
- Loading states must be shown during async operations
- Accessibility: proper ARIA roles, keyboard navigation, focus management
