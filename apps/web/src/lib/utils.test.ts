/**
 * Utility Functions — Test Suite
 *
 * Validates the helper functions used throughout the web app.
 * These are pure functions with no side effects — ideal for unit testing.
 */

import { describe, it, expect } from "vitest";
import { cn, columnToLabel, formatValue } from "./utils";

// ---------------------------------------------------------------------------
// cn — Tailwind class merging
// ---------------------------------------------------------------------------

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("text-sm", "font-bold");
    expect(result).toContain("text-sm");
    expect(result).toContain("font-bold");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    const result = cn("text-sm", "text-lg");
    // tailwind-merge should resolve the conflict, keeping only the last
    expect(result).toBe("text-lg");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");
    expect(result).toContain("active");
  });

  it("filters out falsy values", () => {
    const result = cn("base", false, null, undefined, "end");
    expect(result).toBe("base end");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// columnToLabel — database column name to human-readable label
// ---------------------------------------------------------------------------

describe("columnToLabel", () => {
  it("converts snake_case to Title Case", () => {
    expect(columnToLabel("first_name")).toBe("First Name");
  });

  it("strips trailing _id suffix", () => {
    expect(columnToLabel("company_id")).toBe("Company");
  });

  it("handles single-word names", () => {
    expect(columnToLabel("name")).toBe("Name");
    expect(columnToLabel("email")).toBe("Email");
  });

  it("capitalizes each word", () => {
    expect(columnToLabel("created_at")).toBe("Created At");
  });

  it("handles camelCase input", () => {
    // camelCase is expanded into space-separated words
    expect(columnToLabel("firstName")).toBe("First Name");
    expect(columnToLabel("dueDate")).toBe("Due Date");
    expect(columnToLabel("estimatedHours")).toBe("Estimated Hours");
  });
});

// ---------------------------------------------------------------------------
// formatValue — display formatting for various data types
// ---------------------------------------------------------------------------

describe("formatValue", () => {
  it("returns em-dash for null", () => {
    expect(formatValue(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatValue(undefined)).toBe("—");
  });

  it("formats booleans as Yes/No", () => {
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(false)).toBe("No");
  });

  it("formats numbers with locale string", () => {
    const result = formatValue(1234567);
    // Locale formatting varies, but should contain the digits
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("567");
  });

  it("formats Date objects", () => {
    const date = new Date("2025-06-15T00:00:00Z");
    const result = formatValue(date);
    // Should contain date parts (varies by locale)
    expect(result).toBeTruthy();
    expect(result).not.toBe("—");
  });

  it("converts other types to string", () => {
    expect(formatValue("hello")).toBe("hello");
    expect(formatValue(0)).not.toBe("—"); // 0 is a valid number, not null
  });

  it("handles empty string (not null)", () => {
    // Empty string is truthy-ish in the function: String("") returns ""
    expect(formatValue("")).toBe("");
  });
});
