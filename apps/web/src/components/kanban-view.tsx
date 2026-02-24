"use client";

/**
 * Kanban View Component
 *
 * Renders records grouped into columns by a workflow field.
 * Supports drag-and-drop between columns, validated against
 * the entity's workflow transitions. Invalid drops bounce back
 * with a visible error message.
 *
 * Uses @dnd-kit for accessible, performant drag-and-drop.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatValue, columnToLabel } from "@/lib/utils";
import { updateEntity } from "@/lib/api-client";
import type { EntityDefinition } from "@metasaas/contracts";

interface KanbanViewProps {
  entity: EntityDefinition;
  rows: Record<string, unknown>[];
  groupBy: string;
  entitySlug: string;
  /** Valid transitions per record ID, keyed by field name → next states */
  transitionsMap?: Record<string, Record<string, string[]>>;
  /** Called after a successful card move so the parent can refresh data */
  onCardMoved?: () => void;
}

const COLUMN_COLORS = [
  "bg-blue-50 border-blue-200 text-blue-700",
  "bg-amber-50 border-amber-200 text-amber-700",
  "bg-emerald-50 border-emerald-200 text-emerald-700",
  "bg-purple-50 border-purple-200 text-purple-700",
  "bg-rose-50 border-rose-200 text-rose-700",
  "bg-cyan-50 border-cyan-200 text-cyan-700",
];

/** A single draggable card in the kanban board */
function KanbanCard({
  row,
  cardFields,
  listColumns,
  entitySlug,
}: {
  row: Record<string, unknown>;
  cardFields: string[];
  listColumns: string[];
  entitySlug: string;
}) {
  const router = useRouter();
  const id = row.id as string;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/${entitySlug}/${id}`)}
      className="bg-card border border-border rounded-md p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow touch-none"
    >
      <div className="font-medium text-sm mb-1 truncate">
        {formatValue(row[listColumns[0]])}
      </div>
      {cardFields.slice(1).map((field) => (
        <div key={field} className="text-xs text-muted-foreground truncate">
          {columnToLabel(field)}: {formatValue(row[field])}
        </div>
      ))}
    </div>
  );
}

/** A droppable column in the kanban board */
function KanbanColumn({
  colKey,
  colorClass,
  items,
  cardFields,
  listColumns,
  entitySlug,
  isValidTarget,
}: {
  colKey: string;
  colorClass: string;
  items: Record<string, unknown>[];
  cardFields: string[];
  listColumns: string[];
  entitySlug: string;
  isValidTarget: boolean | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });

  let dropHighlight = "";
  if (isOver && isValidTarget === true) dropHighlight = "ring-2 ring-green-400 bg-green-50/30";
  else if (isOver && isValidTarget === false) dropHighlight = "ring-2 ring-red-400 bg-red-50/30";

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72">
      <div
        className={`px-3 py-2 rounded-t-lg border text-sm font-medium flex items-center justify-between ${colorClass}`}
      >
        <span>{columnToLabel(colKey)}</span>
        <span className="text-xs opacity-70">{items.length}</span>
      </div>
      <div
        className={`bg-muted/30 border border-t-0 border-border rounded-b-lg p-2 space-y-2 min-h-[200px] transition-all ${dropHighlight}`}
      >
        {items.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {isOver && isValidTarget === false ? "Invalid transition" : "No items"}
          </div>
        ) : (
          items.map((row) => (
            <KanbanCard
              key={row.id as string}
              row={row}
              cardFields={cardFields}
              listColumns={listColumns}
              entitySlug={entitySlug}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanView({
  entity,
  rows,
  groupBy,
  entitySlug,
  transitionsMap,
  onCardMoved,
}: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [localRows, setLocalRows] = useState(rows);

  // Keep local rows in sync with prop changes
  if (rows !== localRows && !activeId) {
    setLocalRows(rows);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const groupField = entity.fields.find((f) => f.name === groupBy);
  const columnKeys: string[] = groupField?.options
    ? [...groupField.options]
    : [...new Set(localRows.map((r) => String(r[groupBy] ?? "")))].filter(Boolean).sort();

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const key of columnKeys) grouped.set(key, []);
  for (const row of localRows) {
    const key = String(row[groupBy] ?? "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const cardFields = entity.ui.listColumns.filter((c) => c !== groupBy);

  const activeRow = activeId ? localRows.find((r) => r.id === activeId) : null;

  /** Check if moving the active card to targetColumn is a valid workflow transition */
  const isValidDrop = useCallback(
    (targetColumn: string): boolean | null => {
      if (!activeId || !transitionsMap) return null;
      const recordTransitions = transitionsMap[activeId];
      if (!recordTransitions) return null;
      const allowed = recordTransitions[groupBy];
      if (!allowed) return null;
      return allowed.includes(targetColumn);
    },
    [activeId, transitionsMap, groupBy]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setToast(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const recordId = String(active.id);
    const targetColumn = String(over.id);
    const record = localRows.find((r) => r.id === recordId);
    if (!record) return;

    const currentColumn = String(record[groupBy] ?? "");
    if (currentColumn === targetColumn) return;

    // Check if transition is valid
    if (transitionsMap) {
      const allowed = transitionsMap[recordId]?.[groupBy];
      if (allowed && !allowed.includes(targetColumn)) {
        const fromLabel = columnToLabel(currentColumn);
        const toLabel = columnToLabel(targetColumn);
        setToast({
          message: `Can't move from "${fromLabel}" to "${toLabel}". Try: ${allowed.map(columnToLabel).join(", ") || "no transitions available"}.`,
          type: "error",
        });
        return;
      }
    }

    // Optimistic update — move the card immediately
    setLocalRows((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, [groupBy]: targetColumn } : r))
    );

    try {
      const result = await updateEntity(entitySlug, recordId, { [groupBy]: targetColumn });
      if (result.success) {
        setToast({ message: `Moved to ${columnToLabel(targetColumn)}`, type: "success" });
        onCardMoved?.();
      } else {
        // Rollback
        setLocalRows((prev) =>
          prev.map((r) => (r.id === recordId ? { ...r, [groupBy]: currentColumn } : r))
        );
        setToast({ message: result.error ?? "Move failed", type: "error" });
      }
    } catch (err) {
      // Rollback
      setLocalRows((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [groupBy]: currentColumn } : r))
      );
      setToast({
        message: err instanceof Error ? err.message : "Move failed",
        type: "error",
      });
    }
  }

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div
          className={`mb-4 px-4 py-2 rounded-md text-sm ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.message}
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-xs opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnKeys.map((colKey, idx) => (
            <KanbanColumn
              key={colKey}
              colKey={colKey}
              colorClass={COLUMN_COLORS[idx % COLUMN_COLORS.length]}
              items={grouped.get(colKey) ?? []}
              cardFields={cardFields}
              listColumns={entity.ui.listColumns}
              entitySlug={entitySlug}
              isValidTarget={activeId ? isValidDrop(colKey) : null}
            />
          ))}
        </div>

        {/* Drag overlay — shows the card being dragged */}
        <DragOverlay>
          {activeRow ? (
            <div className="bg-card border-2 border-primary rounded-md p-3 shadow-lg w-72 opacity-90">
              <div className="font-medium text-sm mb-1 truncate">
                {formatValue(activeRow[entity.ui.listColumns[0]])}
              </div>
              {cardFields.slice(1).map((field) => (
                <div key={field} className="text-xs text-muted-foreground truncate">
                  {columnToLabel(field)}: {formatValue(activeRow[field])}
                </div>
              ))}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
