/**
 * Validation Middleware
 *
 * Validates action input against the action's Zod schema
 * BEFORE the action executes. If validation fails, the action
 * is never called and a structured error is returned.
 */

import type { ActionDefinition } from "@metasaas/contracts";

/**
 * Validates input against the action's inputSchema.
 * Returns the parsed (and possibly transformed) input on success.
 * Throws a ValidationError on failure.
 */
export function validateInput(
  action: ActionDefinition,
  input: unknown
): unknown {
  const result = action.inputSchema.safeParse(input);

  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));

    throw new ValidationError(
      `Validation failed for action "${action.id}"`,
      fieldErrors
    );
  }

  return result.data;
}

/**
 * Structured validation error.
 * Contains per-field error details for form rendering.
 */
export class ValidationError extends Error {
  public readonly fieldErrors: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  constructor(
    message: string,
    fieldErrors: Array<{ field: string; message: string; code: string }>
  ) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}
