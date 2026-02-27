/**
 * API Client
 *
 * Typed fetch wrapper for communicating with the MetaSAAS backend.
 * All data flows through this client — no direct fetch() calls in components.
 *
 * Authentication:
 *   Call setTokenProvider() with a function that returns the current JWT.
 *   The token is automatically attached as a Bearer header on every request.
 *   When no provider is set (dev mode), requests are sent without a token.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Token provider function — returns the current JWT or null.
 * Set via setTokenProvider() from the auth context.
 */
let tokenProvider: (() => string | null) | null = null;

/**
 * Register a function that returns the current auth token.
 * Called once from the AuthProvider when it mounts.
 */
export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

/**
 * Generic API response from the Action Bus.
 */
interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

/**
 * Makes a typed request to the API.
 * Automatically attaches the Bearer token if a token provider is registered.
 */
async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;

  // Build headers — attach Bearer token when available
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = tokenProvider?.();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
    ...options,
  });

  if (!res.ok) {
    // Handle expired or invalid JWT tokens.
    // A 401 means the token is no longer valid — redirect to login
    // so the user can re-authenticate. This covers token expiry,
    // revocation, and malformed tokens.
    if (res.status === 401 && typeof window !== "undefined") {
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    const body = await res.json().catch(() => null);
    const message = body?.error ?? body?.message ?? `Request failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

// ---------------------------------------------------------------
// File Storage
// ---------------------------------------------------------------

/** Upload a file to storage. Returns the stored file key. */
export async function uploadFile(
  key: string,
  file: File
): Promise<{ key: string; url: string }> {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
  );

  const res: ActionResponse<{ key: string; url: string }> = await request(
    "/api/files/upload",
    {
      method: "POST",
      body: JSON.stringify({ key, content: base64, contentType: file.type }),
    }
  );

  if (!res.success || !res.data) {
    throw new Error(res.error ?? "File upload failed");
  }
  return res.data;
}

// ---------------------------------------------------------------
// Entity CRUD operations (consume the RESTful entity routes)
// ---------------------------------------------------------------

/** Fetch all records for an entity */
export async function fetchEntityList(
  pluralName: string,
  params?: Record<string, string>
): Promise<ActionResponse<{ data: Record<string, unknown>[]; total: number }>> {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/api/${pluralName}${query}`);
}

/** Fetch a single record by ID */
export async function fetchEntityById(
  pluralName: string,
  id: string
): Promise<ActionResponse<Record<string, unknown>>> {
  return request(`/api/${pluralName}/${id}`);
}

