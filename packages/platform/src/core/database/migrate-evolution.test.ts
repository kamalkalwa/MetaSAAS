/**
 * Schema Evolution — Type Change Classification Tests
 *
 * Validates the classifyTypeChange() function that determines
 * whether a column type change is safe (automatic) or unsafe
 * (requires manual intervention).
 *
 * Safe conversions are widening: no data loss possible.
 * Unsafe conversions are narrowing: data may be truncated or fail to cast.
 */

import { describe, it, expect } from "vitest";
import { classifyTypeChange } from "./migrate.js";
import type { ColumnInfo } from "./migrate.js";

// ---------------------------------------------------------------------------
// Helper: create ColumnInfo with defaults
// ---------------------------------------------------------------------------

function col(dataType: string, maxLength: number | null = null): ColumnInfo {
  return { name: "test_col", dataType, maxLength };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("classifyTypeChange", () => {
  // -- Same type -----------------------------------------------------------

  describe("same type (no change needed)", () => {
    it("TEXT → TEXT is same type", () => {
      const result = classifyTypeChange(col("text"), "TEXT");
      expect(result.safe).toBe(true);
      expect(result.reason).toBe("Same type");
    });

    it("NUMERIC → NUMERIC is same type", () => {
      const result = classifyTypeChange(col("numeric"), "NUMERIC");
      expect(result.safe).toBe(true);
      expect(result.reason).toBe("Same type");
    });

    it("BOOLEAN → BOOLEAN is same type", () => {
      const result = classifyTypeChange(col("boolean"), "BOOLEAN");
      expect(result.safe).toBe(true);
      expect(result.reason).toBe("Same type");
    });

    it("TIMESTAMPTZ → TIMESTAMPTZ is same type", () => {
      const result = classifyTypeChange(col("timestamp with time zone"), "TIMESTAMPTZ");
      expect(result.safe).toBe(true);
      expect(result.reason).toBe("Same type");
    });

    it("VARCHAR(255) → VARCHAR(255) is same type", () => {
      const result = classifyTypeChange(col("character varying", 255), "VARCHAR(255)");
      expect(result.safe).toBe(true);
      expect(result.reason).toBe("Same type");
    });
  });

  // -- Safe conversions (widening) -----------------------------------------

  describe("safe conversions (widening)", () => {
    it("VARCHAR(255) → TEXT is safe", () => {
      const result = classifyTypeChange(col("character varying", 255), "TEXT");
      expect(result.safe).toBe(true);
      expect(result.reason).toContain("safe");
    });

    it("VARCHAR(255) → VARCHAR(512) is safe (widening)", () => {
      const result = classifyTypeChange(col("character varying", 255), "VARCHAR(512)");
      expect(result.safe).toBe(true);
      expect(result.reason).toContain("Widening");
    });

    it("NUMERIC → TEXT is safe", () => {
      const result = classifyTypeChange(col("numeric"), "TEXT");
      expect(result.safe).toBe(true);
    });

    it("NUMERIC → VARCHAR(512) is safe", () => {
      const result = classifyTypeChange(col("numeric"), "VARCHAR(512)");
      expect(result.safe).toBe(true);
    });

    it("BOOLEAN → TEXT is safe", () => {
      const result = classifyTypeChange(col("boolean"), "TEXT");
      expect(result.safe).toBe(true);
    });

    it("TIMESTAMPTZ → TEXT is safe", () => {
      const result = classifyTypeChange(col("timestamp with time zone"), "TEXT");
      expect(result.safe).toBe(true);
    });
  });

  // -- Unsafe conversions (narrowing/lossy) --------------------------------

  describe("unsafe conversions (narrowing/lossy)", () => {
    it("TEXT → VARCHAR(255) is unsafe (may truncate)", () => {
      const result = classifyTypeChange(col("text"), "VARCHAR(255)");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("truncate");
    });

    it("VARCHAR(512) → VARCHAR(255) is unsafe (narrowing)", () => {
      const result = classifyTypeChange(col("character varying", 512), "VARCHAR(255)");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("Narrowing");
    });

    it("TEXT → BOOLEAN is unsafe", () => {
      const result = classifyTypeChange(col("text"), "BOOLEAN");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("BOOLEAN");
    });

    it("VARCHAR → BOOLEAN is unsafe", () => {
      const result = classifyTypeChange(col("character varying", 255), "BOOLEAN");
      expect(result.safe).toBe(false);
    });

    it("VARCHAR → NUMERIC is unsafe", () => {
      const result = classifyTypeChange(col("character varying", 255), "NUMERIC");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("NUMERIC");
    });

    it("TEXT → TIMESTAMPTZ is unsafe", () => {
      const result = classifyTypeChange(col("text"), "TIMESTAMPTZ");
      expect(result.safe).toBe(false);
    });

    it("VARCHAR → TIMESTAMPTZ is unsafe", () => {
      const result = classifyTypeChange(col("character varying", 255), "TIMESTAMPTZ");
      expect(result.safe).toBe(false);
    });
  });

  // -- Edge cases ----------------------------------------------------------

  describe("edge cases", () => {
    it("UUID → UUID is same type", () => {
      const result = classifyTypeChange(col("uuid"), "UUID");
      expect(result.safe).toBe(true);
      expect(result.reason).toBe("Same type");
    });

    it("unknown source type defaults to unsafe", () => {
      const result = classifyTypeChange(col("jsonb"), "TEXT");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("not a recognized");
    });
  });
});
