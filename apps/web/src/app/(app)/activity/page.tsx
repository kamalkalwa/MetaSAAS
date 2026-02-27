"use client";

/**
 * Activity Feed Page
 *
 * Displays the audit log as a timeline of all action executions.
 * Supports filtering by entity, success/failure, and date range.
 */

import { useEffect, useState, useCallback } from "react";
import { fetchAuditLog, fetchAllEntityMeta, type AuditLogEntry } from "@/lib/api-client";
import type { EntityDefinition } from "@metasaas/contracts";
import { cn, timeAgo } from "@/lib/utils";

function actionLabel(actionId: string): { entity: string; action: string } {
  const [entity, ...rest] = actionId.split(".");
  return { entity, action: rest.join(".") };
}

const PAGE_SIZE = 25;

export default function ActivityPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntityDefinition[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [entityFilter, setEntityFilter] = useState("");
  const [successFilter, setSuccessFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [result, entityMeta] = await Promise.all([
        fetchAuditLog({
          entity: entityFilter || undefined,
          success: successFilter || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        entities.length === 0 ? fetchAllEntityMeta() : Promise.resolve(entities),
      ]);
      setEntries(result.data);
      setTotal(result.total);
      if (entities.length === 0) setEntities(entityMeta);
    } catch (err) {
      console.error("Failed to load audit log:", err);
      setError("Failed to load activity data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [entityFilter, successFilter, page, entities.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit trail of all actions across the platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All entities</option>
          {entities.map((e) => (
            <option key={e.name} value={e.name.toLowerCase()}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          value={successFilter}
          onChange={(e) => { setSuccessFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All results</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>

        <span className="flex items-center text-xs text-muted-foreground ml-auto">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {error ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => { setError(null); loadData(); }}
              className="text-sm px-4 py-2 rounded-md border border-input hover:bg-accent/50 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading activity...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No activity recorded yet
          </div>
        ) : (
          entries.map((entry) => {
            const { entity, action } = actionLabel(entry.actionId);
            const isExpanded = expandedId === entry.id;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className={cn(
                  "w-full text-left rounded-lg border border-border p-4",
                  "hover:bg-accent/30 transition-colors",
                  isExpanded && "bg-accent/20"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      entry.success ? "bg-green-500" : "bg-red-500"
                    )}
                  />

                  {/* Action info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{entity}</span>
                      <span className="text-xs text-muted-foreground">{action}</span>
                      {entry.durationMs > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {entry.durationMs}ms
                        </span>
                      )}
                    </div>
                    {entry.error && (
                      <p className="text-xs text-destructive mt-0.5 truncate">
                        {entry.error}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Action ID:</span>{" "}
                        <span className="font-mono">{entry.actionId}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">User:</span>{" "}
                        <span className="font-mono">{entry.userId}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>{" "}
                        <span className={entry.success ? "text-green-600" : "text-red-600"}>
                          {entry.success ? "Success" : "Failed"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration:</span>{" "}
                        {entry.durationMs}ms
                      </div>
                    </div>
                    {entry.input != null ? (
                      <div>
                        <span className="text-xs text-muted-foreground">Input:</span>
                        <pre className="mt-1 text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-40">
                          {JSON.stringify(entry.input, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                    {entry.error && (
                      <div>
                        <span className="text-xs text-muted-foreground">Error:</span>
                        <pre className="mt-1 text-[11px] font-mono bg-destructive/10 text-destructive rounded p-2">
                          {entry.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