/** Create a new record */
export async function createEntity(
  pluralName: string,
  data: Record<string, unknown>
): Promise<ActionResponse<Record<string, unknown>>> {
  return request(`/api/${pluralName}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an existing record */
export async function updateEntity(
  pluralName: string,
  id: string,
  data: Record<string, unknown>
): Promise<ActionResponse<Record<string, unknown>>> {
  return request(`/api/${pluralName}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Delete a record */
export async function deleteEntity(
  pluralName: string,
  id: string
): Promise<ActionResponse<{ success: boolean }>> {
  return request(`/api/${pluralName}/${id}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------

/**
 * Fetch valid next states for each workflow field on a record.
 * Returns a map of field name → allowed next state values.
 * Empty object when the entity has no workflows.
 */
export async function fetchTransitions(
  pluralName: string,
  id: string
): Promise<Record<string, string[]>> {
  const res: ActionResponse<Record<string, string[]>> = await request(
    `/api/${pluralName}/${id}/transitions`
  );
  return res.data ?? {};
}

// ---------------------------------------------------------------
// AI Command (natural language → action dispatch)
// ---------------------------------------------------------------

/**
 * Result from the AI command interpreter.
 */
export interface CommandResult {
  success: boolean;
  actionId?: string;
  interpretation?: string;
  data?: unknown;
  error?: string;
}

/**
 * A chat message for multi-turn conversation context.
 */
export interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

/**
 * Send a natural language command to the AI interpreter.
 * The backend maps the text to an action and dispatches it
 * through the Action Bus with full security checks.
 *
 * @param text    - The user's natural language command
 * @param history - Previous conversation messages for multi-turn context
 */
export async function sendCommand(
  text: string,
  history?: ChatMessagePayload[]
): Promise<CommandResult> {
  return request("/api/ai/command", {
    method: "POST",
    body: JSON.stringify({ text, history }),
  });
}

/**
 * Callbacks for streaming AI command events.
 * Each event type maps to an optional handler function.
 */
export interface StreamCallbacks {
  /** Fires when the AI status changes (thinking → interpreting → executing → done) */
  onStatus?: (status: string) => void;
  /** Fires for each chunk of the AI's interpretation text */
  onText?: (chunk: string) => void;
  /** Fires when the final result is available */
  onResult?: (result: CommandResult) => void;
  /** Fires on errors */
  onError?: (error: string) => void;
}

/**
 * Send a natural language command using the streaming SSE endpoint.
 * Provides real-time progress updates as the AI processes the command.
 *
 * The protocol uses Server-Sent Events:
 *   - event: status → progress indicator (thinking, interpreting, executing, done)
 *   - event: text   → incremental interpretation text
 *   - event: result → final CommandResult JSON
 *   - event: error  → error message
 */
// ---------------------------------------------------------------------------
// Chat Session API — persistent conversation history
// ---------------------------------------------------------------------------

/** Chat session from the API */
export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Chat message from the API */
export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  actionId: string | null;
  resultData: unknown | null;
  isError: boolean;
  createdAt: string;
}

/** List chat sessions for the authenticated user */
export async function listChatSessions(): Promise<ChatSession[]> {
  const res: ActionResponse<ChatSession[]> = await request("/api/chat/sessions");
  return res.data ?? [];
}

/** Create a new chat session */
export async function createChatSession(title?: string): Promise<ChatSession> {
  const res: ActionResponse<ChatSession> = await request("/api/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return res.data as ChatSession;
}

/** Get a session with its messages */
export async function getChatSession(
  sessionId: string
): Promise<ChatSession & { messages: ChatMessageRecord[] }> {
  const res: ActionResponse<ChatSession & { messages: ChatMessageRecord[] }> =
    await request(`/api/chat/sessions/${sessionId}`);
  return res.data as ChatSession & { messages: ChatMessageRecord[] };
}

/** Update a session's title */
export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<ChatSession> {
  const res: ActionResponse<ChatSession> = await request(
    `/api/chat/sessions/${sessionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }
  );
  return res.data as ChatSession;
}

/** Delete a chat session */
export async function deleteChatSession(sessionId: string): Promise<void> {
  await request(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
}

/** Save a message to a session */
export async function saveChatMessage(
  sessionId: string,
  message: {
    role: "user" | "assistant";
    content: string;
    actionId?: string;
    resultData?: unknown;
    isError?: boolean;
  }
): Promise<ChatMessageRecord> {
  const res: ActionResponse<ChatMessageRecord> = await request(
    `/api/chat/sessions/${sessionId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(message),
    }
  );
  return res.data as ChatMessageRecord;
}

// ---------------------------------------------------------------------------
// Streaming AI Command
// ---------------------------------------------------------------------------

export async function sendCommandStream(
  text: string,
  callbacks: StreamCallbacks,
  history?: ChatMessagePayload[]
): Promise<void> {
  const token = tokenProvider?.();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/ai/command/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, history }),
  });

  if (!res.ok || !res.body) {
    // Redirect to login on expired token (same as the standard request handler)
    if (res.status === 401 && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    callbacks.onError?.(`Request failed: ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from the buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    let currentData = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7);
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6);
      } else if (line === "") {
        // Empty line = end of event
        if (currentEvent && currentData) {
          switch (currentEvent) {
            case "status":
              callbacks.onStatus?.(currentData);
              break;
            case "text":
              callbacks.onText?.(currentData);
              break;
            case "result":
              try {
                callbacks.onResult?.(JSON.parse(currentData) as CommandResult);
              } catch {
                callbacks.onError?.("Failed to parse result");
              }
              break;
            case "error":
              callbacks.onError?.(currentData);
              break;
          }
        }
        currentEvent = "";
        currentData = "";
      }
    }
  }
}

