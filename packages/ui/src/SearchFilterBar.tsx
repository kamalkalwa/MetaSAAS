/**
 * SearchFilterBar — text search + enum dropdown filters for entity list pages.
 * Renders a search input (when entity has searchFields) and a dropdown
 * for each enum field, plus a "Clear filters" button.
 */

import { columnToLabel } from "./utils";
import type { FieldDefinition } from "@metasaas/contracts";

interface SearchFilterBarProps {
  pluralName: string;
  fields: FieldDefinition[];
  searchFields: string[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
}

export function SearchFilterBar({
  pluralName,
  fields,
  searchFields,
  searchTerm,
  onSearchChange,
  activeFilters,
  onFilterChange,
}: SearchFilterBarProps) {
  const hasActiveFilters = searchTerm || Object.keys(activeFilters).length > 0;
  const enumFields = fields.filter((f) => f.type === "enum" && f.options?.length);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {searchFields.length > 0 && (
        <input
          type="text"
          placeholder={`Search ${pluralName.toLowerCase()}...`}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      {enumFields.map((f) => (
        <select
          key={f.name}
          value={activeFilters[f.name] ?? ""}
          onChange={(e) => {
            const next = { ...activeFilters };
            if (e.target.value) next[f.name] = e.target.value;
            else delete next[f.name];
            onFilterChange(next);
          }}
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
      {hasActiveFilters && (
        <button
          onClick={() => { onSearchChange(""); onFilterChange({}); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
