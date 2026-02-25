"use client";

/**
 * AI Chat Sidebar — Persistent, context-aware AI interface
 *
 * Phase 4 + Phase 5 implementation:
 *   - Persistent right panel (replaces Cmd+K popup)
 *   - Multi-turn conversation context (last 10 messages)
 *   - Streaming responses via SSE (real-time progress)
 *   - Database-backed persistence (chat_sessions + chat_messages)
 *   - Session history list (switch between conversations)
 *   - localStorage fallback when DB unavailable
 *
 * Toggle: Cmd+K (Mac) / Ctrl+K (Windows/Linux) or sidebar button
 *
 * Security: The AI only maps intent — the Action Bus enforces all
 * permissions, validation, and workflow rules identically to any
 * other entry point.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  sendCommandStream,
  listChatSessions,
  createChatSession,
  getChatSession,
  deleteChatSession,
  saveChatMessage,
  type CommandResult,
  type ChatMessagePayload,
  type ChatSession,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single message in the chat history */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionId?: string;
  data?: unknown;
  error?: boolean;
  timestamp: number;
}

/** View state for the sidebar */
type SidebarView = "chat" | "history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toHistoryPayload(messages: ChatMessage[]): ChatMessagePayload[] {
  return messages
    .filter((m) => m.content.trim().length > 0) // skip empty placeholders
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Formats the raw action result data into a human-readable summary.
 * The data shape depends on the action type:
 *   - findAll: { data: [...], total: N }
 *   - findById: a single record object
 *   - create/update: the created/updated record
 *   - delete: { id: "..." }
 *
 * Returns a readable string that replaces the raw JSON blob.
 */
