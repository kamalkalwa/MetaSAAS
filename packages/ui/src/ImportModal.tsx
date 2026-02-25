/**
 * ImportModal — CSV upload dialog for entity records.
 * Parses CSV headers, maps them to entity field names/labels,
 * and calls `onImportRow` for each parsed row.
 */

import { useState, useEffect } from "react";
import { columnToLabel } from "./utils";
import type { FieldDefinition } from "@metasaas/contracts";

interface ImportModalProps {
  entityName: string;
  pluralName: string;
  fields: FieldDefinition[];
  onImportRow: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

/**
 * Parses a single CSV line, respecting quoted fields that may contain
 * commas, newlines, or escaped double-quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function ImportModal({
  entityName: _entityName,
  pluralName,
  fields,
  onImportRow,
  onClose,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !importing) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [importing, onClose]);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        setResult({ created: 0, errors: ["CSV must have a header row and at least one data row."] });
        setImporting(false);
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const fieldMap: Record<string, string> = {};
      for (const field of fields) {
        const label = columnToLabel(field.name).toLowerCase();
        fieldMap[label] = field.name;
        fieldMap[field.name.toLowerCase()] = field.name;
      }

      const mappedHeaders = headers.map((h) => fieldMap[h.toLowerCase()] ?? null);
      let created = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const data: Record<string, unknown> = {};

        for (let j = 0; j < mappedHeaders.length; j++) {
          const fieldName = mappedHeaders[j];
          if (!fieldName || !values[j]) continue;
          const fieldDef = fields.find((f) => f.name === fieldName);
          if (!fieldDef) continue;

          switch (fieldDef.type) {
            case "number":
            case "currency":
            case "percentage":
              data[fieldName] = parseFloat(values[j]);
              break;
            case "boolean":
              data[fieldName] = values[j].toLowerCase() === "true";
              break;
            default:
              data[fieldName] = values[j];
          }
        }

        try {
          await onImportRow(data);
          created++;
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Failed"}`);
        }
      }

      setResult({ created, errors });
    } catch (err) {
      setResult({ created: 0, errors: [err instanceof Error ? err.message : "Import failed"] });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => { if (!importing) onClose(); }}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Import {pluralName} from CSV</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file with headers matching field names or labels.
          Expected fields: {fields.map((f) => columnToLabel(f.name)).join(", ")}
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent mb-4"
        />
        {result && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              result.errors.length > 0
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success"
            }`}
          >
            {result.created > 0 && <p>Created {result.created} records.</p>}
            {result.errors.map((err, i) => (
              <p key={i} className="text-xs">{err}</p>
            ))}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
