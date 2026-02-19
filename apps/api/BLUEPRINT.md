# API Server

## Purpose

The Fastify backend that wires the platform engine with the domain layer
and serves the REST API. This is a thin assembly layer — almost no
business logic lives here.

## Pattern

```
src/
  index.ts        → Fastify entry point (create server, register plugins, start)
  bootstrap.ts    → Wire platform + domain (register entities, generate CRUD, migrate)
  seed.ts         → Populate database with demo data
```

## Example

The bootstrap sequence:
1. Load config from environment
2. Initialize database connection
3. Register domain entities with platform
4. Build DB schemas from entity definitions
5. Generate CRUD actions for each entity
6. Run migrations
7. Start Fastify server with auto-generated routes

## Rules

- NO business logic in this package — it's assembly only
- NO direct database queries — everything goes through the Action Bus
- The only domain import is entity definitions and seed data
- Plugins (CORS, error handling) are infrastructure, not business logic