// ---------------------------------------------------------------
// Metadata operations (entity definitions for rendering)
// ---------------------------------------------------------------

/** Fetch all entity definitions */
export async function fetchAllEntityMeta(): Promise<
  import("@metasaas/contracts").EntityDefinition[]
> {
  return request("/api/meta/entities");
}

/** Fetch a single entity definition by plural name */
export async function fetchEntityMeta(
  pluralName: string
): Promise<import("@metasaas/contracts").EntityDefinition> {
  return request(`/api/meta/entities/${pluralName}`);
}

// ---------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------

export interface NotificationData {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationData[];
  total: number;
  unread: number;
}

/** Fetch notifications for the current user */
export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<NotificationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.unreadOnly) searchParams.set("unreadOnly", "true");
  const qs = searchParams.toString();
  const res = await request<{ data: NotificationListResponse }>(`/api/notifications${qs ? `?${qs}` : ""}`);
  return res.data;
}

/** Mark a single notification as read */
export async function markNotificationReadApi(id: string): Promise<void> {
  await request(`/api/notifications/${id}/read`, { method: "PATCH" });
}

/** Mark all notifications as read */
export async function markAllNotificationsReadApi(): Promise<void> {
  await request("/api/notifications/read-all", { method: "PATCH" });
}

// ---------------------------------------------------------------
// Audit Log / Activity Feed
// ---------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  actionId: string;
  success: boolean;
  durationMs: number;
  input: unknown;
  error: string | null;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
}

/** Fetch audit log entries with optional filters */
export async function fetchAuditLog(params?: {
  entity?: string;
  userId?: string;
  success?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogResponse> {
  const searchParams = new URLSearchParams();
  if (params?.entity) searchParams.set("entity", params.entity);
  if (params?.userId) searchParams.set("userId", params.userId);
  if (params?.success) searchParams.set("success", params.success);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  const res = await request<{ data: AuditLogResponse }>(`/api/audit-log${qs ? `?${qs}` : ""}`);
  return res.data;
}

// ---------------------------------------------------------------
// Billing
// ---------------------------------------------------------------

export interface SubscriptionData {
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  planId: string;
  planName: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceData {
  id: string;
  tenantId: string;
  stripeInvoiceId: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  createdAt: string;
}

export interface PlanData {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: "month" | "year" | "one_time";
  stripePriceId: string | null;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
}

/** Fetch all active plans (public, no auth required) */
export async function fetchPlans(): Promise<PlanData[]> {
  const res: ActionResponse<PlanData[]> = await request("/api/billing/plans");
  return res.data ?? [];
}

/** Create a Stripe Checkout session for a specific plan */
export async function createCheckout(params: {
  planId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  const res: ActionResponse<{ url: string; sessionId: string }> = await request(
    "/api/billing/checkout",
    { method: "POST", body: JSON.stringify(params) }
  );
  return res.data!;
}

/** Get the current subscription for the tenant */
export async function fetchSubscription(): Promise<SubscriptionData | null> {
  const res: ActionResponse<SubscriptionData | null> = await request("/api/billing/subscription");
  return res.data ?? null;
}

/** Cancel subscription at period end */
export async function cancelSubscription(): Promise<boolean> {
  const res: ActionResponse<{ canceled: boolean }> = await request(
    "/api/billing/cancel",
    { method: "POST" }
  );
  return res.data?.canceled ?? false;
}

/** Create a Stripe Customer Portal session */
export async function createPortalSession(): Promise<{ url: string }> {
  const res: ActionResponse<{ url: string }> = await request(
    "/api/billing/portal",
    { method: "POST" }
  );
  return res.data!;
}

/** Fetch invoice history */
export async function fetchInvoices(): Promise<InvoiceData[]> {
  const res: ActionResponse<InvoiceData[]> = await request("/api/billing/invoices");
  return res.data ?? [];
}
