/**
 * BulkActionsBar — appears when records are selected in the list view.
 * Shows count, enum status-change dropdowns, delete, and clear buttons.
 */

import { columnToLabel } from "./utils";
import type { FieldDefinition } from "@metasaas/contracts";

interface BulkActionsBarProps {
  selectedCount: number;
  fields: FieldDefinition[];
  onBulkStatusChange: (field: string, value: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  busy: boolean;
  busyLabel?: string;
}

export function BulkActionsBar({
  selectedCount,
  fields,
  onBulkStatusChange,
  onBulkDelete,
  onClearSelection,
  busy,
  busyLabel,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  const enumFields = fields.filter((f) => f.type === "enum" && f.options?.length);

  return (
    <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      {enumFields.map((f) => (
        <select
          key={f.name}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onBulkStatusChange(f.name, e.target.value);
            e.target.value = "";
          }}
          disabled={busy}
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
        onClick={onBulkDelete}
        disabled={busy}
        className="text-xs text-destructive hover:underline disabled:opacity-50"
      >
        Delete selected
      </button>
      <button
        onClick={onClearSelection}
        className="text-xs text-muted-foreground hover:text-foreground ml-auto"
      >
        Clear selection
      </button>
      {busy && busyLabel && (
        <span className="text-xs text-muted-foreground animate-pulse">
          {busyLabel}...
        </span>
      )}
    </div>
  );
}
