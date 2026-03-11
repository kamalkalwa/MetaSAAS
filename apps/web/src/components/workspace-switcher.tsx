"use client";

/**
 * Workspace Switcher
 *
 * Dropdown in the sidebar that lets users switch between workspaces
 * or create a new one. Shows the active workspace name and a list of
 * available workspaces on click.
 */

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/use-workspace";

export function WorkspaceSwitcher() {
  const { workspaces, active, loading, switchWorkspace, addWorkspace } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Focus input when creating
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const ws = await addWorkspace(newName.trim());
      setNewName("");
      setCreating(false);
      switchWorkspace(ws.id);
    } catch {
      // Error handled by toast in the calling context
    }
  }

  if (loading) {
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
          "border border-border bg-muted/30 hover:bg-accent/50 transition-colors",
          "text-left"
        )}
      >
        {/* Workspace icon */}
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
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        </svg>
        <span className="flex-1 truncate font-medium">
          {active?.name ?? "Select workspace"}
        </span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-md">
          <div className="py-1 max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  if (ws.id !== active?.id) {
                    switchWorkspace(ws.id);
                  }
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  ws.id === active?.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="flex-1 truncate">{ws.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {ws.role}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-border p-2">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                className="flex gap-1"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background"
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Add
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
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
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
