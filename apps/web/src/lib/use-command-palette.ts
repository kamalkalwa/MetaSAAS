"use client";

/**
 * Command Palette Hook
 *
 * Manages the state and search logic for the Cmd+K command palette.
 * Provides page navigation, entity record search, and quick actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAllEntityMeta, fetchEntityList } from "@/lib/api-client";
import type { EntityDefinition } from "@metasaas/contracts";

export interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  category: "page" | "record" | "action";
  href?: string;
  onSelect?: () => void;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<EntityDefinition[]>([]);
  const [recordResults, setRecordResults] = useState<PaletteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchingRecords, setSearchingRecords] = useState(false);

  // Load entities once
  useEffect(() => {
    fetchAllEntityMeta().then(setEntities).catch(() => {});
  }, []);

  // Static page items
  const pageItems = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = [
      { id: "page-dashboard", label: "Dashboard", category: "page", href: "/dashboard" },
      { id: "page-activity", label: "Activity", category: "page", href: "/activity" },
      { id: "page-settings", label: "Settings", category: "page", href: "/settings" },
    ];
    for (const e of entities) {
      pages.push({
        id: `page-${e.pluralName}`,
        label: e.pluralName,
        description: `View all ${e.pluralName.toLowerCase()}`,
        category: "page",
        href: `/${e.pluralName.toLowerCase()}`,
      });
    }
    return pages;
  }, [entities]);

  // Action items
  const actionItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [];
    for (const e of entities) {
      actions.push({
        id: `action-create-${e.name}`,
        label: `Create new ${e.name}`,
        category: "action",
        href: `/${e.pluralName.toLowerCase()}/new`,
      });
    }
    return actions;
  }, [entities]);

  // Fuzzy filter
  const filterItems = useCallback(
    (items: PaletteItem[], q: string): PaletteItem[] => {
      if (!q) return items;
      const lower = q.toLowerCase();
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          item.description?.toLowerCase().includes(lower)
      );
    },
    []
  );

  // Search records when query is long enough
  useEffect(() => {
    if (!open || query.length < 2) {
      setRecordResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingRecords(true);
      try {
        const results: PaletteItem[] = [];
        // Search first 3 matching entities
        const matchingEntities = entities.filter((e) =>
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.pluralName.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);

        // If no entity matches the query, search all entities
        const toSearch = matchingEntities.length > 0 ? matchingEntities : entities.slice(0, 3);

        await Promise.all(
          toSearch.map(async (e) => {
            try {
              const res = await fetchEntityList(e.pluralName.toLowerCase(), {
                search: query,
                limit: "5",
              });
              if (res.data?.data) {
                for (const record of res.data.data) {
                  const nameField = e.fields.find((f) => f.name === "name")
                    ? "name"
                    : e.fields[0]?.name;
                  const label = nameField ? String(record[nameField] ?? record.id) : String(record.id);
                  results.push({
                    id: `record-${e.name}-${record.id}`,
                    label,
                    description: e.name,
                    category: "record",
                    href: `/${e.pluralName.toLowerCase()}/${record.id}`,
                  });
                }
              }
            } catch {
              // ignore individual entity search failures
            }
          })
        );
        setRecordResults(results);
      } finally {
        setSearchingRecords(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, query, entities]);

  // Combine and filter all items
  const allItems = useMemo(() => {
    const pages = filterItems(pageItems, query);
    const actions = filterItems(actionItems, query);
    return [...pages, ...recordResults, ...actions];
  }, [pageItems, actionItems, recordResults, query, filterItems]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length]);

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRecordResults([]);
  }, []);

  return {
    open,
    setOpen,
    query,
    setQuery,
    allItems,
    selectedIndex,
    setSelectedIndex,
    searchingRecords,
    close,
  };
}
