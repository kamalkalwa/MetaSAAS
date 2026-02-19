/**
 * Workflow Middleware
 *
 * Provides workflow validation for entity status transitions.
 *
 * - WorkflowError: thrown when a transition violates the workflow definition
 * - validateWorkflowTransition(): pure function that checks a single field
 *   transition against a workflow definition and the current record state
 *
 * The validation is extracted as a standalone function so it can be:
 *   1. Unit-tested without a database
 *   2. Called from any context (CRUD generator, custom actions, etc.)
 */

import type { SimpleWorkflowDefinition } from "@metasaas/contracts";

/**
 * Thrown when a status transition violates the entity's workflow definition.
 * Caught by the Action Bus and returned as a structured error response.
 */
export class WorkflowError extends Error {
  /** The field that was being transitioned */
  public readonly field: string;

  /** The current value of the field */
  public readonly from: string;

  /** The attempted new value */
  public readonly to: string;

  /** Valid transitions from the current state */
  public readonly validTargets: string[];

  constructor(
    field: string,
    from: string,
    to: string,
    validTargets: string[]
  ) {
    const message =
      `Invalid ${field} transition: "${from}" → "${to}" is not allowed. ` +
      `Valid transitions from "${from}": [${validTargets.join(", ")}]`;

    super(message);
    this.name = "WorkflowError";
    this.field = field;
    this.from = from;
    this.to = to;
    this.validTargets = validTargets;
  }
}

/**
 * The result of a successful workflow transition validation.
 * Includes the matched transition for downstream use (e.g., triggers).
 */
export interface WorkflowTransitionResult {
  /** The workflow that was validated */
  workflow: SimpleWorkflowDefinition;
  /** The previous state value */
  from: string;
  /** The new state value */
  to: string;
  /** Trigger names to fire after the transition (from transition.triggers) */
  triggers: string[];
}

/**
 * Validates a set of field changes against an entity's workflow definitions.
 *
 * Pure function — no database access. Requires the current record state
 * to be passed in for comparison.
 *
 * @param workflows - The entity's workflow definitions
 * @param data - The update payload (fields being changed)
 * @param currentRecord - The current state of the record
 * @returns Array of successful transition results (one per workflow field that changed)
 * @throws WorkflowError if a transition is invalid
 * @throws Error if a required field is missing for a transition
 */
export function validateWorkflowTransitions(
  workflows: SimpleWorkflowDefinition[],
  data: Record<string, unknown>,
  currentRecord: Record<string, unknown>
): WorkflowTransitionResult[] {
  const results: WorkflowTransitionResult[] = [];

  for (const workflow of workflows) {
    const newValue = data[workflow.field];

    // Skip if this workflow's field is not being changed
    if (newValue === undefined) {
      continue;
    }

    const currentValue = currentRecord[workflow.field] as string;

    // Check if this transition is allowed
    const allowed = workflow.transitions.some(
      (t) => t.from === currentValue && t.to === newValue
    );

    if (!allowed) {
      const validTargets = workflow.transitions
        .filter((t) => t.from === currentValue)
        .map((t) => t.to);

      throw new WorkflowError(
        workflow.field,
        currentValue,
        newValue as string,
        validTargets
      );
    }

    // Check required fields for this transition
    const transition = workflow.transitions.find(
      (t) => t.from === currentValue && t.to === newValue
    );

    if (transition?.requires) {
      for (const requiredField of transition.requires) {
        const value = data[requiredField] ?? currentRecord[requiredField];
        if (value === undefined || value === null || value === "") {
          throw new Error(
            `Cannot transition ${workflow.field} to "${newValue}": ` +
            `required field "${requiredField}" must have a value`
          );
        }
      }
    }

    results.push({
      workflow,
      from: currentValue,
      to: newValue as string,
      triggers: transition?.triggers ?? [],
    });
  }

  return results;
}
