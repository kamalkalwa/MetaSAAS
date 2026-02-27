/**
 * REST Adapter
 *
 * Maps the Action Bus to HTTP endpoints on a Fastify instance.
 * Generates two styles of routes:
 *
 *   1. Generic action endpoint: POST /api/actions/:actionId
 *      — Any action can be dispatched by ID
 *
 *   2. RESTful entity routes: GET/POST/PATCH/DELETE /api/:pluralName
 *      — Conventional REST for CRUD operations
 *
 *   3. Metadata endpoint: GET /api/meta/entities
 *      — Returns all entity definitions (used by the frontend to render UI)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Caller } from "@metasaas/contracts";
import { dispatch, type ActionResult } from "../../core/action-bus/bus.js";
import { getAllActions } from "../../core/action-bus/registry.js";
import {
  getAllEntities,
  getEntityByPlural,
} from "../../core/entity-manager/entity-registry.js";
import { getAuthProvider } from "../../auth/index.js";
import { authMiddleware } from "./auth-middleware.js";
import { interpretCommand } from "../../ai/command.js";
import {
  registerWebhook,
  removeWebhook,
  listWebhooks,
  getDeliveryLog,
} from "../../core/webhooks/index.js";
import {
  getEnabledFeatures,
  getLicenseInfo,
} from "../../core/licensing/index.js";
import { sendEmail } from "../../core/email/index.js";
import { uploadFile, getFileUrl, deleteFile } from "../../core/storage/index.js";
import { captureException } from "../../core/observability/index.js";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../core/notifications/index.js";
import { queryAuditLog } from "../../core/audit/query.js";
import { installEntity } from "../../ai/entity-installer.js";
import {
  createSession,
  listSessions,
  getSession,
  updateSessionTitle,
  deleteSession,
  createMessage,
  listMessages,
} from "../../ai/chat-store.js";

/**
 * UUID v4 format validation.
 * Returns 400 instead of letting invalid IDs reach the database layer
 * where they would cause a 500 error.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Fallback caller for when auth middleware is bypassed (e.g., DevAuthProvider).
 * Never used in production — the auth middleware always sets request.caller.
 */
const FALLBACK_CALLER: Caller = {
  userId: "anonymous",
  tenantId: "default",
  roles: [],
  type: "human",
};

/**
 * Get the authenticated caller from the request.
 * Falls back to FALLBACK_CALLER if auth middleware hasn't set a caller.
 */
function getCaller(request: FastifyRequest): Caller {
  return request.caller ?? FALLBACK_CALLER;
}

/**
 * Maps Action Bus error types to HTTP status codes.
 * Called after every entity CRUD dispatch to set the correct response status.
 *
 * If the action succeeded, sends 200 (or 404 if data is null for findById).
 * If it failed, the errorType determines the status:
 *   validation → 400, permission → 403, workflow → 422, not_found → 404, unknown → 500
 */
const ERROR_TYPE_TO_STATUS: Record<string, number> = {
  not_found: 404,
  validation: 400,
  permission: 403,
  workflow: 422,
  unknown: 500,
};

function sendResult(reply: FastifyReply, result: ActionResult): ActionResult {
  if (!result.success) {
    const status = ERROR_TYPE_TO_STATUS[result.errorType] ?? 500;
    reply.status(status);
  }
  return result;
}

/**
 * Registers all REST routes on the Fastify instance.
 */
