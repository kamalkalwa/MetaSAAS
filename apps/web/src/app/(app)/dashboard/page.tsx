"use client";

import { useEffect, useState } from "react";
import { fetchAllEntityMeta, fetchEntityList } from "@/lib/api-client";
import type { EntityDefinition } from "@metasaas/contracts";
import Link from "next/link";

/**
 * Dashboard Page
 *
 * Shows an overview of all entities with record counts.
 * Auto-generated from the entity registry — no hardcoded entity names.
 */
export default function DashboardPage() {
  const [entities, setEntities] = useState<EntityDefinition[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAllEntityMeta()
      .then(async (ents) => {
        setEntities(ents);
        // Fetch counts for each entity
        const countEntries = await Promise.all(
          ents.map(async (e) => {
            try {
              const res = await fetchEntityList(e.pluralName.toLowerCase());
              return [e.name, res.data?.total ?? 0] as [string, number];
            } catch {
              return [e.name, 0] as [string, number];
            }
          })
        );
        setCounts(Object.fromEntries(countEntries));
      })
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((entity) => (
          <Link
            key={entity.name}
            href={`/${entity.pluralName.toLowerCase()}`}
            className="block p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className="text-sm text-muted-foreground font-medium">
              {entity.pluralName}
            </div>
            <div className="text-3xl font-bold mt-1">
              {counts[entity.name] ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {entity.description}
            </div>
          </Link>
        ))}
      </div>

      {entities.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No entities registered yet.</p>
          <p className="text-sm mt-2">
            Define entities in <code>packages/domain/src/entities/</code> and
            restart the server.
          </p>
        </div>
      )}
    </div>
  );
}
