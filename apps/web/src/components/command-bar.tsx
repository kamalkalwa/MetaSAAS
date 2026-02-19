"use client";

/**
 * Command Bar — AI-powered natural language interface
 *
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 * Accepts plain text commands like:
 *   - "Create a task called Fix login bug with high priority"
 *   - "List all active contacts"
 *   - "Delete product with id ..."
 *
 * The command is sent to the backend, where the AI Gateway maps
 * natural language to a registered Action, and the Action Bus
 * dispatches it with full validation, permissions, and workflow checks.
 *
 * This is the "AI-native" entry point — the same security pipeline
 * as REST API calls or UI button clicks, but triggered by human language.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { sendCommand, type CommandResult } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Detects Mac vs other platforms for keyboard shortcut display.
 */
function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);
  return isMac;
}

/**
 * CommandBar component.
 *
 * Renders a floating dialog with:
 *   - A text input for natural language commands
 *   - A loading indicator during AI processing
 *   - A result area showing interpretation and outcome
 *   - Keyboard shortcut hint in the UI
 */
export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = useIsMac();

  // Global keyboard listener: Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            // Reset state when opening
            setText("");
            setResult(null);
          }
          return !prev;
        });
      }

      // Escape to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure the dialog is rendered before focusing
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Submit the command
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || loading) return;

      setLoading(true);
      setResult(null);

      try {
        const res = await sendCommand(text.trim());
        setResult(res);
      } catch (err) {
        setResult({
          success: false,
          error: err instanceof Error ? err.message : "Failed to send command",
        });
      } finally {
        setLoading(false);
      }
    },
    [text, loading]
  );

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[20%] z-50 mx-auto w-full max-w-lg px-4">
        <div className="rounded-xl border border-border bg-popover shadow-2xl">
          {/* Input */}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center border-b border-border px-4">
              {/* Search/Command icon */}
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
                className="text-muted-foreground shrink-0"
              >
                <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a command in plain English..."
                className="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-muted-foreground"
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />

              {/* Keyboard shortcut hint */}
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isMac ? "⌘" : "Ctrl"}+K
              </kbd>
            </div>
          </form>

          {/* Result area */}
          <div className="max-h-64 overflow-y-auto">
            {/* Loading state */}
            {loading && (
              <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Interpreting command...
              </div>
            )}

            {/* Result */}
            {result && !loading && (
              <div className="p-4 space-y-3">
                {/* Interpretation */}
                {result.interpretation && (
                  <div className="text-sm text-muted-foreground">
                    {result.interpretation}
                  </div>
                )}

                {/* Success */}
                {result.success && (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
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
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Action executed: {result.actionId}
                    </div>
                    {result.data != null && (
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Error */}
                {!result.success && result.error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
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
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      {result.error}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state — hints */}
            {!result && !loading && (
              <div className="px-4 py-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Examples
                </p>
                {[
                  "Create a task called Fix login bug with high priority",
                  "List all active contacts",
                  "Create a company called Acme Corp in Technology",
                ].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    className={cn(
                      "w-full text-left rounded-md px-3 py-2 text-sm",
                      "text-muted-foreground hover:bg-accent hover:text-foreground",
                      "transition-colors cursor-pointer"
                    )}
                    onClick={() => {
                      setText(hint);
                      inputRef.current?.focus();
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <span className="text-[11px] text-muted-foreground">
              AI interprets your command and dispatches it through the Action Bus
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
