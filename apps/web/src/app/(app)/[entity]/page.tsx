"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchEntityMeta, fetchEntityList, fetchTransitions, createEntity, updateEntity, deleteEntity } from "@/lib/api-client";
import { columnToLabel } from "@/lib/utils";
import { SearchFilterBar, BulkActionsBar, DataTable, ImportModal, Pagination, useToast, ConfirmDialog, ListSkeleton, EmptyState } from "@metasaas/ui";
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
  /** Import modal visibility */
  const [showImport, setShowImport] = useState(false);
  /** Pagination */
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  /** Confirm dialog state */
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const toast = useToast();

  /** Fetches rows with current search/filter/pagination state */
  const loadData = useCallback(async (meta: EntityDefinition, search?: string, filters?: Record<string, string>, currentPage = 1) => {
    const queryParams: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String((currentPage - 1) * PAGE_SIZE),
    };
    if (search) queryParams.search = search;
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v) queryParams[k] = v;
      }
    }

    const result = await fetchEntityList(entitySlug, queryParams);
    if (result.success && result.data) {
      setRows(result.data.data);
      setTotal(result.data.total);

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

        await loadData(meta, undefined, undefined, 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug, loadData]);

  /** Debounced search + filter reload — resets to page 1 */
  useEffect(() => {
    if (!entity) return;
    const timer = setTimeout(() => {
      setPage(1);
      loadData(entity, searchTerm, activeFilters, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeFilters, entity, loadData]);

  /** Page change handler */
  function handlePageChange(newPage: number) {
    setPage(newPage);
    if (entity) loadData(entity, searchTerm, activeFilters, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchView(newView: ViewType) {
    setViewType(newView);
    localStorage.setItem(`metasaas:view:${entitySlug}`, newView);
  }

  function handleDelete(id: string) {
    setConfirmState({
      open: true,
      title: "Delete record",
      message: "This action cannot be undone. Are you sure?",
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, open: false }));
        try {
          await deleteEntity(entitySlug, id);
          setRows((prev) => prev.filter((r) => r.id !== id));
          setTotal((prev) => prev - 1);
          setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
          toast("Record deleted");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Delete failed");
        }
      },
    });
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

  function handleBulkDelete() {
    setConfirmState({
      open: true,
      title: `Delete ${selected.size} records`,
      message: "This action cannot be undone. Are you sure you want to delete all selected records?",
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, open: false }));
        setBulkAction("deleting");
        const ids = Array.from(selected);
        let deleted = 0;
        for (const id of ids) {
          try { await deleteEntity(entitySlug, id); deleted++; } catch { /* skip */ }
        }
        setRows((prev) => prev.filter((r) => !selected.has(r.id as string)));
        setTotal((prev) => prev - deleted);
        setSelected(new Set());
        setBulkAction(null);
        toast(`${deleted} record${deleted !== 1 ? "s" : ""} deleted`);
      },
    });
  }

  async function handleBulkStatusChange(field: string, value: string) {
    setBulkAction("updating");
    const ids = Array.from(selected);
    let updated = 0;
    for (const id of ids) {
      try { await updateEntity(entitySlug, id, { [field]: value }); updated++; } catch { /* skip */ }
    }
    if (entity) await loadData(entity, searchTerm, activeFilters, page);
    setSelected(new Set());
    setBulkAction(null);
    toast(`${updated} record${updated !== 1 ? "s" : ""} updated`);
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

  if (loading) {
    return <ListSkeleton />;
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

  const hasKanban = Boolean(entity.ui.kanban?.groupBy);
  const hasCalendar = Boolean(entity.ui.calendar?.dateField);

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
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <ViewButton active={viewType === "list"} onClick={() => switchView("list")} label="List" />
            {hasKanban && (
              <ViewButton active={viewType === "kanban"} onClick={() => switchView("kanban")} label="Kanban" />
            )}
            {hasCalendar && (
              <ViewButton active={viewType === "calendar"} onClick={() => switchView("calendar")} label="Calendar" />
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
      <SearchFilterBar
        pluralName={entity.pluralName}
        fields={entity.fields}
        searchFields={entity.ui.searchFields}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />

      {/* View Content */}
      {rows.length === 0 ? (
        <EmptyState
          title={`No ${entity.pluralName.toLowerCase()} yet`}
          description={`Create your first ${entity.name.toLowerCase()} to get started.`}
          actionLabel={`+ New ${entity.name}`}
          actionHref={`/${entitySlug}/new`}
        />
      ) : viewType === "kanban" && entity.ui.kanban ? (
        <KanbanView
          entity={entity}
          rows={rows}
          groupBy={entity.ui.kanban.groupBy}
          entitySlug={entitySlug}
          transitionsMap={transitionsMap}
          onCardMoved={() => {
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
        <div>
          <BulkActionsBar
            selectedCount={selected.size}
            fields={entity.fields}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkDelete={handleBulkDelete}
            onClearSelection={() => setSelected(new Set())}
            busy={!!bulkAction}
            busyLabel={bulkAction ?? undefined}
          />

          <DataTable
            columns={entity.ui.listColumns}
            rows={rows}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onRowClick={(id) => router.push(`/${entitySlug}/${id}`)}
            onDelete={handleDelete}
          />

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <ImportModal
          entityName={entity.name}
          pluralName={entity.pluralName}
          fields={entity.fields}
          onImportRow={async (data) => { await createEntity(entitySlug, data); }}
          onClose={() => {
            setShowImport(false);
            if (entity) loadData(entity, searchTerm, activeFilters, page);
          }}
        />
      )}

      {/* Confirm Dialog (for delete operations) */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
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
