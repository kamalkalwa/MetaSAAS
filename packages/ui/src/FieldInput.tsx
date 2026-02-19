/**
 * FieldInput — Shared Form Input Component
 *
 * Renders the appropriate HTML input element for a given field type.
 * Used by both the create and edit pages to ensure consistent behavior.
 *
 * This is the SINGLE source of truth for how field types map to inputs.
 * Adding a new field type? Add the case here — all pages get it automatically.
 */

import { columnToLabel } from "./utils";
import type { FieldDefinition } from "@metasaas/contracts";

/** Standard CSS class applied to all form inputs for visual consistency */
const BASE_INPUT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/** Option for relationship (belongsTo) dropdowns */
export interface RelationshipOption {
  label: string;
  value: string;
}

interface FieldInputProps {
  /** The field definition from the entity schema */
  field: FieldDefinition;
  /** Current string value of the input */
  value: string;
  /** Callback fired when the input value changes */
  onChange: (value: string) => void;
  /**
   * For belongsTo relationship fields: options to populate a dropdown.
   * When provided, renders a <select> instead of a text input.
   */
  relationshipOptions?: RelationshipOption[];
}

/**
 * Maps a FieldDefinition to the correct HTML input element.
 * Every field type in @metasaas/contracts should have a corresponding case here.
 * When relationshipOptions is provided, renders a dropdown for FK selection.
 */
export function FieldInput({ field, value, onChange, relationshipOptions }: FieldInputProps) {
  // Relationship field — render a dropdown of related records
  if (relationshipOptions) {
    return (
      <select
        className={BASE_INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {columnToLabel(field.name)}</option>
        {relationshipOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  switch (field.type) {
    case "rich_text":
      return (
        <textarea
          className={`${BASE_INPUT_CLASS} min-h-[100px]`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(String(e.target.checked))}
            className="rounded border-input"
          />
          <span className="text-sm">{field.description}</span>
        </label>
      );

    case "enum":
      return (
        <select
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {columnToLabel(field.name)}</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, " ")}
            </option>
          ))}
        </select>
      );

    case "date":
      return (
        <input
          type="date"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "datetime":
      return (
        <input
          type="datetime-local"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
    case "currency":
    case "percentage":
      return (
        <input
          type="number"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
          step={field.type === "currency" ? "0.01" : "any"}
        />
      );

    case "email":
      return (
        <input
          type="email"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
        />
      );

    case "url":
      return (
        <input
          type="url"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
        />
      );

    case "phone":
      return (
        <input
          type="tel"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
        />
      );

    default:
      return (
        <input
          type="text"
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
        />
      );
  }
}
