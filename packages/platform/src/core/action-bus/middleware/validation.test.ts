/**
 * Validation Middleware — Test Suite
 *
 * Validates that the Action Bus input validation:
 *   - Passes valid input through unchanged
 *   - Rejects invalid input with structured field errors
 *   - Handles edge cases (empty objects, extra fields, null)
 *
 * This is the gatekeeper — if validation is wrong, bad data reaches the database.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateInput, ValidationError } from "./validation.js";
import type { ActionDefinition } from "@metasaas/contracts";

/**
 * Factory: creates a minimal action with a given input schema for testing.
 */
function createActionWithSchema(
  inputSchema: z.ZodType
): ActionDefinition {
  return {
    id: "test.validate",
    name: "Test Validate",
    description: "Action for testing validation",
    inputSchema,
    outputSchema: z.any(),
    permissions: [{ effect: "allow" }],
    idempotent: true,
    execute: async (input) => input,
  };
}

// ---------------------------------------------------------------------------
// Valid input
// ---------------------------------------------------------------------------

describe("validateInput — valid input", () => {
  it("returns parsed data for valid input", () => {
    const action = createActionWithSchema(
      z.object({ name: z.string(), age: z.number() })
    );

    const result = validateInput(action, { name: "Alice", age: 30 });
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("strips unknown fields (Zod default behavior)", () => {
    const action = createActionWithSchema(z.object({ name: z.string() }));

    // Extra field 'evil' should be stripped by Zod's default behavior
    const result = validateInput(action, {
      name: "Alice",
      evil: "DROP TABLE users",
    });
    expect(result).toEqual({ name: "Alice" });
    expect((result as Record<string, unknown>).evil).toBeUndefined();
  });

  it("applies Zod transforms", () => {
    const action = createActionWithSchema(
      z.object({ email: z.string().email().toLowerCase() })
    );

    const result = validateInput(action, { email: "USER@EXAMPLE.COM" });
    expect((result as { email: string }).email).toBe("user@example.com");
  });
});

// ---------------------------------------------------------------------------
// Invalid input
// ---------------------------------------------------------------------------

describe("validateInput — invalid input", () => {
  it("throws ValidationError for missing required fields", () => {
    const action = createActionWithSchema(
      z.object({ name: z.string(), email: z.string().email() })
    );

    expect(() => validateInput(action, {})).toThrow(ValidationError);
  });

  it("includes field-level errors in the ValidationError", () => {
    const action = createActionWithSchema(
      z.object({ name: z.string(), email: z.string().email() })
    );

    try {
      validateInput(action, { name: 42, email: "not-an-email" });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;

      // Should have errors for both fields
      expect(validationError.fieldErrors.length).toBeGreaterThanOrEqual(2);

      // Each error should have field, message, and code
      for (const fieldError of validationError.fieldErrors) {
        expect(fieldError).toHaveProperty("field");
        expect(fieldError).toHaveProperty("message");
        expect(fieldError).toHaveProperty("code");
      }
    }
  });

  it("reports the correct field paths for nested objects", () => {
    const action = createActionWithSchema(
      z.object({
        data: z.object({
          name: z.string(),
        }),
      })
    );

    try {
      validateInput(action, { data: { name: 123 } });
      expect.fail("Should have thrown");
    } catch (error) {
      const validationError = error as ValidationError;
      const nameError = validationError.fieldErrors.find(
        (e) => e.field === "data.name"
      );
      expect(nameError).toBeDefined();
    }
  });

  it("includes the action ID in the error message", () => {
    const action = createActionWithSchema(z.object({ x: z.number() }));

    try {
      validateInput(action, { x: "not a number" });
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toContain("test.validate");
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("validateInput — edge cases", () => {
  it("handles null input", () => {
    const action = createActionWithSchema(z.object({ name: z.string() }));
    expect(() => validateInput(action, null)).toThrow(ValidationError);
  });

  it("handles undefined input", () => {
    const action = createActionWithSchema(z.object({ name: z.string() }));
    expect(() => validateInput(action, undefined)).toThrow(ValidationError);
  });

  it("handles empty object when all fields are optional", () => {
    const action = createActionWithSchema(
      z.object({ name: z.string().optional() })
    );

    const result = validateInput(action, {});
    expect(result).toEqual({});
  });

  it("handles array inputs", () => {
    const action = createActionWithSchema(z.array(z.string()));

    const result = validateInput(action, ["a", "b", "c"]);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// ValidationError class
// ---------------------------------------------------------------------------

describe("ValidationError", () => {
  it("is an instance of Error", () => {
    const error = new ValidationError("test", []);
    expect(error).toBeInstanceOf(Error);
  });

  it("has the correct name property", () => {
    const error = new ValidationError("test", []);
    expect(error.name).toBe("ValidationError");
  });

  it("preserves field errors", () => {
    const fieldErrors = [
      { field: "name", message: "Required", code: "invalid_type" },
    ];
    const error = new ValidationError("Validation failed", fieldErrors);
    expect(error.fieldErrors).toEqual(fieldErrors);
    expect(error.message).toBe("Validation failed");
  });
});
