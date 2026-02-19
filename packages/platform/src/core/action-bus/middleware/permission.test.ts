/**
 * Permission Middleware — Test Suite
 *
 * Validates the RBAC evaluation engine:
 *   - callerTypes restriction
 *   - roles restriction
 *   - first-match-wins ordering
 *   - default deny when no rules or no match
 *   - ALLOW_ALL convenience rule
 *   - ownership placeholder (documented limitation)
 *   - PermissionError construction
 *
 * These tests ensure that "fail closed" holds:
 * if a rule is misconfigured or missing, access is denied.
 */

import { describe, it, expect } from "vitest";
import { checkPermission, PermissionError } from "./permission.js";
import { ALLOW_ALL } from "@metasaas/contracts";
import type { ActionDefinition, Caller, PermissionRule } from "@metasaas/contracts";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal ActionDefinition with the given permission rules. */
function actionWithRules(permissions: PermissionRule[]): ActionDefinition {
  return {
    id: "test.action",
    name: "Test Action",
    description: "For permission testing",
    inputSchema: z.object({}),
    outputSchema: z.unknown(),
    permissions,
    idempotent: true,
    execute: async () => ({}),
  };
}

/** Standard human admin caller */
const ADMIN: Caller = {
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["admin"],
  type: "human",
};

/** Human caller with viewer role only */
const VIEWER: Caller = {
  userId: "user-2",
  tenantId: "tenant-1",
  roles: ["viewer"],
  type: "human",
};

/** System caller (e.g., cron job, background worker) */
const SYSTEM_CALLER: Caller = {
  userId: "system",
  tenantId: "tenant-1",
  roles: ["admin"],
  type: "system",
};

/** AI agent caller */
const AI_CALLER: Caller = {
  userId: "agent-1",
  tenantId: "tenant-1",
  roles: ["agent"],
  type: "ai-agent",
};

