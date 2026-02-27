/**
 * Field Types — Test Suite
 *
 * Validates that zodSchemaForFieldType generates correct Zod schemas
 * for every supported field type. This is the first line of defense —
 * if these schemas are wrong, invalid data enters the entire system.
 *
 * Coverage target: 100% of field types × required/optional × valid/invalid
 */

import { describe, it, expect } from "vitest";
import { zodSchemaForFieldType, FIELD_TYPES, type FieldType } from "./field-types.js";

// ---------------------------------------------------------------------------
// Text-based fields: text, rich_text, phone
// ---------------------------------------------------------------------------

describe("zodSchemaForFieldType", () => {
  describe("text fields (text, rich_text, phone)", () => {
    const textTypes: FieldType[] = ["text", "rich_text", "phone"];

    for (const type of textTypes) {
      describe(`type: ${type}`, () => {
        it("accepts a valid string when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          const result = schema.safeParse("hello world");
          expect(result.success).toBe(true);
        });

        it("rejects non-string values when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse(123).success).toBe(false);
          expect(schema.safeParse(true).success).toBe(false);
          expect(schema.safeParse({}).success).toBe(false);
        });

        it("accepts null and undefined when optional", () => {
          const schema = zodSchemaForFieldType(type, { required: false });
          expect(schema.safeParse(null).success).toBe(true);
          expect(schema.safeParse(undefined).success).toBe(true);
        });

        it("accepts empty string", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse("").success).toBe(true);
        });
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Email
  // ---------------------------------------------------------------------------

  describe("type: email", () => {
    it("accepts a valid email when required", () => {
      const schema = zodSchemaForFieldType("email", { required: true });
      expect(schema.safeParse("user@example.com").success).toBe(true);
    });

    it("rejects an invalid email when required", () => {
      const schema = zodSchemaForFieldType("email", { required: true });
      expect(schema.safeParse("not-an-email").success).toBe(false);
      expect(schema.safeParse("@missing-local.com").success).toBe(false);
      expect(schema.safeParse("missing-domain@").success).toBe(false);
    });

    it("accepts null when optional", () => {
      const schema = zodSchemaForFieldType("email", { required: false });
      expect(schema.safeParse(null).success).toBe(true);
    });

    it("rejects non-string values", () => {
      const schema = zodSchemaForFieldType("email", { required: true });
      expect(schema.safeParse(42).success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // URL
  // ---------------------------------------------------------------------------

  describe("type: url", () => {
    it("accepts a valid URL when required", () => {
      const schema = zodSchemaForFieldType("url", { required: true });
      expect(schema.safeParse("https://example.com").success).toBe(true);
      expect(schema.safeParse("http://localhost:3000").success).toBe(true);
    });

    it("rejects an invalid URL when required", () => {
      const schema = zodSchemaForFieldType("url", { required: true });
      expect(schema.safeParse("not-a-url").success).toBe(false);
      expect(schema.safeParse("ftp://").success).toBe(false);
    });

    it("accepts null when optional", () => {
      const schema = zodSchemaForFieldType("url", { required: false });
      expect(schema.safeParse(null).success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Numeric fields: number, currency, percentage
  // ---------------------------------------------------------------------------

  describe("numeric fields (number, currency, percentage)", () => {
    const numericTypes: FieldType[] = ["number", "currency", "percentage"];

    for (const type of numericTypes) {
      describe(`type: ${type}`, () => {
        it("accepts a valid number when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse(42).success).toBe(true);
          expect(schema.safeParse(0).success).toBe(true);
          expect(schema.safeParse(-10.5).success).toBe(true);
        });

        it("rejects non-number values when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse("42").success).toBe(false);
          expect(schema.safeParse(true).success).toBe(false);
          expect(schema.safeParse({}).success).toBe(false);
        });

        it("accepts null and undefined when optional", () => {
          const schema = zodSchemaForFieldType(type, { required: false });
          expect(schema.safeParse(null).success).toBe(true);
          expect(schema.safeParse(undefined).success).toBe(true);
        });

        it("rejects NaN", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          // Zod z.number() rejects NaN by default — this is correct behavior.
          // NaN should never enter the database as a valid number.
          const result = schema.safeParse(NaN);
          expect(result.success).toBe(false);
        });
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Date / DateTime
  // ---------------------------------------------------------------------------

  describe("date fields (date, datetime)", () => {
    const dateTypes: FieldType[] = ["date", "datetime"];

    for (const type of dateTypes) {
      describe(`type: ${type}`, () => {
        it("accepts an ISO datetime string when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse("2025-01-15T10:30:00.000Z").success).toBe(true);
        });

        it("accepts a Date object when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse(new Date()).success).toBe(true);
        });

        it("rejects a non-ISO string when required", () => {
          const schema = zodSchemaForFieldType(type, { required: true });
          expect(schema.safeParse("not-a-date").success).toBe(false);
          expect(schema.safeParse("01/15/2025").success).toBe(false);
        });

        it("accepts null when optional", () => {
          const schema = zodSchemaForFieldType(type, { required: false });
          expect(schema.safeParse(null).success).toBe(true);
        });
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Boolean
  // ---------------------------------------------------------------------------

  describe("type: boolean", () => {
    it("accepts true and false when required", () => {
      const schema = zodSchemaForFieldType("boolean", { required: true });
      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse(false).success).toBe(true);
    });

    it("rejects non-boolean values when required", () => {
      const schema = zodSchemaForFieldType("boolean", { required: true });
      expect(schema.safeParse(0).success).toBe(false);
      expect(schema.safeParse(1).success).toBe(false);
      expect(schema.safeParse("true").success).toBe(false);
      expect(schema.safeParse(null).success).toBe(false);
    });

    it("accepts null when optional", () => {
      const schema = zodSchemaForFieldType("boolean", { required: false });
      expect(schema.safeParse(null).success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Enum
  // ---------------------------------------------------------------------------

  describe("type: enum", () => {
    it("accepts a valid enum value when required", () => {
      const schema = zodSchemaForFieldType("enum", {
        required: true,
        enumValues: ["lead", "active", "inactive"],
      });
      expect(schema.safeParse("lead").success).toBe(true);
      expect(schema.safeParse("active").success).toBe(true);
    });

    it("rejects a value not in the enum list", () => {
      const schema = zodSchemaForFieldType("enum", {
        required: true,
        enumValues: ["lead", "active", "inactive"],
      });
      expect(schema.safeParse("unknown").success).toBe(false);
      expect(schema.safeParse("LEAD").success).toBe(false);
    });

    it("falls back to plain string when no enum values provided", () => {
      const schema = zodSchemaForFieldType("enum", { required: true });
      expect(schema.safeParse("anything").success).toBe(true);
    });

    it("falls back to plain string when enum values array is empty", () => {
      const schema = zodSchemaForFieldType("enum", {
        required: true,
        enumValues: [],
      });
      expect(schema.safeParse("anything").success).toBe(true);
    });

    it("accepts null when optional", () => {
      const schema = zodSchemaForFieldType("enum", {
        required: false,
        enumValues: ["a", "b"],
      });
      expect(schema.safeParse(null).success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // FIELD_TYPES completeness check
  // ---------------------------------------------------------------------------

  describe("FIELD_TYPES constant", () => {
    it("contains all 13 expected field types", () => {
      expect(FIELD_TYPES).toHaveLength(13);
      expect(FIELD_TYPES).toContain("text");
      expect(FIELD_TYPES).toContain("email");
      expect(FIELD_TYPES).toContain("phone");
      expect(FIELD_TYPES).toContain("url");
      expect(FIELD_TYPES).toContain("currency");
      expect(FIELD_TYPES).toContain("date");
      expect(FIELD_TYPES).toContain("datetime");
      expect(FIELD_TYPES).toContain("number");
      expect(FIELD_TYPES).toContain("percentage");
      expect(FIELD_TYPES).toContain("enum");
      expect(FIELD_TYPES).toContain("rich_text");
      expect(FIELD_TYPES).toContain("boolean");
      expect(FIELD_TYPES).toContain("file");
    });
  });

  // ---------------------------------------------------------------------------
  // Default behavior (no options)
  // ---------------------------------------------------------------------------

  describe("default behavior", () => {
    it("treats fields as optional when no options provided", () => {
      const schema = zodSchemaForFieldType("text");
      expect(schema.safeParse(undefined).success).toBe(true);
      expect(schema.safeParse(null).success).toBe(true);
    });

    it("handles unknown field type by falling back to text", () => {
      // Cast to bypass TypeScript — simulates a runtime edge case
      const schema = zodSchemaForFieldType("unknown_type" as FieldType);
      expect(schema.safeParse("some text").success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Security edge cases
  // ---------------------------------------------------------------------------

  describe("security: hostile inputs", () => {
    it("rejects SQL injection in text fields (schema accepts but DB layer must handle)", () => {
      const schema = zodSchemaForFieldType("text", { required: true });
      // Zod text schema accepts any string — SQL injection prevention
      // is the responsibility of the database layer (parameterized queries)
      const result = schema.safeParse("'; DROP TABLE contacts; --");
      expect(result.success).toBe(true);
      // This is EXPECTED — Zod validates type, not content.
      // The test documents that SQL injection prevention is NOT at this layer.
    });

    it("rejects script injection in email fields", () => {
      const schema = zodSchemaForFieldType("email", { required: true });
      expect(schema.safeParse("<script>alert('xss')</script>").success).toBe(false);
    });

    it("KNOWN GAP: Zod url() accepts javascript: protocol (security risk)", () => {
      const schema = zodSchemaForFieldType("url", { required: true });
      // Zod's z.string().url() validates URL format, not protocol safety.
      // "javascript:" is a valid URL scheme per RFC 3986.
      // SECURITY: The platform or UI layer MUST filter dangerous protocols.
      // See SECURITY.md for the mitigation plan.
      const result = schema.safeParse("javascript:alert('xss')");
      expect(result.success).toBe(true); // Documents the current behavior
    });
  });
});
