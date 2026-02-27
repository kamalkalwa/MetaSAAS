/**
 * FieldInput — Shared Form Input Component
 *
 * Renders the appropriate HTML input element for a given field type.
 * Used by both the create and edit pages to ensure consistent behavior.
 *
 * This is the SINGLE source of truth for how field types map to inputs.
 * Adding a new field type? Add the case here — all pages get it automatically.
 */

import { useState, useRef } from "react";
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
  /**
   * For workflow-constrained enum fields: restricts the dropdown to only
   * these values plus the current value. Comes from the /transitions API.
   */
  allowedOptions?: string[];
  /**
   * For file fields: uploads a file and returns the stored key.
   * When provided, the file input handles upload automatically.
   */
  onFileUpload?: (file: File) => Promise<string>;
}

/**
 * Maps a FieldDefinition to the correct HTML input element.
 * Every field type in @metasaas/contracts should have a corresponding case here.
 * When relationshipOptions is provided, renders a dropdown for FK selection.
 */
export function FieldInput({ field, value, onChange, relationshipOptions, allowedOptions, onFileUpload }: FieldInputProps) {
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
    case "file":
      return (
        <FileUploadInput
          value={value}
          onChange={onChange}
          onFileUpload={onFileUpload}
          description={field.description}
        />
      );

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
            className="rounded border-input accent-primary"
          />
          <span className="text-sm">{field.description}</span>
        </label>
      );

    case "enum": {
      // When allowedOptions is provided (from the transitions API),
      // only show the current value + valid next states.
      const visibleOptions = allowedOptions
        ? field.options?.filter((opt) => opt === value || allowedOptions.includes(opt))
        : field.options;

      return (
        <select
          className={BASE_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {columnToLabel(field.name)}</option>
          {visibleOptions?.map((opt) => {
            const isCurrent = opt === value;
            const label = opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, " ");
            return (
              <option key={opt} value={opt} disabled={isCurrent && !!allowedOptions}>
                {label}{isCurrent && allowedOptions ? " (current)" : ""}
              </option>
            );
          })}
        </select>
      );
    }

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

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * File upload sub-component for the "file" field type.
 * Supports drag-and-drop, image preview, file type badges, and upload progress.
 */
function FileUploadInput({
  value,
  onChange,
  onFileUpload,
  description,
}: {
  value: string;
  onChange: (value: string) => void;
  onFileUpload?: (file: File) => Promise<string>;
  description?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadSize, setUploadSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Extract a display name from a file key like "contacts/avatar/uuid-photo.png" */
  const displayName = value ? value.split("/").pop() ?? value : null;
  const ext = displayName ? getFileExtension(displayName) : "";
  const isImage = IMAGE_EXTENSIONS.has(ext);

  async function processFile(file: File) {
    if (!onFileUpload) {
      onChange(file.name);
      return;
    }

    setUploading(true);
    setUploadName(file.name);
    setUploadSize(file.size);
    setError(null);
    try {
      const key = await onFileUpload(file);
      onChange(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadName(null);
      setUploadSize(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {uploading ? (
        /* Upload progress state */
        <div className="rounded-md border border-border p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="truncate">{uploadName}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatFileSize(uploadSize)}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      ) : value ? (
        /* File selected state */
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-3">
            {isImage ? (
              <div className="h-10 w-10 rounded border border-border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
            ) : (
              <div className="h-10 w-10 rounded border border-border bg-muted/50 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {ext || "?"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {ext && (
                <span className="inline-block mt-0.5 text-[10px] font-medium uppercase bg-muted px-1.5 py-0.5 rounded">
                  {ext}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
              <button
                type="button"
                className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                onClick={() => onChange("")}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / drag-and-drop state */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted-foreground mb-2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm text-muted-foreground">
            {dragOver ? "Drop file here" : description ?? "Drag & drop or click to choose file"}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
