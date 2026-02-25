"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  fetchEntityMeta,
  fetchAllEntityMeta,
  fetchEntityList,
  createEntity,
} from "@/lib/api-client";
import { columnToLabel } from "@/lib/utils";
import { FieldInput } from "@/components/field-input";
import { useToast, FormSkeleton } from "@metasaas/ui";
import type { EntityDefinition, FieldDefinition } from "@metasaas/contracts";
import type { RelationshipOption } from "@metasaas/ui";

/**
 * Derives the camelCase FK field name from a belongsTo relationship.
 */
function getFkFieldName(rel: { entity: string; foreignKey?: string }): string {
  if (rel.foreignKey) {
    return rel.foreignKey.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
  }
  return rel.entity.charAt(0).toLowerCase() + rel.entity.slice(1) + "Id";
}

/**
 * Entity Create Page
 *
 * Dynamically renders a create form for ANY entity.
 * Generates form fields from the entity's field definitions.
 * For belongsTo relationships, renders dropdown selectors with related entity records.
 *
 * URL: /contacts/new, /companies/new, etc.
 */
export default function EntityCreatePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entitySlug = params.entity as string;

  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** FK field name → dropdown options from related entity */
  const [relOptions, setRelOptions] = useState<
    Record<string, RelationshipOption[]>
  >({});
  /** Synthetic FieldDefinitions for FK fields (not in entity.fields) */
  const [fkFields, setFkFields] = useState<
    { field: FieldDefinition; fkName: string }[]
  >([]);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [meta, allMeta] = await Promise.all([
          fetchEntityMeta(entitySlug),
          fetchAllEntityMeta(),
        ]);
        setEntity(meta);

        // Initialize form with default values for declared fields
        const defaults: Record<string, string> = {};
        for (const field of meta.fields) {
          defaults[field.name] =
            field.defaultValue !== undefined ? String(field.defaultValue) : "";
        }

        // Load relationship options for belongsTo fields
        const belongsToRels =
          meta.relationships?.filter((r) => r.type === "belongsTo") ?? [];
        const opts: Record<string, RelationshipOption[]> = {};
        const syntheticFields: typeof fkFields = [];

        for (const rel of belongsToRels) {
          const fkName = getFkFieldName(rel);
          const relatedEntity = allMeta.find((e) => e.name === rel.entity);
          if (!relatedEntity) continue;

          // Fetch related records for the dropdown
          try {
            const listRes = await fetchEntityList(
              relatedEntity.pluralName.toLowerCase()
            );
            if (listRes.success && listRes.data) {
              const firstField = relatedEntity.fields[0]?.name ?? "id";
              opts[fkName] = listRes.data.data.map((row) => ({
                label: String(row[firstField] ?? row.id),
                value: String(row.id),
              }));
            }
          } catch {
            opts[fkName] = [];
          }

          // Create a synthetic field definition for the FK
          defaults[fkName] = "";
          syntheticFields.push({
            fkName,
            field: {
              name: fkName,
              type: "text",
              required: false,
              description: `Select the ${rel.entity} this belongs to`,
            },
          });
        }

        // Pre-fill FK fields from URL query params (e.g., ?companyId=uuid)
        for (const { fkName } of syntheticFields) {
          const prefill = searchParams.get(fkName);
          if (prefill) defaults[fkName] = prefill;
        }

        setFormData(defaults);
        setRelOptions(opts);
        setFkFields(syntheticFields);
      } catch (err) {
        setErrors({ _form: err instanceof Error ? err.message : "Failed to load" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entity) return;

    setSubmitting(true);
    setErrors({});

    // Convert form data to proper types
    const data: Record<string, unknown> = {};
    for (const field of entity.fields) {
      const raw = formData[field.name];
      if (raw === "" || raw === undefined) {
        if (field.required) {
          setErrors((prev) => ({
            ...prev,
            [field.name]: `${columnToLabel(field.name)} is required`,
          }));
          setSubmitting(false);
          return;
        }
        continue;
      }
      switch (field.type) {
        case "number":
        case "currency":
        case "percentage":
          data[field.name] = parseFloat(raw);
          break;
        case "boolean":
          data[field.name] = raw === "true";
          break;
        case "date":
        case "datetime":
          data[field.name] = new Date(raw).toISOString();
          break;
        default:
          data[field.name] = raw;
      }
    }

    // Include FK values from relationship dropdowns
    for (const { fkName } of fkFields) {
      const raw = formData[fkName];
      if (raw) data[fkName] = raw;
    }

    try {
      const result = await createEntity(entitySlug, data);
      if (result.success && result.data) {
        toast(`${entity.name} created`);
        router.push(`/${entitySlug}/${result.data.id}`);
      } else {
        setErrors({ _form: result.error ?? "Failed to create record" });
      }
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !entity) {
    return <FormSkeleton />;
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/${entitySlug}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {entity.pluralName}
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-6">
        New {entity.name}
      </h1>

      {errors._form && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errors._form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Declared entity fields */}
        {entity.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium mb-1.5">
              {columnToLabel(field.name)}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </label>
            <FieldInput
              field={field}
              value={formData[field.name] ?? ""}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, [field.name]: val }))
              }
            />
            {errors[field.name] && (
              <p className="text-xs text-destructive mt-1">
                {errors[field.name]}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {field.description}
            </p>
          </div>
        ))}

        {/* Relationship fields (belongsTo dropdowns) */}
        {fkFields.map(({ fkName, field }) => (
          <div key={fkName}>
            <label className="block text-sm font-medium mb-1.5">
              {columnToLabel(fkName)}
            </label>
            <FieldInput
              field={field}
              value={formData[fkName] ?? ""}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, [fkName]: val }))
              }
              relationshipOptions={relOptions[fkName]}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {field.description}
            </p>
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating..." : `Create ${entity.name}`}
          </button>
          <Link
            href={`/${entitySlug}`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
