"use client";

/**
 * Workspace Context
 *
 * Manages the active workspace (tenant) for the current user.
 * Persists the selection to localStorage so it survives page refreshes.
 * Wires the active workspace ID into the API client via setActiveWorkspace().
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchWorkspaces,
  createWorkspace,
  setActiveWorkspace,
  type WorkspaceData,
} from "./api-client";

const STORAGE_KEY = "metasaas:activeWorkspace";

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load workspaces and restore saved selection
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ws = await fetchWorkspaces();
        if (cancelled) return;
        setWorkspaces(ws);

        // Restore last active workspace from localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        const valid = ws.find((w) => w.id === saved);

        if (valid) {
          setActiveId(valid.id);
          setActiveWorkspace(valid.id);
        } else if (ws.length > 0) {
          // Default to first workspace
          setActiveId(ws[0].id);
          setActiveWorkspace(ws[0].id);
        }
      } catch {
        // Workspace tables may not exist yet — non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const switchWorkspace = useCallback(
    (id: string) => {
      setActiveId(id);
      setActiveWorkspace(id);
      localStorage.setItem(STORAGE_KEY, id);
      // Reload the page to refresh all data with the new tenant context
      window.location.reload();
    },
    []
  );

  const addWorkspace = useCallback(
    async (name: string) => {
      const ws = await createWorkspace(name);
      setWorkspaces((prev) => [...prev, ws]);
      return ws;
    },
    []
  );

  const active = workspaces.find((w) => w.id === activeId) ?? null;

  return {
    workspaces,
    active,
    loading,
    switchWorkspace,
    addWorkspace,
  };
}
