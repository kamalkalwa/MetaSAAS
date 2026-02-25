"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchEntityMeta,
  fetchAllEntityMeta,
  fetchEntityById,
  fetchEntityList,
  fetchTransitions,
  updateEntity,
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
 * Entity Edit Page
 *
 * Dynamically renders an edit form pre-populated with current values.
 * For belongsTo relationships, renders dropdown selectors with related entity records.
 *
 * URL: /contacts/:id/edit, /companies/:id/edit, etc.
 */
export default function EntityEditPage() {
  const params = useParams();
  const router = useRouter();
  const entitySlug = params.entity as string;
  const recordId = params.id as string;

  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [relOptions, setRelOptions] = useState<
    Record<string, RelationshipOption[]>
  >({});
  const [fkFields, setFkFields] = useState<
    { field: FieldDefinition; fkName: string }[]
  >([]);
  /** Maps workflow field name → allowed next states (from /transitions API) */
  const [transitions, setTransitions] = useState<Record<string, string[]>>({});
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [meta, res, allMeta] = await Promise.all([
          fetchEntityMeta(entitySlug),
          fetchEntityById(entitySlug, recordId),
          fetchAllEntityMeta(),
        ]);
        setEntity(meta);

        // Populate declared field values
        const data: Record<string, string> = {};
        if (res.success && res.data) {
          for (const field of meta.fields) {
            const val = res.data[field.name];
            data[field.name] =
              val !== null && val !== undefined ? String(val) : "";
          }
        }

        // Load relationship options and pre-select current FK values
        const belongsToRels =
          meta.relationships?.filter((r) => r.type === "belongsTo") ?? [];
        const opts: Record<string, RelationshipOption[]> = {};
        const syntheticFields: typeof fkFields = [];

        for (const rel of belongsToRels) {
          const fkName = getFkFieldName(rel);
          const relatedEntity = allMeta.find((e) => e.name === rel.entity);
          if (!relatedEntity) continue;

          // Pre-fill with current FK value
          if (res.success && res.data) {
            const val = res.data[fkName];
            data[fkName] = val ? String(val) : "";
          }

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

        setFormData(data);
        setRelOptions(opts);
        setFkFields(syntheticFields);

        // Fetch valid workflow transitions for this record
        if (meta.workflows?.length) {
          try {
            const trans = await fetchTransitions(entitySlug, recordId);
            setTransitions(trans);
          } catch {
            // Non-critical — edit form still works, just shows all options
          }
        }
      } catch (err) {
        setErrors({
          _form: err instanceof Error ? err.message : "Failed to load",
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug, recordId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entity) return;

    setSubmitting(true);
    setErrors({});

    const data: Record<string, unknown> = {};
    for (const field of entity.fields) {
      const raw = formData[field.name];
      if (raw === "" || raw === undefined) continue;
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
      const result = await updateEntity(entitySlug, recordId, data);
      if (result.success) {
        toast("Changes saved");
        router.push(`/${entitySlug}/${recordId}`);
      } else {
        setErrors({ _form: result.error ?? "Failed to update" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      // Make workflow errors human-readable
      const workflowMatch = msg.match(/Invalid transition.*from "(.+)" to "(.+)"/);
      if (workflowMatch) {
        setErrors({
          _form: `Can't change status from "${workflowMatch[1]}" to "${workflowMatch[2]}". Use one of the available transitions.`,
        });
      } else {
        setErrors({ _form: msg });
      }
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
        href={`/${entitySlug}/${recordId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-6">
        Edit {entity.name}
      </h1>

      {errors._form && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errors._form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Declared entity fields */}
        {entity.fields.map((field) => {
          const allowed = transitions[field.name];
          return (
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
                allowedOptions={allowed}
              />
              {allowed && allowed.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No further transitions available from this state.
                </p>
              )}
            </div>
          );
        })}

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
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/${entitySlug}/${recordId}`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