export async function registerRESTRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------
  // Authentication middleware — runs before every request
  // ---------------------------------------------------------------
  app.addHook("preHandler", authMiddleware);

  // ---------------------------------------------------------------
  // Public endpoints (no auth required)
  // ---------------------------------------------------------------

  /** Auth configuration — tells the frontend how to authenticate */
  app.get("/api/auth/config", async () => {
    return getAuthProvider().getPublicConfig();
  });

  // ---------------------------------------------------------------
  // Meta endpoints (frontend reads these to render UI)
  // ---------------------------------------------------------------

  /** Returns all entity definitions — the frontend's source of truth */
  app.get("/api/meta/entities", async () => {
    return getAllEntities();
  });

  /** Returns a single entity definition by plural name */
  app.get<{ Params: { pluralName: string } }>(
    "/api/meta/entities/:pluralName",
    async (request, reply) => {
      const entity = getEntityByPlural(request.params.pluralName);
      if (!entity) {
        return reply.status(404).send({ error: "Entity not found" });
      }
      return entity;
    }
  );

  /** Returns all registered actions (for documentation and AI agents) */
  app.get("/api/meta/actions", async () => {
    return getAllActions().map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      idempotent: a.idempotent,
      affectsEntities: a.affectsEntities,
      examples: a.examples,
    }));
  });

  /**
   * Returns enabled features and license info.
   * The frontend uses this to show/hide gated UI (kanban, calendar, AI chat, etc.)
   */
  app.get("/api/meta/features", async () => {
    return {
      features: getEnabledFeatures(),
      license: getLicenseInfo(),
    };
  });

  // ---------------------------------------------------------------
  // Entity Installer — hot-install entities at runtime
  // ---------------------------------------------------------------

  /**
   * POST /api/entities/install — Install a new entity at runtime.
   * Accepts an EntityDefinition JSON, registers it in all subsystems,
   * creates the database table, and makes CRUD actions available immediately.
   */
  app.post("/api/entities/install", async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;

    if (!body || !body.name || !body.fields) {
      return reply.status(400).send({
        success: false,
        error: "Request body must be a valid EntityDefinition with at least 'name' and 'fields'.",
      });
    }

    try {
      const result = await installEntity(body as any);
      if (!result.success) {
        return reply.status(422).send({
          success: false,
          error: result.error,
          warnings: result.warnings,
        });
      }
      return reply.status(201).send({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(500).send({ success: false, error: message });
    }
  });

  // ---------------------------------------------------------------
  // AI Command — natural language → Action Bus dispatch
  // ---------------------------------------------------------------

  /**
   * Natural language command endpoint.
   * Accepts plain text, uses the AI Gateway to map intent to an action,
   * then dispatches through the Action Bus with full security checks.
   *
   * The AI only resolves intent — the Action Bus enforces permissions,
   * validation, and workflow rules identically to any other entry point.
   */
  app.post<{ Body: { text: string; history?: { role: string; content: string }[] } }>(
    "/api/ai/command",
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        text?: string;
        history?: { role: string; content: string }[];
      };

      if (!body.text || typeof body.text !== "string") {
        return reply.status(400).send({
          success: false,
          error: "Request body must include a 'text' field with the command.",
        });
      }

      // Length guard — prevent prompt injection via extremely long inputs
      if (body.text.length > 2000) {
        return reply.status(400).send({
          success: false,
          error: "Command text must be under 2000 characters.",
        });
      }

      // Sanitize history — only accept valid roles, limit to 10 messages
      const history = Array.isArray(body.history)
        ? body.history
            .filter(
              (m) =>
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string" &&
                m.content.length < 5000
            )
            .slice(-10)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        : undefined;

      const result = await interpretCommand(body.text, getCaller(request), history);
      const status = result.success ? 200 : 422;
      return reply.status(status).send(result);
    }
  );

  /**
   * Streaming AI command endpoint (Server-Sent Events).
   *
   * Same security as the non-streaming endpoint — the AI only resolves
   * intent, the Action Bus enforces everything.
   *
   * Event protocol:
   *   event: status   → data: "thinking" | "executing" | "done"
   *   event: text     → data: partial text chunk of the AI interpretation
   *   event: result   → data: JSON CommandResult object
   *   event: error    → data: error message string
   */
  app.post<{ Body: { text: string; history?: { role: string; content: string }[] } }>(
    "/api/ai/command/stream",
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        text?: string;
        history?: { role: string; content: string }[];
      };

      // Set SSE headers on the raw Node response
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": request.headers.origin ?? "*",
        "Access-Control-Allow-Credentials": "true",
      });

      /** Helper: write a single SSE event */
      const sendEvent = (event: string, data: string) => {
        reply.raw.write(`event: ${event}\ndata: ${data}\n\n`);
      };

      if (!body.text || typeof body.text !== "string") {
        sendEvent("error", "Request body must include a 'text' field.");
        reply.raw.end();
        return;
      }

      if (body.text.length > 2000) {
        sendEvent("error", "Command text must be under 2000 characters.");
        reply.raw.end();
        return;
      }

      // Sanitize history
      const history = Array.isArray(body.history)
        ? body.history
            .filter(
              (m) =>
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string" &&
                m.content.length < 5000
            )
            .slice(-10)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        : undefined;

      try {
        // Phase 1: Thinking
        sendEvent("status", "thinking");

        const result = await interpretCommand(body.text, getCaller(request), history);

        // Phase 2: Stream interpretation text character by character
        if (result.interpretation) {
          sendEvent("status", "interpreting");

          // Stream in small chunks for a natural typing effect
          const chars = result.interpretation;
          const chunkSize = 3;
          for (let i = 0; i < chars.length; i += chunkSize) {
            sendEvent("text", chars.slice(i, i + chunkSize));
          }
        }

        // Phase 3: Send the action execution status
        if (result.actionId) {
          sendEvent("status", "executing");
        }

        // Phase 4: Send full result
        sendEvent("result", JSON.stringify(result));
        sendEvent("status", "done");
      } catch (err) {
        sendEvent(
          "error",
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        reply.raw.end();
      }
    }
  );

  // ---------------------------------------------------------------
  // Chat persistence — session and message CRUD (requires AI_CHAT)
  // ---------------------------------------------------------------

  /** List chat sessions for the authenticated user */
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/api/chat/sessions",
    async (request, reply) => {
      try {
        const caller = getCaller(request);
        const limit = parseInt(request.query.limit ?? "20", 10);
        const offset = parseInt(request.query.offset ?? "0", 10);
        const sessions = await listSessions(caller.tenantId, caller.userId, limit, offset);
        return { success: true, data: sessions };
      } catch (err) {
        // Graceful degradation: if chat tables don't exist yet, return empty list
        const message = err instanceof Error ? err.message : "";
        if (message.includes("does not exist") || message.includes("relation")) {
          return { success: true, data: [] };
        }
        return reply.status(500).send({
          success: false,
          error: "Failed to load chat sessions. The server may need a restart to run migrations.",
        });
      }
    }
  );

  /** Create a new chat session */
  app.post("/api/chat/sessions", async (request, reply) => {
    try {
      const caller = getCaller(request);
      const body = (request.body ?? {}) as { title?: string };
      const session = await createSession({
        tenantId: caller.tenantId,
        userId: caller.userId,
        title: body.title,
      });
      return { success: true, data: session };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("does not exist") || message.includes("relation")) {
        return reply.status(503).send({
          success: false,
          error: "Chat persistence is not available. Please restart the API server to run migrations.",
        });
      }
      return reply.status(500).send({ success: false, error: "Failed to create session." });
    }
  });

  /** Get a specific session with its messages */
  app.get<{ Params: { sessionId: string } }>(
    "/api/chat/sessions/:sessionId",
    async (request, reply) => {
      try {
        const caller = getCaller(request);
        if (!isValidUUID(request.params.sessionId)) {
          return reply.status(400).send({ success: false, error: "Invalid session ID" });
        }
        const session = await getSession(request.params.sessionId, caller.tenantId);
        if (!session) {
          return reply.status(404).send({ success: false, error: "Session not found" });
        }
        const messages = await listMessages(request.params.sessionId);
        return { success: true, data: { ...session, messages } };
      } catch {
        return reply.status(500).send({ success: false, error: "Failed to load session." });
      }
    }
  );

  /** Update a session's title */
  app.patch<{ Params: { sessionId: string } }>(
    "/api/chat/sessions/:sessionId",
    async (request, reply) => {
      try {
        const caller = getCaller(request);
        if (!isValidUUID(request.params.sessionId)) {
          return reply.status(400).send({ success: false, error: "Invalid session ID" });
        }
        const body = (request.body ?? {}) as { title?: string };
        if (!body.title || typeof body.title !== "string") {
          return reply.status(400).send({ success: false, error: "Title is required" });
        }
        const session = await updateSessionTitle(
          request.params.sessionId,
          caller.tenantId,
          body.title
        );
        if (!session) {
          return reply.status(404).send({ success: false, error: "Session not found" });
        }
        return { success: true, data: session };
      } catch {
        return reply.status(500).send({ success: false, error: "Failed to update session." });
      }
    }
  );

  /** Delete a session and all its messages */
  app.delete<{ Params: { sessionId: string } }>(
    "/api/chat/sessions/:sessionId",
    async (request, reply) => {
      try {
        const caller = getCaller(request);
        if (!isValidUUID(request.params.sessionId)) {
          return reply.status(400).send({ success: false, error: "Invalid session ID" });
        }
        const deleted = await deleteSession(request.params.sessionId, caller.tenantId);
        if (!deleted) {
          return reply.status(404).send({ success: false, error: "Session not found" });
        }
        return { success: true };
      } catch {
        return reply.status(500).send({ success: false, error: "Failed to delete session." });
      }
    }
  );

  /** Add a message to a session */
  app.post<{ Params: { sessionId: string } }>(
    "/api/chat/sessions/:sessionId/messages",
    async (request, reply) => {
      try {
        const caller = getCaller(request);
        if (!isValidUUID(request.params.sessionId)) {
          return reply.status(400).send({ success: false, error: "Invalid session ID" });
        }

        // Verify the session belongs to the caller's tenant
        const session = await getSession(request.params.sessionId, caller.tenantId);
        if (!session) {
          return reply.status(404).send({ success: false, error: "Session not found" });
        }

        const body = (request.body ?? {}) as {
          role?: string;
          content?: string;
          actionId?: string;
          resultData?: unknown;
          isError?: boolean;
        };

        if (!body.role || !body.content) {
          return reply.status(400).send({
            success: false,
            error: "Message must include 'role' and 'content'.",
          });
        }

        if (body.role !== "user" && body.role !== "assistant") {
          return reply.status(400).send({
            success: false,
            error: "Role must be 'user' or 'assistant'.",
          });
        }

        const message = await createMessage({
          sessionId: request.params.sessionId,
          role: body.role,
          content: body.content,
          actionId: body.actionId,
          resultData: body.resultData,
          isError: body.isError,
        });

        return { success: true, data: message };
      } catch {
        return reply.status(500).send({ success: false, error: "Failed to save message." });
      }
    }
  );

  // ---------------------------------------------------------------
  // Generic action dispatch
  // ---------------------------------------------------------------

  /** Dispatch any action by ID */
  app.post<{ Params: { actionId: string } }>(
    "/api/actions/:actionId",
    async (request, reply) => {
      // Validate action ID format: must be alphanumeric with dots (e.g., "contact.create")
      if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(request.params.actionId)) {
        return reply.status(400).send({
          success: false,
          error: "Invalid action ID format",
        });
      }

      const result = await dispatch(
        request.params.actionId,
        request.body,
        getCaller(request)
      );

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return result;
    }
  );

  // ---------------------------------------------------------------
  // RESTful entity routes (generated from entity registry)
  // ---------------------------------------------------------------

  for (const entity of getAllEntities()) {
    const basePath = `/api/${entity.pluralName.toLowerCase()}`;
    const entityLower = entity.name.toLowerCase();

    /**
     * Whitelist of field names allowed as query parameter filters.
     * Only fields declared in the EntityDefinition are accepted.
     * This prevents attackers from probing system columns (id, created_at)
     * or guessing internal column names.
     */
    const allowedFilterFields = new Set(entity.fields.map((f) => f.name));
    // Also allow filtering by FK fields derived from belongsTo relationships
    for (const rel of entity.relationships ?? []) {
      if (rel.type === "belongsTo") {
        const fk = rel.foreignKey
          ? rel.foreignKey.replace(/_([a-z])/g, (_: string, l: string) => l.toUpperCase())
          : rel.entity.charAt(0).toLowerCase() + rel.entity.slice(1) + "Id";
        allowedFilterFields.add(fk);
      }
    }

    /** GET /api/contacts — List all */
    app.get<{ Querystring: Record<string, string> }>(
      basePath,
      async (request, reply) => {
        const { limit, offset, orderBy, direction, search, ...filters } =
          request.query;

        const input: Record<string, unknown> = {};

        // Only accept filter fields declared in the entity definition
        if (Object.keys(filters).length > 0) {
          const safeFilters: Record<string, string> = {};
          const rejected: string[] = [];

          for (const [key, value] of Object.entries(filters)) {
            if (allowedFilterFields.has(key)) {
              safeFilters[key] = value;
            } else {
              rejected.push(key);
            }
          }

          // Reject the request if unknown filter fields were provided
          if (rejected.length > 0) {
            return reply.status(400).send({
              success: false,
              error: `Unknown filter fields: ${rejected.join(", ")}`,
              details: {
                allowedFields: Array.from(allowedFilterFields),
              },
            });
          }

          if (Object.keys(safeFilters).length > 0) {
            input.where = safeFilters;
          }
        }

        // Validate orderBy against allowed fields
        if (orderBy) {
          if (!allowedFilterFields.has(orderBy)) {
            return reply.status(400).send({
              success: false,
              error: `Unknown orderBy field: "${orderBy}"`,
              details: {
                allowedFields: Array.from(allowedFilterFields),
              },
            });
          }
          input.orderBy = {
            field: orderBy,
            direction: direction ?? "asc",
          };
        }

        if (limit) input.limit = parseInt(limit, 10);
        if (offset) input.offset = parseInt(offset, 10);

        // Text search across entity's declared searchFields
        if (search && entity.ui.searchFields.length > 0) {
          input.search = { term: search, fields: entity.ui.searchFields };
        }

        const result = await dispatch(`${entityLower}.findAll`, input, getCaller(request));
        return sendResult(reply, result);
      }
    );

    /** GET /api/contacts/:id — Get one */
    app.get<{ Params: { id: string } }>(
      `${basePath}/:id`,
      async (request, reply) => {
        if (!isValidUUID(request.params.id)) {
          return reply.status(400).send({
            success: false,
            error: "Invalid ID format — must be a valid UUID",
          });
        }
        const result = await dispatch(
          `${entityLower}.findById`,
          { id: request.params.id },
          getCaller(request)
        );
        // findById returns { success: true, data: null } for missing records
        if (result.success && result.data === null) {
          return reply.status(404).send({
            success: false,
            error: `${entity.name} not found`,
            errorType: "not_found",
          });
        }
        return sendResult(reply, result);
      }
    );

    /** POST /api/contacts — Create */
    app.post(basePath, async (request, reply) => {
      const result = await dispatch(
        `${entityLower}.create`,
        request.body,
        getCaller(request)
      );
      return sendResult(reply, result);
    });

    /** PATCH /api/contacts/:id — Update */
    app.patch<{ Params: { id: string } }>(
      `${basePath}/:id`,
      async (request, reply) => {
        if (!isValidUUID(request.params.id)) {
          return reply.status(400).send({
            success: false,
            error: "Invalid ID format — must be a valid UUID",
          });
        }
        const result = await dispatch(
          `${entityLower}.update`,
          { id: request.params.id, data: request.body },
          getCaller(request)
        );
        return sendResult(reply, result);
      }
    );

    /** DELETE /api/contacts/:id — Delete */
    app.delete<{ Params: { id: string } }>(
      `${basePath}/:id`,
      async (request, reply) => {
        if (!isValidUUID(request.params.id)) {
          return reply.status(400).send({
            success: false,
            error: "Invalid ID format — must be a valid UUID",
          });
        }
        const result = await dispatch(
          `${entityLower}.delete`,
          { id: request.params.id },
          getCaller(request)
        );
        return sendResult(reply, result);
      }
    );

    /**
     * GET /api/contacts/:id/transitions — Valid workflow transitions
     *
     * Returns the allowed next states for each workflow field on this
     * record. The frontend uses this to render transition buttons
     * and constrain status dropdowns to only valid options.
     *
     * Response shape:
     *   { success: true, data: { status: ["in_progress", "review"] } }
     *
     * Returns an empty object when the entity has no workflows.
     */
    if (entity.workflows?.length) {
      app.get<{ Params: { id: string } }>(
        `${basePath}/:id/transitions`,
        async (request, reply) => {
          if (!isValidUUID(request.params.id)) {
            return reply.status(400).send({
              success: false,
              error: "Invalid ID format — must be a valid UUID",
            });
          }

          // Load the current record to read its workflow field values
          const result = await dispatch(
            `${entityLower}.findById`,
            { id: request.params.id },
            getCaller(request)
          );

          if (!result.success || result.data === null) {
            return reply.status(404).send({
              success: false,
              error: `${entity.name} not found`,
            });
          }

          const record = result.data as Record<string, unknown>;
          const transitions: Record<string, string[]> = {};

          for (const wf of entity.workflows!) {
            const currentState = record[wf.field] as string | undefined;
            if (currentState) {
              transitions[wf.field] = wf.transitions
                .filter((t) => t.from === currentState)
                .map((t) => t.to);
            }
          }

          return { success: true, data: transitions };
        }
      );
    }
  }

  // ---------------------------------------------------------------
  // Webhook Management Routes (requires WEBHOOKS feature)
  // ---------------------------------------------------------------

  // ---------------------------------------------------------------
  // File Storage Routes
  // ---------------------------------------------------------------

  /** POST /api/files/upload — Upload a file (multipart or base64 JSON) */
  app.post("/api/files/upload", async (request, reply) => {
    const body = (request.body ?? {}) as {
      key?: string;
      content?: string;
      contentType?: string;
    };

    if (!body.key || !body.content || !body.contentType) {
      return reply.status(400).send({
        success: false,
        error: "key, content (base64), and contentType are required",
      });
    }

    // Sanitize key — prevent path traversal
    const sanitizedKey = body.key.replace(/\.\./g, "").replace(/^\//, "");
    if (!sanitizedKey) {
      return reply.status(400).send({
        success: false,
        error: "Invalid file key",
      });
    }

    const buffer = Buffer.from(body.content, "base64");
    const result = await uploadFile({
      key: sanitizedKey,
      body: buffer,
      contentType: body.contentType,
    });

    if (!result.success) {
      return reply.status(500).send({ success: false, error: result.error });
    }

    return reply.status(201).send({ success: true, data: result });
  });

  /** GET /api/files/:key — Get file URL (redirect or return URL) */
  app.get<{ Params: { "*": string } }>(
    "/api/files/*",
    async (request, reply) => {
      const key = request.params["*"];
      if (!key) {
        return reply.status(400).send({ success: false, error: "File key is required" });
      }

      const url = await getFileUrl(key);
      return { success: true, data: { key, url } };
    }
  );

  /** DELETE /api/files/:key — Delete a file */
  app.delete<{ Params: { "*": string } }>(
    "/api/files/*",
    async (request, reply) => {
      const key = request.params["*"];
      if (!key) {
        return reply.status(400).send({ success: false, error: "File key is required" });
      }

      const deleted = await deleteFile(key);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: "File not found" });
      }

      return { success: true };
    }
  );

  // ---------------------------------------------------------------
  // Email — test endpoint (admin only, for verifying email config)
  // ---------------------------------------------------------------

  /** POST /api/email/send — Send a test email */
  app.post<{ Body: { to: string; subject: string; html: string } }>(
    "/api/email/send",
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        to?: string;
        subject?: string;
        html?: string;
      };

      if (!body.to || !body.subject || !body.html) {
        return reply.status(400).send({
          success: false,
          error: "to, subject, and html are required",
        });
      }

      const result = await sendEmail({
        to: body.to,
        subject: body.subject,
        html: body.html,
      });

      return { success: result.success, data: result };
    }
  );

  // ---------------------------------------------------------------
  // Webhook Management Routes
  // ---------------------------------------------------------------

  /** GET /api/webhooks — List registered webhooks for this tenant */
  app.get("/api/webhooks", async (request, reply) => {
    const caller = getCaller(request);
    return { success: true, data: await listWebhooks(caller.tenantId) };
  });

  /** POST /api/webhooks — Register a new webhook */
  app.post<{ Body: { eventType: string; url: string; secret?: string } }>(
    "/api/webhooks",
    async (request, reply) => {
      const caller = getCaller(request);
      const { eventType, url, secret } = request.body ?? {} as Record<string, unknown>;

      if (!eventType || !url) {
        return reply.status(400).send({
          success: false,
          error: "eventType and url are required",
        });
      }

      try {
        new URL(url as string);
      } catch {
        return reply.status(400).send({
          success: false,
          error: "url must be a valid URL",
        });
      }

      const webhook = await registerWebhook({
        eventType: eventType as string,
        url: url as string,
        secret: secret as string | undefined,
        active: true,
        tenantId: caller.tenantId,
      });

      return reply.status(201).send({ success: true, data: webhook });
    }
  );

  /** DELETE /api/webhooks/:id — Remove a webhook */
  app.delete<{ Params: { id: string } }>(
    "/api/webhooks/:id",
    async (request, reply) => {
      const removed = await removeWebhook(request.params.id);
      if (!removed) {
        return reply.status(404).send({ success: false, error: "Webhook not found" });
      }
      return { success: true };
    }
  );

  /** GET /api/webhooks/:id/deliveries — Delivery log for a webhook */
  app.get<{ Params: { id: string } }>(
    "/api/webhooks/:id/deliveries",
    async (request) => {
      return { success: true, data: await getDeliveryLog(request.params.id) };
    }
  );

  // ---------------------------------------------------------------
  // Notifications — in-app notification center
  // ---------------------------------------------------------------

  app.get("/api/notifications", async (request) => {
    const caller = getCaller(request);
    const query = request.query as {
      limit?: string;
      offset?: string;
      unreadOnly?: string;
    };

    const result = await getNotifications(caller.tenantId, caller.userId, {
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
      unreadOnly: query.unreadOnly === "true",
    });

    return { success: true, data: result };
  });

  app.patch<{ Params: { id: string } }>(
    "/api/notifications/:id/read",
    async (request) => {
      const caller = getCaller(request);
      const marked = await markNotificationRead(request.params.id, caller.tenantId);
      return { success: true, data: { marked } };
    }
  );

  app.patch("/api/notifications/read-all", async (request) => {
    const caller = getCaller(request);
    const count = await markAllNotificationsRead(caller.tenantId, caller.userId);
    return { success: true, data: { count } };
  });

  // ---------------------------------------------------------------
  // Audit Log — activity feed
  // ---------------------------------------------------------------

  app.get("/api/audit-log", async (request) => {
    const caller = getCaller(request);
    const query = request.query as {
      entity?: string;
      userId?: string;
      actionId?: string;
      success?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: string;
      offset?: string;
    };

    const result = await queryAuditLog({
      tenantId: caller.tenantId,
      entity: query.entity || undefined,
      userId: query.userId || undefined,
      actionId: query.actionId || undefined,
      success: query.success === "true" ? true : query.success === "false" ? false : undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return { success: true, data: result };
  });

  // ---------------------------------------------------------------
  // Observability — frontend error capture (public, no auth)
  // ---------------------------------------------------------------

  app.post("/api/observability/capture", async (request, reply) => {
    const body = (request.body ?? {}) as {
      message?: string;
      stack?: string;
      componentStack?: string;
      url?: string;
    };

    if (!body.message) {
      return reply.status(400).send({ success: false, error: "message is required" });
    }

    const error = new Error(body.message);
    if (body.stack) error.stack = body.stack;

    captureException(error, {
      source: "frontend",
      componentStack: body.componentStack,
      pageUrl: body.url,
    });

    return { success: true };
  });

  // ---------------------------------------------------------------
  // Global Fastify error handler — captures unhandled route errors
  // ---------------------------------------------------------------

  app.setErrorHandler(async (error, request, reply) => {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      url: request.url,
      method: request.method,
      userId: request.caller?.userId,
      tenantId: request.caller?.tenantId,
    });

    reply.status(500).send({
      success: false,
      error: "An unexpected error occurred",
    });
  });
}
