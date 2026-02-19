/**
 * Workflow Engine — Test Suite
 *
 * Validates the workflow validation logic:
 *   - Valid transitions succeed and return transition results
 *   - Invalid transitions throw WorkflowError with details
 *   - Terminal states reject all transitions
 *   - Required fields block transitions when missing
 *   - Non-workflow field changes pass through untouched
 *   - Multi-workflow entities (two state machines on different fields)
 *   - Trigger names are extracted from matching transitions
 *
 * The validateWorkflowTransitions() function is a pure function
 * with no database dependency, making it easy to test in isolation.
 */

import { describe, it, expect } from "vitest";
import {
  validateWorkflowTransitions,
  WorkflowError,
} from "./workflow.js";
import type { SimpleWorkflowDefinition } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Task-like lifecycle: todo → in_progress → review → done */
const TASK_WORKFLOW: SimpleWorkflowDefinition = {
  name: "taskLifecycle",
  field: "status",
  transitions: [
    { from: "todo", to: "in_progress" },
    { from: "in_progress", to: "review" },
    { from: "in_progress", to: "todo" },
    { from: "review", to: "done" },
    { from: "review", to: "in_progress" },
  ],
};

/** Workflow with required fields on a transition */
const DEAL_WORKFLOW: SimpleWorkflowDefinition = {
  name: "dealPipeline",
  field: "stage",
  transitions: [
    { from: "lead", to: "qualified", requires: ["contactId"] },
    { from: "qualified", to: "proposal" },
    { from: "proposal", to: "closed_won", requires: ["amount", "signedDate"] },
    { from: "proposal", to: "closed_lost" },
  ],
};

/** Workflow with triggers */
const WORKFLOW_WITH_TRIGGERS: SimpleWorkflowDefinition = {
  name: "orderLifecycle",
  field: "status",
  transitions: [
    { from: "pending", to: "confirmed", triggers: ["send_confirmation_email"] },
    { from: "confirmed", to: "shipped", triggers: ["notify_customer", "update_inventory"] },
    { from: "shipped", to: "delivered" },
  ],
};

