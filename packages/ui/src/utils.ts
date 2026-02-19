/**
 * Shared Utility Functions
 *
 * Platform-agnostic utilities used across all frontends.
 * These are the building blocks for UI components.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with conflict resolution.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", "px-8")
 * // → "py-2 px-8 bg-blue-500" (px-4 merged into px-8)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a camelCase or snake_case field name to a human-readable label.
 * Removes trailing "Id" or "_id" for foreign key fields.
 *
 * "firstName" → "First Name"
 * "company_id" → "Company"
 * "dueDate" → "Due Date"
 */
export function columnToLabel(column: string): string {
  return column
    .replace(/Id$/, "")
    .replace(/_id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → space separated
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a value for display based on its runtime type.
 * Handles null, undefined, Date, boolean, number, and string.
 *
 * @returns Human-readable string representation
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
