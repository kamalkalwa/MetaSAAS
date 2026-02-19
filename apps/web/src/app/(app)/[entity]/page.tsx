"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchEntityMeta, fetchEntityList, deleteEntity } from "@/lib/api-client";
import { formatValue, columnToLabel } from "@/lib/utils";
import { KanbanView } from "@/components/kanban-view";
import { CalendarView } from "@/components/calendar-view";
import type { EntityDefinition } from "@metasaas/contracts";

/** Supported view types */
type ViewType = "list" | "kanban" | "calendar";

/**
 * Entity List Page
 *
 * Dynamically renders data for ANY entity in one of three views:
 *   - List (table view, the default)
 *   - Kanban (grouped columns by a field)
 *   - Calendar (month grid anchored on a date field)
 *
 * The entity's `ui.defaultView` determines the initial view.
 * The user's selection persists in localStorage.
 *
 * URL: /contacts, /companies, /tasks, etc.
 */
export default function EntityListPage() {
  const params = useParams();
  const router = useRouter();
  const entitySlug = params.entity as string;

  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>("list");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const meta = await fetchEntityMeta(entitySlug);
        setEntity(meta);

        // Restore view preference from localStorage, or use entity default.
        // Validate saved preference against actual entity config to prevent
        // rendering a view the entity doesn't support.
        const storageKey = `metasaas:view:${entitySlug}`;
        const saved = localStorage.getItem(storageKey) as ViewType | null;
        const defaultView = (meta.ui.defaultView ?? "list") as ViewType;
        let resolvedView = saved ?? defaultView;
        if (resolvedView === "kanban" && !meta.ui.kanban?.groupBy) resolvedView = "list";
        if (resolvedView === "calendar" && !meta.ui.calendar?.dateField) resolvedView = "list";
        setViewType(resolvedView);

        const result = await fetchEntityList(entitySlug);
        if (result.success && result.data) {
          setRows(result.data.data);
          setTotal(result.data.total);
        } else if (!result.success) {
          setError(result.error ?? "Failed to load records");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug]);

  /** Switch view type and persist to localStorage */
  function switchView(newView: ViewType) {
    setViewType(newView);
    localStorage.setItem(`metasaas:view:${entitySlug}`, newView);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteEntity(entitySlug, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (error || !entity) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
        <p>{error ?? "Entity not found"}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-xs underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Determine which views are available for this entity
  const hasKanban = Boolean(entity.ui.kanban?.groupBy);
  const hasCalendar = Boolean(entity.ui.calendar?.dateField);

  const columns = entity.ui.listColumns;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{entity.pluralName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} {total === 1 ? "record" : "records"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <ViewButton
              active={viewType === "list"}
              onClick={() => switchView("list")}
              label="List"
            />
            {hasKanban && (
              <ViewButton
                active={viewType === "kanban"}
                onClick={() => switchView("kanban")}
                label="Kanban"
              />
            )}
            {hasCalendar && (
              <ViewButton
                active={viewType === "calendar"}
                onClick={() => switchView("calendar")}
                label="Calendar"
              />
            )}
          </div>

          <Link
            href={`/${entitySlug}/new`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + New {entity.name}
          </Link>
        </div>
      </div>

      {/* View Content */}
      {rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">
            No {entity.pluralName.toLowerCase()} yet.
          </p>
          <Link
            href={`/${entitySlug}/new`}
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            Create your first {entity.name.toLowerCase()}
          </Link>
        </div>
      ) : viewType === "kanban" && entity.ui.kanban ? (
        <KanbanView
          entity={entity}
          rows={rows}
          groupBy={entity.ui.kanban.groupBy}
          entitySlug={entitySlug}
        />
      ) : viewType === "calendar" && entity.ui.calendar ? (
        <CalendarView
          entity={entity}
          rows={rows}
          dateField={entity.ui.calendar.dateField}
          entitySlug={entitySlug}
        />
      ) : (
        /* List View (table) */
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                  >
                    {columnToLabel(col)}
                  </th>
                ))}
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr
                  key={row.id as string}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/${entitySlug}/${row.id}`)}
                >
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3 text-sm">
                      {formatValue(row[col])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row.id as string);
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Segmented control button for view switching */
function ViewButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
