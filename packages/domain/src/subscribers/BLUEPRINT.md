# Domain Event Subscribers

## Purpose

Reactive logic that responds to domain events published by the Action Bus.
Subscribers are the domain's way of reacting to things that happened — they
never trigger the events themselves.

## Architecture

```
Action executes (e.g., task.update)
  ↓ CRUD generator emits event (e.g., task.updated, task.workflow.transitioned)
  ↓ EventBus routes to matching subscribers
  ↓ Subscriber reacts (log, notify, trigger downstream action)
```

## Subscriber Patterns

### Exact Match
Listen for a specific event type:
```typescript
const sub: EventSubscriber = {
  eventType: "task.workflow.transitioned",  // exact match
  name: "LogTaskTransition",
  handler: async (event) => { /* react */ },
};
```

### Wildcard
Listen for ALL events (useful for audit logs):
```typescript
const sub: EventSubscriber = {
  eventType: "*",  // matches everything
  name: "AuditLog",
  handler: async (event) => {
    if (!event.type.endsWith(".created")) return;  // filter in handler
  },
};
```

## Adding a New Subscriber

1. Define an `EventSubscriber` object in this directory
2. Add it to the `eventSubscribers` array in `index.ts`
3. The bootstrap registers all subscribers at startup via `subscribeAll()`
4. No platform changes needed — the EventBus handles routing

## Event Types Emitted by CRUD Generator

- `{entity}.created` — after a record is created (payload: full record)
- `{entity}.updated` — after a record is updated (payload: { id, changes })
- `{entity}.deleted` — after a record is deleted (payload: { id })
- `{entity}.workflow.transitioned` — when a workflow field changes (payload: { id, workflow, field, from, to, triggers })

## Rules

- Subscribers NEVER break the action that emitted the event
- Errors in subscribers are caught and logged by the EventBus
- Subscribers run asynchronously after the action completes
- Keep subscriber logic lightweight — heavy work should dispatch new actions
- Domain subscribers are pure domain logic — no HTTP, no database internals
