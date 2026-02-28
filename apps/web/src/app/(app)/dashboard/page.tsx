"use client";

/**
 * Dashboard Page
 *
 * Provides an at-a-glance overview:
 *   - Quick actions (create record, open AI chat)
 *   - Entity cards with record counts
 *   - Workflow overview (items per state for workflow entities)
 *   - Recent activity (last 5 updated records across all entities)
 *   - Getting-started guide for empty tenants
 */

import { useEffect, useState } from "react";
import { fetchAllEntityMeta, fetchEntityList } from "@/lib/api-client";
import { timeAgo, columnToLabel } from "@/lib/utils";
import type { EntityDefinition } from "@metasaas/contracts";
import Link from "next/link";

interface RecentRecord {
  entitySlug: string;
  entityName: string;
  id: string;
  label: string;
  updatedAt: string;
}

interface WorkflowSummary {
  entityName: string;
  entitySlug: string;
  field: string;
  states: Record<string, number>;
}

export default function DashboardPage() {
  const [entities, setEntities] = useState<EntityDefinition[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<RecentRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const ents = await fetchAllEntityMeta();
        setEntities(ents);

        const allRecent: RecentRecord[] = [];
        const workflowSums: WorkflowSummary[] = [];
        const countMap: Record<string, number> = {};

        await Promise.all(
          ents.map(async (e) => {
            const slug = e.pluralName.toLowerCase();
            try {
              const res = await fetchEntityList(slug, { orderBy: "updatedAt", direction: "desc", limit: "5" });
              if (res.success && res.data) {
                countMap[e.name] = res.data.total;
                for (const row of res.data.data) {
                  allRecent.push({
                    entitySlug: slug,
                    entityName: e.name,
                    id: row.id as string,
                    label: String(row[e.fields[0]?.name] ?? row.id),
                    updatedAt: row.updatedAt as string,
                  });
                }

                // Build workflow state counts
                if (e.workflows?.length && res.data.total > 0) {
                  const fullRes = await fetchEntityList(slug, { limit: "500" });
                  if (fullRes.success && fullRes.data) {
                    for (const wf of e.workflows) {
                      const states: Record<string, number> = {};
                      for (const opt of (e.fields.find((f) => f.name === wf.field)?.options ?? [])) {
                        states[opt] = 0;
                      }
                      for (const row of fullRes.data.data) {
                        const val = row[wf.field] as string;
                        if (val) states[val] = (states[val] ?? 0) + 1;
                      }
                      workflowSums.push({
                        entityName: e.name,
                        entitySlug: slug,
                        field: wf.field,
                        states,
                      });
                    }
                  }
                }
              }
            } catch {
              countMap[e.name] = 0;
            }
          })
        );

        setCounts(countMap);
        setWorkflows(workflowSums);

        // Sort by updatedAt desc and take 8 most recent
        allRecent.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setRecent(allRecent.slice(0, 8));
      } catch (err) {
        console.warn("Dashboard load failed:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalRecords = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const isEmpty = totalRecords === 0 && !loading;

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
            className="text-sm px-4 py-2 rounded-md border border-input hover:bg-accent/50 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        {/* Skeleton entity cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-lg border border-border bg-card animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-7 w-10 bg-muted rounded" />
              </div>
              <div className="h-3 w-32 bg-muted rounded mt-3" />
            </div>
          ))}
        </div>
        {/* Skeleton activity rows */}
        <div className="border border-border rounded-lg divide-y divide-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        {entities.slice(0, 3).map((e) => (
          <Link
            key={e.name}
            href={`/${e.pluralName.toLowerCase()}/new`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            + New {e.name}
          </Link>
        ))}
        <button
          onClick={() => {
            // Trigger Cmd+K to open AI chat
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }}
          className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
        >
          Open AI Chat
        </button>
      </div>

      {/* Getting Started (shown when no data exists) */}
      {isEmpty && (
        <div className="mb-8 p-6 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
          <h2 className="text-lg font-semibold mb-2">Welcome to MetaSAAS</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your platform is ready. Here are a few ways to get started:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <strong>Create a record</strong> — Click one of the &quot;+ New&quot; buttons above
            </li>
            <li>
              <strong>Talk to the AI</strong> — Open the chat sidebar and try
              &quot;Create a gym management system with members, trainers, and classes&quot;
            </li>
            <li>
              <strong>Define an entity in code</strong> — Add a file to{" "}
              <code className="bg-muted px-1 rounded">packages/domain/src/entities/</code>
            </li>
          </ol>
        </div>
      )}

      {/* Entity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {entities.map((entity) => (
          <Link
            key={entity.name}
            href={`/${entity.pluralName.toLowerCase()}`}
            className="block p-5 rounded-lg border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">
                {entity.pluralName}
              </span>
              <span className="text-2xl font-bold">
                {loading ? "—" : (counts[entity.name] ?? 0)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {entity.description}
            </div>
          </Link>
        ))}
      </div>

      {/* Workflow Overview */}
      {workflows.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Workflow Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((wf) => {
              const total = Object.values(wf.states).reduce((s, c) => s + c, 0);
              return (
                <div key={`${wf.entityName}-${wf.field}`} className="p-4 rounded-lg border border-border bg-card">
                  <div className="text-sm font-medium mb-3">
                    <Link href={`/${wf.entitySlug}`} className="hover:underline">
                      {wf.entityName}
                    </Link>
                    <span className="text-muted-foreground"> — {columnToLabel(wf.field)}</span>
                  </div>
                  {/* State bar */}
                  {total > 0 && (
                    <div
                      className="flex rounded-full overflow-hidden h-2 mb-3 bg-muted"
                      role="img"
                      aria-label={Object.entries(wf.states).filter(([,c]) => c > 0).map(([s, c]) => `${columnToLabel(s)}: ${c}`).join(", ")}
                    >
                      {Object.entries(wf.states).map(([state, count], idx) => {
                        if (count === 0) return null;
                        const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
                        return (
                          <div
                            key={state}
                            className={`${colors[idx % colors.length]} transition-all`}
                            style={{ width: `${(count / total) * 100}%` }}
                            title={`${columnToLabel(state)}: ${count}`}
                          />
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(wf.states).map(([state, count]) => (
                      <span key={state} className="text-xs text-muted-foreground">
                        {columnToLabel(state)}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="border border-border rounded-lg divide-y divide-border">
            {recent.map((r) => (
              <Link
                key={`${r.entitySlug}-${r.id}`}
                href={`/${r.entitySlug}/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.entityName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(r.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {entities.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No entities registered yet.</p>
          <p className="text-sm mt-2">
            Define entities in <code>packages/domain/src/entities/</code> and restart the server.
          </p>
        </div>
      )}
    </div>
  );
}