function formatResultSummary(
  actionId: string | undefined,
  data: unknown
): string {
  if (!data || !actionId) return "";

  const record = data as Record<string, unknown>;

  // --- List/findAll results ---
  if (actionId.endsWith(".findAll") && record.data && Array.isArray(record.data)) {
    const items = record.data as Record<string, unknown>[];
    const total = (record.total as number) ?? items.length;

    if (items.length === 0) {
      return "No records found.";
    }

    // Extract the entity name from the action ID (e.g., "company" from "company.findAll")
    const entity = actionId.split(".")[0];
    const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);

    // Build a summary table from the first visible field of each record
    const fieldNames = Object.keys(items[0]).filter(
      (k) => !["id", "tenantId", "createdAt", "updatedAt"].includes(k)
    );
    const nameField = fieldNames.find((f) =>
      ["name", "title", "firstName", "email", "subject"].includes(f)
    ) ?? fieldNames[0];

    const lines = items.slice(0, 10).map((item, i) => {
      const label = nameField ? String(item[nameField] ?? "—") : `${entityLabel} ${i + 1}`;
      return `  ${i + 1}. ${label}`;
    });

    // Simple English pluralization: company → companies, task → tasks, etc.
    const plural =
      total === 1
        ? entity
        : entity.endsWith("y")
          ? entity.slice(0, -1) + "ies"
          : entity.endsWith("s") || entity.endsWith("x") || entity.endsWith("ch") || entity.endsWith("sh")
            ? entity + "es"
            : entity + "s";
    let summary = `Found ${total} ${plural}:\n${lines.join("\n")}`;
    if (total > 10) {
      summary += `\n  ... and ${total - 10} more`;
    }
    return summary;
  }

  // --- Single record (findById, create, update) ---
  if (record.id && typeof record.id === "string") {
    const fieldNames = Object.keys(record).filter(
      (k) => !["id", "tenantId", "createdAt", "updatedAt"].includes(k)
    );
    const nameField = fieldNames.find((f) =>
      ["name", "title", "firstName", "email", "subject"].includes(f)
    );

    if (actionId.endsWith(".create")) {
      const label = nameField ? ` "${record[nameField]}"` : "";
      return `Created successfully${label}.`;
    }
    if (actionId.endsWith(".update")) {
      const label = nameField ? ` "${record[nameField]}"` : "";
      return `Updated successfully${label}.`;
    }
    if (actionId.endsWith(".delete")) {
      return "Deleted successfully.";
    }
    if (actionId.endsWith(".findById")) {
      const label = nameField ? String(record[nameField]) : "Record";
      const details = fieldNames
        .slice(0, 5)
        .filter((f) => record[f] != null && record[f] !== "")
        .map((f) => `  ${f}: ${String(record[f])}`)
        .join("\n");
      return `${label}:\n${details}`;
    }
  }

  return "";
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatSidebar() {
  // Panel state
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SidebarView>("chat");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref that always points to the latest messages array.
  // Avoids stale-closure bugs in useCallback where the captured
  // `messages` value may lag behind the actual React state.
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Prevents double-submit during rapid clicks or key repeats
  const isSubmittingRef = useRef(false);

  // ------- Load sessions on first open -------
  useEffect(() => {
    if (open && sessions.length === 0) {
      loadSessions();
    }
  }, [open, sessions.length]);

  // ------- Scroll to bottom on new messages -------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ------- Focus input when sidebar opens or switches to chat -------
  useEffect(() => {
    if (open && view === "chat") {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, view]);

  // ------- Keyboard shortcut: Cmd+K / Ctrl+K -------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // ------- Session Management -------

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await listChatSessions();
      setSessions(list);
    } catch {
      /* Silently degrade — sessions list is non-critical */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /** Start a new conversation — creates a session in the DB */
  const startNewSession = useCallback(async () => {
    setMessages([]);
    setActiveSessionId(null);
    setView("chat");
    inputRef.current?.focus();
  }, []);

  /** Load an existing session from the DB */
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const data = await getChatSession(sessionId);
      setActiveSessionId(sessionId);
      setMessages(
        (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          actionId: m.actionId ?? undefined,
          data: m.resultData ?? undefined,
          error: m.isError,
          timestamp: new Date(m.createdAt).getTime(),
        }))
      );
      setView("chat");
    } catch {
      /* Session may have been deleted */
    }
  }, []);

  /** Delete a session */
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteChatSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
      } catch {
        /* Silently degrade */
      }
    },
    [activeSessionId]
  );

  // ------- Persist message to DB (fire-and-forget) -------
  const persistMessage = useCallback(
    async (
      sessionId: string,
      msg: { role: "user" | "assistant"; content: string; actionId?: string; resultData?: unknown; isError?: boolean }
    ) => {
      try {
        await saveChatMessage(sessionId, msg);
      } catch {
        /* DB persistence failure is non-critical — messages are in React state */
      }
    },
    []
  );

  // ------- Submit a message -------
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || loading) return;

      // Prevent double-submit from rapid clicks or key repeats
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      setInput("");
      setLoading(true);
      setStatus("thinking");

      // Ensure we have a session
      let sessionId = activeSessionId;
      if (!sessionId) {
        try {
          const title = trimmed.slice(0, 60);
          const session = await createChatSession(title);
          sessionId = session.id;
          setActiveSessionId(sessionId);
          setSessions((prev) => [session, ...prev]);
        } catch {
          /* If session creation fails, continue without persistence */
        }
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Persist user message
      if (sessionId) {
        persistMessage(sessionId, { role: "user", content: trimmed });
      }

      // Create placeholder for assistant response
      const assistantId = generateId();
      let streamedText = "";
      let finalResult: CommandResult | null = null;

      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, placeholder]);

      try {
        // Read latest messages from ref, not the stale closure value.
        // This guarantees the AI receives the full conversation context
        // even when the user submits quickly after a streaming response.
        const history = toHistoryPayload(messagesRef.current);

        await sendCommandStream(
          trimmed,
          {
            onStatus(s) {
              setStatus(s);
            },
            onText(chunk) {
              streamedText += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: streamedText } : m
                )
              );
            },
            onResult(result) {
              finalResult = result;

              // Build the user-facing message — plain English only
              let content = streamedText || result.interpretation || "";

              if (result.success && result.data) {
                // Format the result data into a readable summary
                const summary = formatResultSummary(result.actionId, result.data);
                if (summary) {
                  content += content ? "\n\n" : "";
                  content += summary;
                }
              }

              if (!result.success && result.error) {
                content = result.error;
              }

              if (!content) {
                content = result.success
                  ? "Done."
                  : "Something went wrong. Please try again.";
              }

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content,
                        actionId: result.actionId,
                        data: result.data,
                        error: !result.success,
                      }
                    : m
                )
              );

              // Persist assistant message
              if (sessionId) {
                persistMessage(sessionId, {
                  role: "assistant",
                  content,
                  actionId: result.actionId,
                  resultData: result.data,
                  isError: !result.success,
                });
              }
            },
            onError(error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: error, error: true }
                    : m
                )
              );
              if (sessionId) {
                persistMessage(sessionId, {
                  role: "assistant",
                  content: error,
                  isError: true,
                });
              }
            },
          },
          history
        );

        if (!finalResult && !streamedText) {
          const fallbackMsg = "No response received. Please try again.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: fallbackMsg, error: true }
                : m
            )
          );
        }
      } catch (err) {
        const errorContent =
          err instanceof Error ? err.message : "Failed to send command.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errorContent, error: true }
              : m
          )
        );
      } finally {
        setLoading(false);
        setStatus("");
        isSubmittingRef.current = false;
      }
    },
    [input, loading, activeSessionId, persistMessage]
  );

  // ------- Render -------

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-40",
          "w-[380px] border-l border-border bg-background",
          "flex flex-col shadow-xl",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            <span className="text-sm font-semibold">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            {/* History toggle */}
            <button
              type="button"
              onClick={() => {
                if (view === "history") {
                  setView("chat");
                } else {
                  setView("history");
                  loadSessions();
                }
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                view === "history"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Chat history"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </button>

            {/* New chat */}
            <button
              type="button"
              onClick={startNewSession}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="New conversation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Close (Esc)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ============ HISTORY VIEW ============ */}
        {view === "history" && (
          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-xs text-muted-foreground">
                  Loading sessions...
                </span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <p className="text-sm text-muted-foreground mb-3">
                  No conversations yet
                </p>
                <button
                  type="button"
                  onClick={startNewSession}
                  className="text-sm text-primary hover:underline"
                >
                  Start a new conversation
                </button>
              </div>
            ) : (
              <div className="py-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex items-center gap-2 px-4 py-3 cursor-pointer",
                      "hover:bg-muted/50 transition-colors",
                      session.id === activeSessionId &&
                        "bg-primary/5 border-l-2 border-primary"
                    )}
                    onClick={() => loadSession(session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.title || "Untitled conversation"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSessionDate(session.updatedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                      title="Delete"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ CHAT VIEW ============ */}
        {view === "chat" && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Empty state */}
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                    >
                      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium mb-2">AI Assistant</h3>
                  <p className="text-xs text-muted-foreground mb-6 max-w-[260px]">
                    Use natural language to interact with your data. Commands
                    are dispatched through the Action Bus with full security.
                  </p>
                  <div className="w-full space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">
                      Try
                    </p>
                    {[
                      "Create a task called Fix login bug with high priority",
                      "List all active contacts",
                      "Show me all companies",
                    ].map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        className="w-full text-left rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={() => {
                          setInput(hint);
                          inputRef.current?.focus();
                        }}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : msg.error
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-muted text-foreground"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content.split("`").map((segment, i) =>
                        i % 2 === 1 ? (
                          <code
                            key={i}
                            className="bg-foreground/10 rounded px-1 py-0.5 text-xs font-mono"
                          >
                            {segment}
                          </code>
                        ) : (
                          <span key={i}>{segment}</span>
                        )
                      )}
                    </div>

                    {msg.data != null && (
                      <details className="mt-2">
                        <summary className="text-xs opacity-70 cursor-pointer hover:opacity-100">
                          View result
                        </summary>
                        <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg bg-foreground/5 p-2 text-[11px] font-mono leading-relaxed">
                          {JSON.stringify(msg.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <span className="text-[10px] text-muted-foreground px-1">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && status && (
                <div className="flex items-start gap-2">
                  <div className="bg-muted rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {status === "thinking" && "Thinking..."}
                        {status === "interpreting" && "Interpreting..."}
                        {status === "executing" && "Executing action..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  className={cn(
                    "flex-1 rounded-lg border border-border bg-muted/50",
                    "px-3 py-2.5 text-sm outline-none",
                    "placeholder:text-muted-foreground/60",
                    "focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                    "transition-colors"
                  )}
                  disabled={loading}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className={cn(
                    "shrink-0 rounded-lg bg-primary px-3 py-2.5",
                    "text-primary-foreground",
                    "disabled:opacity-40 hover:bg-primary/90",
                    "transition-colors"
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[10px] text-muted-foreground">
                  {messages.length > 0
                    ? `${messages.length} messages`
                    : "Powered by Action Bus"}
                </span>
                <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5">
                  ⌘K
                </kbd>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating AI button — visible when sidebar is closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-40",
            "w-12 h-12 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg shadow-primary/25",
            "flex items-center justify-center",
            "hover:scale-105 hover:shadow-xl hover:shadow-primary/30",
            "active:scale-95",
            "transition-all duration-200"
          )}
          title="AI Assistant (⌘K)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
        </button>
      )}

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