/** Priority workflow (on a different field than status) */
const PRIORITY_WORKFLOW: SimpleWorkflowDefinition = {
  name: "priorityEscalation",
  field: "priority",
  transitions: [
    { from: "low", to: "medium" },
    { from: "medium", to: "high" },
    { from: "high", to: "critical", triggers: ["page_oncall"] },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateWorkflowTransitions", () => {
  // -- Valid transitions ---------------------------------------------------

  describe("valid transitions", () => {
    it("allows a valid transition and returns result", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW],
        { status: "in_progress" },
        { status: "todo" }
      );

      expect(results).toHaveLength(1);
      expect(results[0].from).toBe("todo");
      expect(results[0].to).toBe("in_progress");
      expect(results[0].workflow.name).toBe("taskLifecycle");
      expect(results[0].triggers).toEqual([]);
    });

    it("allows backward transitions when defined", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW],
        { status: "todo" },
        { status: "in_progress" }
      );

      expect(results).toHaveLength(1);
      expect(results[0].from).toBe("in_progress");
      expect(results[0].to).toBe("todo");
    });

    it("allows transition to review from in_progress", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW],
        { status: "review" },
        { status: "in_progress" }
      );

      expect(results[0].from).toBe("in_progress");
      expect(results[0].to).toBe("review");
    });
  });

  // -- Invalid transitions -------------------------------------------------

  describe("invalid transitions", () => {
    it("throws WorkflowError for an invalid transition", () => {
      expect(() =>
        validateWorkflowTransitions(
          [TASK_WORKFLOW],
          { status: "done" },
          { status: "todo" }
        )
      ).toThrow(WorkflowError);
    });

    it("includes field, from, to, and validTargets in the error", () => {
      try {
        validateWorkflowTransitions(
          [TASK_WORKFLOW],
          { status: "done" },
          { status: "todo" }
        );
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(WorkflowError);
        const wfErr = err as WorkflowError;
        expect(wfErr.field).toBe("status");
        expect(wfErr.from).toBe("todo");
        expect(wfErr.to).toBe("done");
        expect(wfErr.validTargets).toEqual(["in_progress"]);
      }
    });

    it("lists all valid targets from current state", () => {
      try {
        validateWorkflowTransitions(
          [TASK_WORKFLOW],
          { status: "done" },
          { status: "in_progress" }
        );
        expect.fail("Should have thrown");
      } catch (err) {
        const wfErr = err as WorkflowError;
        expect(wfErr.validTargets).toEqual(["review", "todo"]);
      }
    });
  });

  // -- Terminal states -----------------------------------------------------

  describe("terminal states", () => {
    it("rejects transitions from a terminal state (no outgoing transitions)", () => {
      expect(() =>
        validateWorkflowTransitions(
          [TASK_WORKFLOW],
          { status: "in_progress" },
          { status: "done" }
        )
      ).toThrow(WorkflowError);

      try {
        validateWorkflowTransitions(
          [TASK_WORKFLOW],
          { status: "in_progress" },
          { status: "done" }
        );
      } catch (err) {
        const wfErr = err as WorkflowError;
        expect(wfErr.validTargets).toEqual([]);
      }
    });
  });

  // -- Required fields -----------------------------------------------------

  describe("required fields", () => {
    it("allows transition when required field has a value in data", () => {
      const results = validateWorkflowTransitions(
        [DEAL_WORKFLOW],
        { stage: "qualified", contactId: "contact-123" },
        { stage: "lead" }
      );

      expect(results).toHaveLength(1);
      expect(results[0].to).toBe("qualified");
    });

    it("allows transition when required field exists in current record", () => {
      const results = validateWorkflowTransitions(
        [DEAL_WORKFLOW],
        { stage: "qualified" },
        { stage: "lead", contactId: "contact-123" }
      );

      expect(results).toHaveLength(1);
    });

    it("blocks transition when required field is missing", () => {
      expect(() =>
        validateWorkflowTransitions(
          [DEAL_WORKFLOW],
          { stage: "qualified" },
          { stage: "lead" }
        )
      ).toThrow(/required field "contactId"/);
    });

    it("blocks transition when required field is empty string", () => {
      expect(() =>
        validateWorkflowTransitions(
          [DEAL_WORKFLOW],
          { stage: "qualified", contactId: "" },
          { stage: "lead" }
        )
      ).toThrow(/required field "contactId"/);
    });

    it("blocks transition when required field is null", () => {
      expect(() =>
        validateWorkflowTransitions(
          [DEAL_WORKFLOW],
          { stage: "qualified", contactId: null },
          { stage: "lead" }
        )
      ).toThrow(/required field "contactId"/);
    });

    it("checks all required fields (multiple)", () => {
      expect(() =>
        validateWorkflowTransitions(
          [DEAL_WORKFLOW],
          { stage: "closed_won", amount: 5000 },
          { stage: "proposal" }
        )
      ).toThrow(/required field "signedDate"/);
    });

    it("passes when all required fields are present across data and record", () => {
      const results = validateWorkflowTransitions(
        [DEAL_WORKFLOW],
        { stage: "closed_won", amount: 5000 },
        { stage: "proposal", signedDate: "2026-01-01" }
      );

      expect(results).toHaveLength(1);
    });
  });

  // -- Non-workflow fields --------------------------------------------------

  describe("non-workflow field changes", () => {
    it("returns empty array when no workflow field is being changed", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW],
        { title: "New title", description: "Updated" },
        { status: "todo", title: "Old title" }
      );

      expect(results).toHaveLength(0);
    });

    it("only validates fields that match a workflow definition", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW],
        { title: "New title", status: "in_progress" },
        { status: "todo", title: "Old title" }
      );

      expect(results).toHaveLength(1);
      expect(results[0].to).toBe("in_progress");
    });
  });

  // -- Triggers ------------------------------------------------------------

  describe("triggers", () => {
    it("returns trigger names from the matched transition", () => {
      const results = validateWorkflowTransitions(
        [WORKFLOW_WITH_TRIGGERS],
        { status: "confirmed" },
        { status: "pending" }
      );

      expect(results[0].triggers).toEqual(["send_confirmation_email"]);
    });

    it("returns multiple triggers when defined", () => {
      const results = validateWorkflowTransitions(
        [WORKFLOW_WITH_TRIGGERS],
        { status: "shipped" },
        { status: "confirmed" }
      );

      expect(results[0].triggers).toEqual(["notify_customer", "update_inventory"]);
    });

    it("returns empty triggers when transition has none", () => {
      const results = validateWorkflowTransitions(
        [WORKFLOW_WITH_TRIGGERS],
        { status: "delivered" },
        { status: "shipped" }
      );

      expect(results[0].triggers).toEqual([]);
    });
  });

  // -- Multi-workflow entity ------------------------------------------------

  describe("multi-workflow entity", () => {
    it("validates both workflows when both fields change", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW, PRIORITY_WORKFLOW],
        { status: "in_progress", priority: "medium" },
        { status: "todo", priority: "low" }
      );

      expect(results).toHaveLength(2);
      expect(results[0].workflow.name).toBe("taskLifecycle");
      expect(results[0].to).toBe("in_progress");
      expect(results[1].workflow.name).toBe("priorityEscalation");
      expect(results[1].to).toBe("medium");
    });

    it("validates only the changed workflow field", () => {
      const results = validateWorkflowTransitions(
        [TASK_WORKFLOW, PRIORITY_WORKFLOW],
        { priority: "high" },
        { status: "todo", priority: "medium" }
      );

      expect(results).toHaveLength(1);
      expect(results[0].workflow.name).toBe("priorityEscalation");
    });

    it("fails if one workflow field has invalid transition", () => {
      expect(() =>
        validateWorkflowTransitions(
          [TASK_WORKFLOW, PRIORITY_WORKFLOW],
          { status: "done", priority: "medium" },
          { status: "todo", priority: "low" }
        )
      ).toThrow(WorkflowError);
    });
  });
});

// ---------------------------------------------------------------------------
// WorkflowError
// ---------------------------------------------------------------------------

describe("WorkflowError", () => {
  it("constructs with all fields", () => {
    const err = new WorkflowError("status", "todo", "done", ["in_progress"]);
    expect(err.name).toBe("WorkflowError");
    expect(err.field).toBe("status");
    expect(err.from).toBe("todo");
    expect(err.to).toBe("done");
    expect(err.validTargets).toEqual(["in_progress"]);
  });

  it("message describes the invalid transition", () => {
    const err = new WorkflowError("status", "todo", "done", ["in_progress"]);
    expect(err.message).toContain('"todo"');
    expect(err.message).toContain('"done"');
    expect(err.message).toContain("in_progress");
  });

  it("is an instance of Error", () => {
    const err = new WorkflowError("x", "a", "b", []);
    expect(err).toBeInstanceOf(Error);
  });
});
