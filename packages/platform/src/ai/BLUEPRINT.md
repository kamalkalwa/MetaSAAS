# AI Gateway

## Purpose

The AI Gateway bridges AICapabilityDefinitions (declared in domain entities)
and the Action Bus. Each AI capability becomes a registered Action that
assembles a prompt, calls an AI provider, and returns structured output.

## Architecture

```
Domain Entity (declares AICapabilityDefinition)
  ↓ bootstrap
registerEntityAICapabilities(entity)
  ↓
registerAICapability → creates an Action in the Action Bus
wireAITrigger        → creates an EventBus subscriber for on_create/on_update
  ↓ at runtime
EventBus fires (e.g., product.created)
  → subscriber dispatches AI action
  → AI action extracts context, builds prompt, calls provider
  → parses response with Zod schema
  → updates entity record with AI output
```

## Provider Interface

```typescript
interface AIProvider {
  readonly name: string;
  complete(messages: AIMessage[], options?: AIRequestOptions): Promise<string>;
}
```

- `NullAIProvider`: No-op, always throws (forces fallback). Used when no API key set.
- `GeminiProvider`: Calls Google Gemini API (`generativelanguage.googleapis.com`). Default model: `gemini-2.0-flash`.
- `OpenAIProvider`: Calls OpenAI chat completions API. Default model: `gpt-4o-mini`.
- `AnthropicProvider`: Calls Anthropic Messages API. Default model: `claude-sonnet-4-20250514`.

## Provider Selection

The gateway selects a provider at startup:

1. If `AI_PROVIDER` env var is set (`gemini` | `openai` | `anthropic`), use that (fail fast if key missing)
2. Otherwise, auto-detect by checking keys in order: `GOOGLE_AI_API_KEY` → `OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → `NullAIProvider`

## Adding a New AI Provider

1. Create `your-provider.ts` implementing the `AIProvider` interface (raw `fetch()`, no SDK)
2. Add a factory entry in `gateway.ts` (`createExplicitProvider` + `autoDetectProvider`)
3. Export from `ai/index.ts` and `platform/src/index.ts`
4. Add env vars: `YOUR_API_KEY` and `YOUR_MODEL`
5. No domain changes needed — all capabilities route through the same interface

## Command Interpreter (Cmd+K)

The AI Command Interpreter is the "natural language adapter" — like the REST adapter
maps HTTP verbs to actions, this maps human language to actions.

```
User types: "Create a task called Fix login bug with high priority"
  ↓ POST /api/ai/command { text: "..." }
  ↓ interpretCommand(text, caller)
  ↓ AI receives: list of all registered actions + user text
  ↓ AI returns: { actionId: "task.create", input: { title: "Fix login bug", priority: "high" } }
  ↓ dispatch("task.create", input, caller) — same Action Bus pipeline
  ↓ Result returned to user
```

Security: The AI only maps intent. The Action Bus enforces ALL rules (validation,
permissions, workflow checks). A natural language command has exactly the same security
as a REST API call or UI button click.

## Chat Sidebar (Phase 4)

The Chat Sidebar replaces the Cmd+K popup with a persistent right panel:

```
User opens sidebar (Cmd+K)
  ↓ selects existing session or starts new one
  ↓ POST /api/ai/command/stream { text, history }
  ↓ SSE events stream back:
      event: status → "thinking" | "interpreting" | "executing" | "done"
      event: text   → incremental interpretation text
      event: result → final CommandResult JSON
  ↓ Messages persisted to chat_sessions + chat_messages tables
```

### Chat Persistence (Phase 5)

Platform-level tables (NOT domain entities):

```sql
chat_sessions: id, tenant_id, user_id, title, created_at, updated_at
chat_messages: id, session_id, role, content, action_id, result_data, is_error, created_at
```

- Created by `runPlatformMigrations()` (separate from entity migrations)
- All queries scoped by `tenant_id` for multi-tenancy isolation
- REST API: `/api/chat/sessions` (CRUD) + `/api/chat/sessions/:id/messages` (add)

### Streaming (SSE)

`POST /api/ai/command/stream` returns `text/event-stream`:
- Uses Fastify's `reply.raw` for direct Node.js response streaming
- Progress events give real-time UX feedback
- Interpretation text is streamed in 3-character chunks for typing effect
- Falls back gracefully if streaming fails (non-streaming endpoint still exists)

## Security

- API keys are server-side only (never exposed to frontend)
- AI responses are parsed through Zod schemas (untrusted input)
- AI errors never break the application (always fall back to declared fallback)
- AI actions go through the Action Bus (logged, permissioned, auditable)
- Command interpreter input is length-limited (2000 chars) to prevent prompt injection
- AI only selects from registered actions — it cannot invent or fabricate action IDs
- Conversation history is sanitized: valid roles only, max 10 messages, 5000 char limit per message
- Chat sessions are tenant-scoped: users can only access their own sessions
- SSE CORS headers are set explicitly on the streaming endpoint

## Rules

- NEVER trust AI output directly — always validate with Zod
- EVERY capability MUST declare a fallback
- AI operations are just Actions — they follow the same pipeline as everything else
- Domain code declares WHAT AI should do. Platform code handles HOW.
- The command interpreter is an adapter, not a bypass — all security flows through the bus
- Chat persistence failures are NON-CRITICAL — messages exist in React state as primary
- Platform tables are NEVER defined via EntityDefinition — they use `runPlatformMigrations()`
