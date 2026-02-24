"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchEntityMeta, fetchEntityList, fetchTransitions, createEntity, updateEntity, deleteEntity } from "@/lib/api-client";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  /** Per-record transition map for kanban drag validation */
  const [transitionsMap, setTransitionsMap] = useState<Record<string, Record<string, string[]>>>({});
  /** Selected record IDs for bulk operations */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  /** Import state */
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);

  /** Fetches rows with current search/filter state */
  const loadData = useCallback(async (meta: EntityDefinition, search?: string, filters?: Record<string, string>) => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
    }

    const result = await fetchEntityList(entitySlug, Object.keys(params).length > 0 ? params : undefined);
    if (result.success && result.data) {
      setRows(result.data.data);
      setTotal(result.data.total);

      // Pre-fetch transitions for kanban DnD
      if (meta.workflows?.length && result.data.data.length > 0) {
        const tMap: Record<string, Record<string, string[]>> = {};
        await Promise.all(
          result.data.data.map(async (row) => {
            try {
              const t = await fetchTransitions(entitySlug, row.id as string);
              tMap[row.id as string] = t;
            } catch { /* non-critical */ }
          })
        );
        setTransitionsMap(tMap);
      }
    } else if (!result.success) {
      setError(result.error ?? "Failed to load records");
    }
  }, [entitySlug]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const meta = await fetchEntityMeta(entitySlug);
        setEntity(meta);

        const storageKey = `metasaas:view:${entitySlug}`;
        const saved = localStorage.getItem(storageKey) as ViewType | null;
        const defaultView = (meta.ui.defaultView ?? "list") as ViewType;
        let resolvedView = saved ?? defaultView;
        if (resolvedView === "kanban" && !meta.ui.kanban?.groupBy) resolvedView = "list";
        if (resolvedView === "calendar" && !meta.ui.calendar?.dateField) resolvedView = "list";
        setViewType(resolvedView);

        await loadData(meta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug, loadData]);

  /** Handle search with debounce-like behavior */
  useEffect(() => {
    if (!entity) return;
    const timer = setTimeout(() => {
      loadData(entity, searchTerm, activeFilters);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeFilters, entity, loadData]);

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
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id as string)));
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} records? This cannot be undone.`)) return;
    setBulkAction("deleting");
    const ids = Array.from(selected);
    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteEntity(entitySlug, id);
        deleted++;
      } catch { /* skip failed */ }
    }
    setRows((prev) => prev.filter((r) => !selected.has(r.id as string)));
    setTotal((prev) => prev - deleted);
    setSelected(new Set());
    setBulkAction(null);
  }

  /** Generate and download a CSV file from the current rows */
  function handleExportCSV() {
    if (!entity || rows.length === 0) return;
    const fields = entity.fields.map((f) => f.name);
    const header = fields.map((f) => columnToLabel(f)).join(",");
    const csvRows = rows.map((row) =>
      fields.map((f) => {
        const val = row[f];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entitySlug}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import records from a CSV file */
  async function handleImportCSV() {
    if (!importFile || !entity) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        setImportResult({ created: 0, errors: ["CSV must have a header row and at least one data row."] });
        setImporting(false);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      // Map header labels back to field names
      const fieldMap: Record<string, string> = {};
      for (const field of entity.fields) {
        const label = columnToLabel(field.name).toLowerCase();
        fieldMap[label] = field.name;
        fieldMap[field.name.toLowerCase()] = field.name;
      }

      const mappedHeaders = headers.map((h) => fieldMap[h.toLowerCase()] ?? null);
      let created = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const data: Record<string, unknown> = {};

        for (let j = 0; j < mappedHeaders.length; j++) {
          const fieldName = mappedHeaders[j];
          if (!fieldName || !values[j]) continue;
          const fieldDef = entity.fields.find((f) => f.name === fieldName);
          if (!fieldDef) continue;

          switch (fieldDef.type) {
            case "number": case "currency": case "percentage":
              data[fieldName] = parseFloat(values[j]); break;
            case "boolean":
              data[fieldName] = values[j].toLowerCase() === "true"; break;
            default:
              data[fieldName] = values[j];
          }
        }

        try {
          await createEntity(entitySlug, data);
          created++;
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Failed"}`);
        }
      }

      setImportResult({ created, errors });
      if (created > 0 && entity) await loadData(entity, searchTerm, activeFilters);
    } catch (err) {
      setImportResult({ created: 0, errors: [err instanceof Error ? err.message : "Import failed"] });
    } finally {
      setImporting(false);
    }
  }

  async function handleBulkStatusChange(field: string, value: string) {
    setBulkAction("updating");
    const ids = Array.from(selected);
    let updated = 0;
    for (const id of ids) {
      try {
        await updateEntity(entitySlug, id, { [field]: value });
        updated++;
      } catch { /* skip failed */ }
    }
    // Refresh data to reflect changes
    if (entity) await loadData(entity, searchTerm, activeFilters);
    setSelected(new Set());
    setBulkAction(null);
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

          <button
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="inline-flex items-center px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Import CSV
          </button>
          <Link
            href={`/${entitySlug}/new`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + New {entity.name}
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {entity.ui.searchFields.length > 0 && (
          <input
            type="text"
            placeholder={`Search ${entity.pluralName.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
        {entity.fields
          .filter((f) => f.type === "enum" && f.options?.length)
          .map((f) => (
            <select
              key={f.name}
              value={activeFilters[f.name] ?? ""}
              onChange={(e) =>
                setActiveFilters((prev) => {
                  const next = { ...prev };
                  if (e.target.value) next[f.name] = e.target.value;
                  else delete next[f.name];
                  return next;
                })
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{columnToLabel(f.name)}: All</option>
              {f.options!.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, " ")}
                </option>
              ))}
            </select>
          ))}
        {(searchTerm || Object.keys(activeFilters).length > 0) && (
          <button
            onClick={() => { setSearchTerm(""); setActiveFilters({}); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
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
          transitionsMap={transitionsMap}
          onCardMoved={() => {
            // Refresh data after a move
            fetchEntityList(entitySlug).then((r) => {
              if (r.success && r.data) {
                setRows(r.data.data);
                setTotal(r.data.total);
              }
            });
          }}
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
        <div>
          {/* Bulk Actions Bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">
                {selected.size} selected
              </span>
              {/* Bulk status change for enum fields */}
              {entity.fields
                .filter((f) => f.type === "enum" && f.options?.length)
                .map((f) => (
                  <select
                    key={f.name}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleBulkStatusChange(f.name, e.target.value);
                      e.target.value = "";
                    }}
                    disabled={!!bulkAction}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Set {columnToLabel(f.name)}...</option>
                    {f.options!.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                ))}
              <button
                onClick={handleBulkDelete}
                disabled={!!bulkAction}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                Delete selected
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground ml-auto"
              >
                Clear selection
              </button>
              {bulkAction && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  {bulkAction}...
                </span>
              )}
            </div>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleSelectAll}
                    className="rounded border-input"
                  />
                </th>
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
              {rows.map((row) => {
                const rowId = row.id as string;
                return (
                <tr
                  key={rowId}
                  className={`hover:bg-muted/30 cursor-pointer transition-colors ${selected.has(rowId) ? "bg-primary/5" : ""}`}
                  onClick={() => router.push(`/${entitySlug}/${row.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(rowId)}
                      onChange={() => toggleSelect(rowId)}
                      className="rounded border-input"
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3 text-sm">
                      {formatValue(row[col])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(rowId);
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Import {entity.pluralName} from CSV</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a CSV file with headers matching field names or labels.
              Expected fields: {entity.fields.map((f) => columnToLabel(f.name)).join(", ")}
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm mb-4"
            />
            {importResult && (
              <div className={`mb-4 p-3 rounded-md text-sm ${importResult.errors.length > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {importResult.created > 0 && <p>Created {importResult.created} records.</p>}
                {importResult.errors.map((err, i) => <p key={i} className="text-xs">{err}</p>)}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null); }}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleImportCSV}
                disabled={!importFile || importing}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
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
