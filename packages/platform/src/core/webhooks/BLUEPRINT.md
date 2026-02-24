# Webhooks

## Purpose

Dispatches HTTP POST requests to external URLs when domain events fire. Turns MetaSAAS from a standalone application into a platform that participates in a larger ecosystem (Slack, Zapier, email services, etc.).

## How It Works

1. Register a webhook via `POST /api/webhooks` with an event type and URL
2. The webhook dispatcher subscribes to the Event Bus with a wildcard (`*`)
3. When any event fires, matching webhooks receive an HTTP POST with the event payload
4. Failed deliveries retry with exponential backoff (1s → 5s → 15s, 3 attempts max)

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/webhooks` | List webhooks for this tenant |
| `POST` | `/api/webhooks` | Register a new webhook |
| `DELETE` | `/api/webhooks/:id` | Remove a webhook |
| `GET` | `/api/webhooks/:id/deliveries` | View delivery log |

## Payload Format

```json
{
  "event": "task.created",
  "data": { "id": "...", "title": "...", ... },
  "timestamp": "2026-02-14T..."
}
```

## Storage

In-memory for v0. Production deployments should swap for a database-backed store.
