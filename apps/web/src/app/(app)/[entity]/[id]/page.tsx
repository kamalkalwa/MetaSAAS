"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchEntityMeta,
  fetchEntityById,
  fetchAllEntityMeta,
  deleteEntity,
} from "@/lib/api-client";
import { formatValue, columnToLabel } from "@/lib/utils";
import type { EntityDefinition } from "@metasaas/contracts";

/**
 * Derives the camelCase FK field name from a belongsTo relationship.
 * e.g., { entity: "Warehouse", foreignKey: "warehouse_id" } → "warehouseId"
 */
function getFkFieldName(rel: { entity: string; foreignKey?: string }): string {
  if (rel.foreignKey) {
    return rel.foreignKey.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
  }
  return rel.entity.charAt(0).toLowerCase() + rel.entity.slice(1) + "Id";
}

/**
 * Entity Detail Page
 *
 * Dynamically renders a detail view for ANY entity record.
 * Resolves foreign key UUIDs to human-readable names via related entity lookups.
 *
 * URL: /contacts/:id, /companies/:id, etc.
 */
export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const entitySlug = params.entity as string;
  const recordId = params.id as string;

  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Maps FK field name → { label, slug, id } for display */
  const [relatedLabels, setRelatedLabels] = useState<
    Record<string, { label: string; slug: string; id: string }>
  >({});

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [meta, res, allMeta] = await Promise.all([
          fetchEntityMeta(entitySlug),
          fetchEntityById(entitySlug, recordId),
          fetchAllEntityMeta(),
        ]);
        setEntity(meta);

        if (!res.success || !res.data) {
          setError(res.error ?? `${meta.name} not found`);
          return;
        }
        setRecord(res.data);

        // Resolve FK fields to human-readable labels
        const belongsToRels =
          meta.relationships?.filter((r) => r.type === "belongsTo") ?? [];
        if (belongsToRels.length > 0) {
          const labels: typeof relatedLabels = {};
          for (const rel of belongsToRels) {
            const fkField = getFkFieldName(rel);
            const fkValue = res.data[fkField] as string | undefined;
            if (!fkValue) continue;
            const relatedEntity = allMeta.find((e) => e.name === rel.entity);
            if (!relatedEntity) continue;
            try {
              const relRes = await fetchEntityById(
                relatedEntity.pluralName.toLowerCase(),
                fkValue
              );
              if (relRes.success && relRes.data) {
                // Use the first text field as the display label
                const firstField = relatedEntity.fields[0]?.name;
                const label = firstField
                  ? String(relRes.data[firstField] ?? fkValue)
                  : fkValue;
                labels[fkField] = {
                  label,
                  slug: relatedEntity.pluralName.toLowerCase(),
                  id: fkValue,
                };
              }
            } catch {
              // Silently fall back to UUID display
            }
          }
          setRelatedLabels(labels);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug, recordId]);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteEntity(entitySlug, recordId);
      router.push(`/${entitySlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (error || !entity) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
        {error ?? "Not found"}
      </div>
    );
  }
  if (!record) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
        {entity.name} not found
      </div>
    );
  }

  // Build set of FK field names for rendering
  const fkFields = new Set(
    (entity.relationships ?? [])
      .filter((r) => r.type === "belongsTo")
      .map((r) => getFkFieldName(r))
  );

  return (
    <div>
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/${entitySlug}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {entity.pluralName}
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            {String(record[entity.fields[0]?.name] ?? entity.name)}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${entitySlug}/${recordId}/edit`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-4 py-2 rounded-md border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Field grid */}
      <div className="border border-border rounded-lg divide-y divide-border">
        {entity.fields.map((field) => (
          <div key={field.name} className="flex px-6 py-4">
            <div className="w-48 shrink-0">
              <span className="text-sm font-medium text-muted-foreground">
                {columnToLabel(field.name)}
              </span>
            </div>
            <div className="text-sm">{formatValue(record[field.name])}</div>
          </div>
        ))}

        {/* Relationship fields — show resolved names as links */}
        {(entity.relationships ?? [])
          .filter((r) => r.type === "belongsTo")
          .map((rel) => {
            const fkField = getFkFieldName(rel);
            const related = relatedLabels[fkField];
            const rawValue = record[fkField] as string | undefined;
            if (!rawValue) return null;
            return (
              <div key={fkField} className="flex px-6 py-4">
                <div className="w-48 shrink-0">
                  <span className="text-sm font-medium text-muted-foreground">
                    {rel.entity}
                  </span>
                </div>
                <div className="text-sm">
                  {related ? (
                    <Link
                      href={`/${related.slug}/${related.id}`}
                      className="text-primary hover:underline"
                    >
                      {related.label}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{rawValue}</span>
                  )}
                </div>
              </div>
            );
          })}

        {/* System fields */}
        <div className="flex px-6 py-4 bg-muted/30">
          <div className="w-48 shrink-0 text-sm font-medium text-muted-foreground">
            Created
          </div>
          <div className="text-sm text-muted-foreground">
            {formatValue(record.createdAt)}
          </div>
        </div>
        <div className="flex px-6 py-4 bg-muted/30">
          <div className="w-48 shrink-0 text-sm font-medium text-muted-foreground">
            Updated
          </div>
          <div className="text-sm text-muted-foreground">
            {formatValue(record.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