/** Caller with no roles at all */
const NO_ROLES: Caller = {
  userId: "user-3",
  tenantId: "tenant-1",
  roles: [],
  type: "human",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkPermission", () => {
  // -- Default deny --------------------------------------------------------

  describe("default deny", () => {
    it("denies when permissions array is empty", () => {
      const action = actionWithRules([]);
      expect(checkPermission(action, ADMIN)).toBe(false);
    });

    it("denies when no rule matches the caller", () => {
      const action = actionWithRules([
        { callerTypes: ["webhook"], effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(false);
    });
  });

  // -- ALLOW_ALL -----------------------------------------------------------

  describe("ALLOW_ALL", () => {
    it("allows any caller type", () => {
      const action = actionWithRules([ALLOW_ALL]);

      expect(checkPermission(action, ADMIN)).toBe(true);
      expect(checkPermission(action, VIEWER)).toBe(true);
      expect(checkPermission(action, SYSTEM_CALLER)).toBe(true);
      expect(checkPermission(action, AI_CALLER)).toBe(true);
      expect(checkPermission(action, NO_ROLES)).toBe(true);
    });
  });

  // -- callerTypes ---------------------------------------------------------

  describe("callerTypes restriction", () => {
    it("allows when caller type is in the list", () => {
      const action = actionWithRules([
        { callerTypes: ["human"], effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });

    it("denies when caller type is not in the list", () => {
      const action = actionWithRules([
        { callerTypes: ["human"], effect: "allow" },
      ]);
      expect(checkPermission(action, SYSTEM_CALLER)).toBe(false);
    });

    it("allows when caller type is one of multiple accepted types", () => {
      const action = actionWithRules([
        { callerTypes: ["human", "ai-agent"], effect: "allow" },
      ]);
      expect(checkPermission(action, AI_CALLER)).toBe(true);
    });

    it("denies ai-agent when only system and webhook are allowed", () => {
      const action = actionWithRules([
        { callerTypes: ["system", "webhook"], effect: "allow" },
      ]);
      expect(checkPermission(action, AI_CALLER)).toBe(false);
    });
  });

  // -- roles ---------------------------------------------------------------

  describe("roles restriction", () => {
    it("allows when caller has a matching role", () => {
      const action = actionWithRules([
        { roles: ["admin"], effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });

    it("denies when caller does not have any matching role", () => {
      const action = actionWithRules([
        { roles: ["admin"], effect: "allow" },
      ]);
      expect(checkPermission(action, VIEWER)).toBe(false);
    });

    it("allows when caller has at least one matching role", () => {
      const action = actionWithRules([
        { roles: ["admin", "manager"], effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });

    it("denies when caller has no roles at all", () => {
      const action = actionWithRules([
        { roles: ["admin"], effect: "allow" },
      ]);
      expect(checkPermission(action, NO_ROLES)).toBe(false);
    });
  });

  // -- Combined conditions --------------------------------------------------

  describe("combined callerTypes + roles", () => {
    it("allows when both conditions are met", () => {
      const action = actionWithRules([
        { callerTypes: ["human"], roles: ["admin"], effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });

    it("denies when callerType matches but role does not", () => {
      const action = actionWithRules([
        { callerTypes: ["human"], roles: ["admin"], effect: "allow" },
      ]);
      expect(checkPermission(action, VIEWER)).toBe(false);
    });

    it("denies when role matches but callerType does not", () => {
      const action = actionWithRules([
        { callerTypes: ["human"], roles: ["admin"], effect: "allow" },
      ]);
      // SYSTEM_CALLER has "admin" role but is type "system"
      expect(checkPermission(action, SYSTEM_CALLER)).toBe(false);
    });
  });

  // -- First-match-wins ----------------------------------------------------

  describe("first-match-wins ordering", () => {
    it("deny rule before allow rule prevents access", () => {
      const action = actionWithRules([
        { roles: ["viewer"], effect: "deny" },
        { effect: "allow" },
      ]);
      expect(checkPermission(action, VIEWER)).toBe(false);
    });

    it("allow rule before deny rule grants access", () => {
      const action = actionWithRules([
        { roles: ["admin"], effect: "allow" },
        { effect: "deny" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });

    it("first matching rule wins even if later rules would grant access", () => {
      const action = actionWithRules([
        { callerTypes: ["human"], effect: "deny" },
        { roles: ["admin"], effect: "allow" },
      ]);
      // Admin is human → first rule matches → denied
      expect(checkPermission(action, ADMIN)).toBe(false);
    });

    it("skips non-matching rules and evaluates the next", () => {
      const action = actionWithRules([
        { callerTypes: ["system"], effect: "deny" },
        { roles: ["admin"], effect: "allow" },
      ]);
      // Admin is human → first rule skipped → second matches → allowed
      expect(checkPermission(action, ADMIN)).toBe(true);
    });
  });

  // -- Ownership placeholder ------------------------------------------------

  describe("ownership (v0 placeholder)", () => {
    it("ownership 'any' always passes", () => {
      const action = actionWithRules([
        { ownership: "any", effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });

    it("ownership 'own' currently passes (known v0 limitation)", () => {
      // In v1 this should only pass if caller.userId === record.ownerId
      // For now it always passes to avoid breaking CRUD actions
      const action = actionWithRules([
        { ownership: "own", effect: "allow" },
      ]);
      expect(checkPermission(action, ADMIN)).toBe(true);
    });
  });

  // -- Deny effect ----------------------------------------------------------

  describe("explicit deny rules", () => {
    it("deny rule with no conditions denies all callers", () => {
      const action = actionWithRules([{ effect: "deny" }]);
      expect(checkPermission(action, ADMIN)).toBe(false);
      expect(checkPermission(action, VIEWER)).toBe(false);
      expect(checkPermission(action, SYSTEM_CALLER)).toBe(false);
    });

    it("deny specific role, allow everyone else", () => {
      const action = actionWithRules([
        { roles: ["viewer"], effect: "deny" },
        { effect: "allow" },
      ]);
      expect(checkPermission(action, VIEWER)).toBe(false);
      expect(checkPermission(action, ADMIN)).toBe(true);
      expect(checkPermission(action, SYSTEM_CALLER)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// PermissionError
// ---------------------------------------------------------------------------

describe("PermissionError", () => {
  it("constructs with actionId and userId", () => {
    const err = new PermissionError("contact.delete", "user-42");
    expect(err.name).toBe("PermissionError");
    expect(err.message).toContain("user-42");
    expect(err.message).toContain("contact.delete");
  });

  it("is an instance of Error", () => {
    const err = new PermissionError("x", "y");
    expect(err).toBeInstanceOf(Error);
  });
});
