"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchEntityMeta,
  fetchEntityById,
  fetchEntityList,
  fetchAllEntityMeta,
  fetchTransitions,
  updateEntity,
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
  /** Maps workflow field name → valid next states */
  const [transitions, setTransitions] = useState<Record<string, string[]>>({});
  const [transitioning, setTransitioning] = useState(false);
  /** Reverse relationships: entities whose belongsTo points at this entity */
  const [reverseRelated, setReverseRelated] = useState<
    { entity: EntityDefinition; fkField: string; records: Record<string, unknown>[] }[]
  >([]);

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

        // Find reverse relationships (other entities whose belongsTo points at this entity)
        const reverseResults: { entity: EntityDefinition; fkField: string; records: Record<string, unknown>[] }[] = [];
        for (const otherEntity of allMeta) {
          if (otherEntity.name === meta.name) continue;
          const belongsToThis = (otherEntity.relationships ?? []).find(
            (r) => r.type === "belongsTo" && r.entity === meta.name
          );
          if (belongsToThis) {
            const fkField = getFkFieldName(belongsToThis);
            try {
              const relResult = await fetchEntityList(
                otherEntity.pluralName.toLowerCase(),
                { [`filter.${fkField}`]: recordId }
              );
              if (relResult.success && relResult.data) {
                reverseResults.push({
                  entity: otherEntity,
                  fkField,
                  records: relResult.data.data,
                });
              }
            } catch { /* non-critical */ }
          }
        }
        setReverseRelated(reverseResults);

        // Fetch valid workflow transitions
        if (meta.workflows?.length) {
          try {
            const trans = await fetchTransitions(entitySlug, recordId);
            setTransitions(trans);
          } catch {
            // Non-critical — detail page still renders
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entitySlug, recordId]);

  /** Execute a workflow transition — update the field and refresh the page */
  async function handleTransition(field: string, newState: string) {
    setTransitioning(true);
    setError(null);
    try {
      const result = await updateEntity(entitySlug, recordId, { [field]: newState });
      if (result.success && result.data) {
        setRecord(result.data);
        // Refresh transitions for the new state
        try {
          const trans = await fetchTransitions(entitySlug, recordId);
          setTransitions(trans);
        } catch { /* non-critical */ }
      } else {
        setError(result.error ?? "Transition failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

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

      {/* Workflow transition buttons */}
      {Object.entries(transitions).map(([field, nextStates]) =>
        nextStates.length > 0 ? (
          <div key={field} className="mb-6 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {columnToLabel(field)}:
            </span>
            <span className="text-sm font-medium">
              {formatValue(record[field])}
            </span>
            <span className="text-sm text-muted-foreground">→</span>
            {nextStates.map((state) => (
              <button
                key={state}
                disabled={transitioning}
                onClick={() => handleTransition(field, state)}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                {state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ")}
              </button>
            ))}
          </div>
        ) : null
      )}

      {/* Field grid */}
      <div className="border border-border rounded-lg divide-y divide-border">
        {entity.fields.map((field) => {
          const nextStates = transitions[field.name];
          const hasTransitions = nextStates && nextStates.length > 0;
          return (
            <div key={field.name} className="flex px-6 py-4">
              <div className="w-48 shrink-0">
                <span className="text-sm font-medium text-muted-foreground">
                  {columnToLabel(field.name)}
                </span>
              </div>
              <div className="text-sm flex items-center gap-2">
                {formatValue(record[field.name])}
                {hasTransitions && (
                  <span className="text-xs text-muted-foreground">
                    (can transition)
                  </span>
                )}
              </div>
            </div>
          );
        })}

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

      {/* Related Records — reverse relationships (hasMany from other entities) */}
      {reverseRelated.map(({ entity: relEntity, fkField, records: relRecords }) => {
        const slug = relEntity.pluralName.toLowerCase();
        return (
          <div key={relEntity.name} className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {relEntity.pluralName}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({relRecords.length})
                </span>
              </h2>
              <Link
                href={`/${slug}/new?${fkField}=${recordId}`}
                className="text-sm text-primary hover:underline"
              >
                + Add {relEntity.name}
              </Link>
            </div>
            {relRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {relEntity.pluralName.toLowerCase()} linked to this {entity.name.toLowerCase()}.
              </p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      {relEntity.ui.listColumns.map((col) => (
                        <th
                          key={col}
                          className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                        >
                          {columnToLabel(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {relRecords.map((rr) => (
                      <tr
                        key={rr.id as string}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/${slug}/${rr.id}`)}
                      >
                        {relEntity.ui.listColumns.map((col) => (
                          <td key={col} className="px-4 py-3 text-sm">
                            {formatValue(rr[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
