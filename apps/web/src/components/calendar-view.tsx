"use client";

/**
 * Calendar View Component
 *
 * Renders records in a month-grid calendar, anchored on a date field
 * (e.g., "dueDate"). Records appear as badges on the date they correspond to.
 *
 * Features:
 *   - Month navigation (previous/next)
 *   - Records rendered as clickable badges
 *   - Click a record to navigate to the detail view
 *   - Shows records from all visible days (including overflow from adjacent months)
 *
 * Usage:
 *   <CalendarView
 *     entity={entity}
 *     rows={rows}
 *     dateField="dueDate"
 *     entitySlug="tasks"
 *   />
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatValue } from "@/lib/utils";
import type { EntityDefinition } from "@metasaas/contracts";

interface CalendarViewProps {
  /** The entity definition (for field metadata) */
  entity: EntityDefinition;
  /** All records to display */
  rows: Record<string, unknown>[];
  /** The date field to anchor records on (e.g., "dueDate") */
  dateField: string;
  /** URL slug for navigation (e.g., "tasks") */
  entitySlug: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Normalizes a date value to YYYY-MM-DD string for grouping */
function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function CalendarView({ entity, rows, dateField, entitySlug }: CalendarViewProps) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Build record map: date key → records
  const recordsByDate = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = toDateKey(row[dateField]);
    if (!key) continue;
    if (!recordsByDate.has(key)) recordsByDate.set(key, []);
    recordsByDate.get(key)!.push(row);
  }

  // Build calendar grid days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays: { day: number; inMonth: boolean; dateKey: string }[] = [];

  // Previous month overflow
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthLast - i;
    const dt = new Date(year, month - 1, d);
    calendarDays.push({
      day: d,
      inMonth: false,
      dateKey: dt.toISOString().slice(0, 10),
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    calendarDays.push({
      day: d,
      inMonth: true,
      dateKey: dt.toISOString().slice(0, 10),
    });
  }

  // Next month overflow (fill to 42 cells for 6 rows)
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    const dt = new Date(year, month + 1, d);
    calendarDays.push({
      day: d,
      inMonth: false,
      dateKey: dt.toISOString().slice(0, 10),
    });
  }

  // Navigation
  const goBack = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goForward = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const titleField = entity.ui.listColumns[0];
  const todayKey = now.toISOString().slice(0, 10);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="px-2 py-1 border border-border rounded text-sm hover:bg-muted transition-colors"
          >
            &larr;
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1 border border-border rounded text-sm hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={goForward}
            className="px-2 py-1 border border-border rounded text-sm hover:bg-muted transition-colors"
          >
            &rarr;
          </button>
        </div>
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </h2>
      </div>

      {/* Calendar grid */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2 border-b border-border"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => {
            const items = recordsByDate.get(cell.dateKey) ?? [];
            const isToday = cell.dateKey === todayKey;

            return (
              <div
                key={idx}
                className={`min-h-[100px] p-1 border-b border-r border-border ${
                  cell.inMonth ? "bg-card" : "bg-muted/20"
                }`}
              >
                {/* Day number */}
                <div className={`text-xs mb-1 px-1 ${
                  isToday
                    ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center font-bold"
                    : cell.inMonth
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}>
                  {cell.day}
                </div>

                {/* Record badges */}
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((row) => (
                    <div
                      key={row.id as string}
                      onClick={() => router.push(`/${entitySlug}/${row.id}`)}
                      className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary/20 transition-colors"
                      title={formatValue(row[titleField])}
                    >
                      {formatValue(row[titleField])}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
