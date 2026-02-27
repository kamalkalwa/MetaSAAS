/**
 * DataTable — reusable table for entity list views.
 * Renders column headers, row checkboxes, formatted values,
 * and per-row action buttons.
 */

import { formatValue, columnToLabel } from "./utils";

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DataTable({
  columns,
  rows,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onDelete,
}: DataTableProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={rows.length > 0 && selected.size === rows.length}
                onChange={onToggleSelectAll}
                aria-label="Select all rows"
                className="rounded border-input accent-primary"
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
                className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                  selected.has(rowId) ? "bg-primary/5" : ""
                }`}
                onClick={() => onRowClick(rowId)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(rowId)}
                    onChange={() => onToggleSelect(rowId)}
                    aria-label="Select row"
                    className="rounded border-input accent-primary"
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
                      onDelete(rowId);
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
  );
}
