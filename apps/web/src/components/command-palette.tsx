"use client";

/**
 * Command Palette (Cmd+K)
 *
 * A keyboard-navigable search palette for quick navigation, record search,
 * and action shortcuts. Opens with Cmd+K / Ctrl+K.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette, type PaletteItem } from "@/lib/use-command-palette";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<PaletteItem["category"], string> = {
  page: "Pages",
  record: "Records",
  action: "Actions",
};

const CATEGORY_ORDER: PaletteItem["category"][] = ["page", "record", "action"];

function CategoryIcon({ category }: { category: PaletteItem["category"] }) {
  if (category === "page") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
        <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
      </svg>
    );
  }
  if (category === "record") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const {
    open,
    query,
    setQuery,
    allItems,
    selectedIndex,
    setSelectedIndex,
    searchingRecords,
    close,
  } = useCommandPalette();

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleSelect(item: PaletteItem) {
    close();
    if (item.onSelect) {
      item.onSelect();
    } else if (item.href) {
      router.push(item.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  // Group items by category
  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      items: allItems.filter((i) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  // Build a flat index for tracking selected item across groups
  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={close}
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[20%] mx-auto w-full max-w-lg z-50" role="dialog" aria-label="Command palette">
        <div className="rounded-lg border border-border bg-background shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, records, actions..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searchingRecords && (
              <svg className="animate-spin h-4 w-4 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2" role="listbox">
            {allItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {query ? "No results found" : "Start typing to search..."}
              </div>
            ) : (
              grouped.map((group, groupIndex) => (
                <div key={group.category} className={cn(groupIndex > 0 && "mt-1 border-t border-border pt-2")}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[group.category]}
                  </div>
                  {group.items.map((item) => {
                    const idx = flatIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-selected={isSelected}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                        )}
                      >
                        <CategoryIcon category={item.category} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {item.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
            <span><kbd className="border border-border rounded px-1 py-0.5 mr-0.5">↑↓</kbd> Navigate</span>
            <span><kbd className="border border-border rounded px-1 py-0.5 mr-0.5">↵</kbd> Select</span>
            <span><kbd className="border border-border rounded px-1 py-0.5 mr-0.5">esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
