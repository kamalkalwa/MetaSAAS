/**
 * Field Types
 *
 * Defines the available field types for entity definitions and their
 * corresponding Zod validation schemas. This is the single source of truth
 * for what types of data an entity field can hold.
 */

import { z } from "zod";

/**
 * All supported field types.
 * Each maps to a specific database column type, UI input component, and Zod validator.
 */
export const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "url",
  "currency",
  "date",
  "datetime",
  "number",
  "percentage",
  "enum",
  "rich_text",
  "boolean",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Returns the Zod schema for a given field type.
 * Used by the Action Bus validation middleware and form generation.
 */
export function zodSchemaForFieldType(
  type: FieldType,
  options?: { required?: boolean; enumValues?: string[] }
): z.ZodTypeAny {
  const required = options?.required ?? false;

  let schema: z.ZodTypeAny;

  switch (type) {
    case "text":
    case "rich_text":
    case "phone":
      schema = z.string();
      break;
    case "email":
      schema = z.string().email();
      break;
    case "url":
      schema = z.string().url();
      break;
    case "currency":
    case "number":
    case "percentage":
      schema = z.number();
      break;
    case "date":
    case "datetime":
      schema = z.string().datetime().or(z.date());
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "enum":
      if (options?.enumValues && options.enumValues.length > 0) {
        schema = z.enum(options.enumValues as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
    default:
      schema = z.string();
  }

  return required ? schema : schema.optional().nullable();
}
