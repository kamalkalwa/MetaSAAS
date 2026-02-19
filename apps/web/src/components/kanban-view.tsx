"use client";

/**
 * Kanban View Component
 *
 * Renders records grouped into columns by a specified field
 * (e.g., "status" for tasks). Each column represents a distinct
 * value of the groupBy field.
 *
 * Features:
 *   - Columns are dynamically generated from enum options or data values
 *   - Cards show the entity's listColumns fields
 *   - Click a card to navigate to the detail view
 *   - Drag-and-drop is deferred to v1
 *
 * Usage:
 *   <KanbanView
 *     entity={entity}
 *     rows={rows}
 *     groupBy="status"
 *     entitySlug="tasks"
 *   />
 */

import { useRouter } from "next/navigation";
import { formatValue, columnToLabel } from "@/lib/utils";
import type { EntityDefinition } from "@metasaas/contracts";

interface KanbanViewProps {
  /** The entity definition (for field metadata) */
  entity: EntityDefinition;
  /** All records to display */
  rows: Record<string, unknown>[];
  /** The field name to group by (e.g., "status") */
  groupBy: string;
  /** URL slug for navigation (e.g., "tasks") */
  entitySlug: string;
}

/** Color palette for kanban column headers — cycles for unknown values */
const COLUMN_COLORS = [
  "bg-blue-50 border-blue-200 text-blue-700",
  "bg-amber-50 border-amber-200 text-amber-700",
  "bg-emerald-50 border-emerald-200 text-emerald-700",
  "bg-purple-50 border-purple-200 text-purple-700",
  "bg-rose-50 border-rose-200 text-rose-700",
  "bg-cyan-50 border-cyan-200 text-cyan-700",
];

export function KanbanView({ entity, rows, groupBy, entitySlug }: KanbanViewProps) {
  const router = useRouter();

  // Determine column order: prefer enum options if the field has them
  const groupField = entity.fields.find((f) => f.name === groupBy);
  const columnKeys: string[] = groupField?.options
    ? [...groupField.options]
    : [...new Set(rows.map((r) => String(r[groupBy] ?? "")))]
        .filter(Boolean)
        .sort();

  // Group rows by the groupBy field
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const key of columnKeys) {
    grouped.set(key, []);
  }
  for (const row of rows) {
    const key = String(row[groupBy] ?? "");
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  }

  // Which fields to show on cards (listColumns minus the groupBy field)
  const cardFields = entity.ui.listColumns.filter((c) => c !== groupBy);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columnKeys.map((colKey, idx) => {
        const items = grouped.get(colKey) ?? [];
        const colorClass = COLUMN_COLORS[idx % COLUMN_COLORS.length];

        return (
          <div key={colKey} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div
              className={`px-3 py-2 rounded-t-lg border text-sm font-medium flex items-center justify-between ${colorClass}`}
            >
              <span>{columnToLabel(colKey)}</span>
              <span className="text-xs opacity-70">{items.length}</span>
            </div>

            {/* Cards */}
            <div className="bg-muted/30 border border-t-0 border-border rounded-b-lg p-2 space-y-2 min-h-[200px]">
              {items.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No items
                </div>
              ) : (
                items.map((row) => (
                  <div
                    key={row.id as string}
                    onClick={() => router.push(`/${entitySlug}/${row.id}`)}
                    className="bg-card border border-border rounded-md p-3 cursor-pointer hover:shadow-sm transition-shadow"
                  >
                    {/* Card title: first listColumn value */}
                    <div className="font-medium text-sm mb-1 truncate">
                      {formatValue(row[entity.ui.listColumns[0]])}
                    </div>
                    {/* Secondary fields */}
                    {cardFields.slice(1).map((field) => (
                      <div
                        key={field}
                        className="text-xs text-muted-foreground truncate"
                      >
                        {columnToLabel(field)}: {formatValue(row[field])}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
