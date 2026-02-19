/**
 * Workflow Definition
 *
 * A simple workflow defines how an entity moves through states.
 * (e.g., a Deal moves through pipeline stages, a Task moves through statuses)
 *
 * This covers LINEAR state machines. For complex workflows with
 * parallel branches or conditional logic, use the platform's
 * workflow engine directly (Layer 2).
 */

/**
 * A single transition in a workflow.
 */
export interface WorkflowTransition {
  /** The state being transitioned from */
  from: string;

  /** The state being transitioned to */
  to: string;

  /**
   * Field names that must have a value before this transition is allowed.
   * (e.g., transitioning to 'qualified' requires 'contactId' to be set)
   */
  requires?: string[];

  /**
   * Side effect names to trigger after this transition.
   * (e.g., "notify_team" when a deal moves to 'closed_won')
   */
  triggers?: string[];
}

/**
 * Defines a state machine workflow on an entity.
 */
export interface SimpleWorkflowDefinition {
  /** Workflow name (e.g., "pipeline", "taskLifecycle") */
  name: string;

  /** The entity field that holds the current state */
  field: string;

  /** Valid transitions between states */
  transitions: WorkflowTransition[];
}
