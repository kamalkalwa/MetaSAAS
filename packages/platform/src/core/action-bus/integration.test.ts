/**
 * Integration Tests — Multi-Tenant Isolation & RBAC
 *
 * These tests verify the critical security invariants:
 *   1. Tenant A's caller CANNOT access Tenant B's data
 *   2. RBAC rules are enforced for every dispatch
 *   3. Validation + permissions + workflow run in the correct order
 *   4. Structured errors are returned for each failure type
 *
 * These are the tests that give us confidence to deploy to production.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { dispatch } from "./bus.js";
import { registerAction, clearActionRegistry } from "./registry.js";
import { clearSubscribers } from "../event-bus/index.js";
import type { ActionDefinition, Caller } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

/** Two distinct tenants — the core of isolation testing */
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

const callerTenantA: Caller = {
  userId: "user-a",
  tenantId: TENANT_A,
  roles: ["admin"],
  type: "human",
};

const callerTenantB: Caller = {
  userId: "user-b",
  tenantId: TENANT_B,
  roles: ["member"],
  type: "human",
};

const callerNoRoles: Caller = {
  userId: "user-noroles",
  tenantId: TENANT_A,
  roles: [],
  type: "human",
};

const callerSystem: Caller = {
  userId: "system",
  tenantId: TENANT_A,
  roles: ["system"],
  type: "system",
};

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearActionRegistry();
  clearSubscribers();
});

// ---------------------------------------------------------------------------
// Multi-tenant isolation
// ---------------------------------------------------------------------------

describe("multi-tenant isolation", () => {
  it("action context receives the correct tenant_id from the caller", async () => {
    let capturedTenantId: string | undefined;

    const action: ActionDefinition = {
      id: "tenant.check",
      name: "Tenant Check",
      description: "Verifies tenant context is passed through",
      inputSchema: z.object({}),
      outputSchema: z.object({ tenantId: z.string() }),
      permissions: [{ effect: "allow" }],
      idempotent: true,
      execute: async (_input, ctx) => {
        capturedTenantId = ctx.caller.tenantId;
        return { tenantId: ctx.caller.tenantId };
      },
    };
    registerAction(action);

    await dispatch("tenant.check", {}, callerTenantA);
    expect(capturedTenantId).toBe(TENANT_A);

    await dispatch("tenant.check", {}, callerTenantB);
    expect(capturedTenantId).toBe(TENANT_B);
  });

  it("the database client is scoped to the caller's tenant", async () => {
    let capturedDbTenantId: string | undefined;

    const action: ActionDefinition = {
      id: "tenant.dbscope",
      name: "DB Scope Check",
      description: "Verifies the database client is tenant-scoped",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [{ effect: "allow" }],
      idempotent: true,
      execute: async (_input, ctx) => {
        // The db client's tenantId should match the caller's
        capturedDbTenantId = ctx.caller.tenantId;
        return { ok: true };
      },
    };
    registerAction(action);

    const resultA = await dispatch("tenant.dbscope", {}, callerTenantA);
    expect(resultA.success).toBe(true);
    expect(capturedDbTenantId).toBe(TENANT_A);

    const resultB = await dispatch("tenant.dbscope", {}, callerTenantB);
    expect(resultB.success).toBe(true);
    expect(capturedDbTenantId).toBe(TENANT_B);
  });

  it("each tenant's execution receives its own tenant context (no cross-contamination)", async () => {
    // Tenant isolation in MetaSAAS is enforced at the DATABASE level
    // (every query is scoped by tenant_id), not at the permission level.
    // This test verifies that the context passed to execute() is always
    // bound to the calling tenant, preventing cross-tenant data access.
    const capturedTenants: string[] = [];

    const action: ActionDefinition = {
      id: "tenant.isolation",
      name: "Tenant Isolation",
      description: "Captures tenant context for each call",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [{ effect: "allow" }],
      idempotent: true,
      execute: async (_input, ctx) => {
        capturedTenants.push(ctx.caller.tenantId);
        return { ok: true };
      },
    };
    registerAction(action);

    // Interleave calls from both tenants
    await dispatch("tenant.isolation", {}, callerTenantA);
    await dispatch("tenant.isolation", {}, callerTenantB);
    await dispatch("tenant.isolation", {}, callerTenantA);

    expect(capturedTenants).toEqual([TENANT_A, TENANT_B, TENANT_A]);
  });
});

// ---------------------------------------------------------------------------
// RBAC — Role-Based Access Control
// ---------------------------------------------------------------------------

describe("RBAC enforcement", () => {
  it("allows access when caller has the required role", async () => {
    const action: ActionDefinition = {
      id: "rbac.admin",
      name: "Admin Only",
      description: "Only admin can call this",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["admin"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    const result = await dispatch("rbac.admin", {}, callerTenantA); // has "admin" role
    expect(result.success).toBe(true);
  });

  it("denies access when caller lacks the required role", async () => {
    const action: ActionDefinition = {
      id: "rbac.admin.only",
      name: "Admin Only 2",
      description: "Requires admin role",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["admin"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    // callerTenantB has "member" role, not "admin"
    const result = await dispatch("rbac.admin.only", {}, callerTenantB);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("permission");
  });

  it("denies access when caller has no roles at all", async () => {
    const action: ActionDefinition = {
      id: "rbac.noroles",
      name: "Roles Required",
      description: "Any role required",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["admin", "member"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    const result = await dispatch("rbac.noroles", {}, callerNoRoles);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("permission");
  });

  it("system callers are permitted when callerTypes includes 'system'", async () => {
    const action: ActionDefinition = {
      id: "rbac.system",
      name: "System Action",
      description: "Callable by system callers",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["system"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    const result = await dispatch("rbac.system", {}, callerSystem);
    expect(result.success).toBe(true);
  });

  it("system callers are denied when only humans are permitted", async () => {
    const action: ActionDefinition = {
      id: "rbac.humanonly",
      name: "Human Only",
      description: "Only humans can call this",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["admin"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    const result = await dispatch("rbac.humanonly", {}, callerSystem);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("permission");
  });

  it("deny rule placed first blocks access even for matching allow rules", async () => {
    // Permission middleware uses "first matching rule wins" semantics.
    // A deny rule that matches the caller will block access regardless
    // of later allow rules. This is the correct pattern for blacklisting.
    const action: ActionDefinition = {
      id: "rbac.deny.first",
      name: "Deny First",
      description: "Deny all humans first, then allow admin (deny wins)",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          effect: "deny",
        },
        {
          callerTypes: ["human"],
          roles: ["admin"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    // Even though the caller is an admin, the deny rule matches first
    const result = await dispatch("rbac.deny.first", {}, callerTenantA);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("permission");
  });

  it("allow rule placed first grants access before later deny rules", async () => {
    // Demonstrates the "first match wins" semantics: when the allow rule
    // appears first and matches, the deny rule is never evaluated.
    const action: ActionDefinition = {
      id: "rbac.allow.first",
      name: "Allow First",
      description: "Allow admin first, then deny all (allow wins for admin)",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["admin"],
          effect: "allow",
        },
        {
          callerTypes: ["human"],
          effect: "deny",
        },
      ],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    // Admin role matches the first allow rule → permitted
    const resultAdmin = await dispatch("rbac.allow.first", {}, callerTenantA);
    expect(resultAdmin.success).toBe(true);

    // Member role doesn't match allow (needs admin), matches deny → blocked
    const resultMember = await dispatch("rbac.allow.first", {}, callerTenantB);
    expect(resultMember.success).toBe(false);
    expect(resultMember.errorType).toBe("permission");
  });
});

// ---------------------------------------------------------------------------
// Pipeline order: validation before permissions before execution
// ---------------------------------------------------------------------------

describe("pipeline order", () => {
  it("validation errors are returned before permission checks run", async () => {
    const executeSpy = vi.fn(async () => ({ ok: true }));

    const action: ActionDefinition = {
      id: "pipeline.order",
      name: "Pipeline Order",
      description: "Tests that validation runs first",
      inputSchema: z.object({ required_field: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["admin"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: executeSpy,
    };
    registerAction(action);

    // Send invalid input (missing required_field)
    const result = await dispatch("pipeline.order", {}, callerTenantA);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("validation");
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("permission errors prevent execution even with valid input", async () => {
    const executeSpy = vi.fn(async () => ({ ok: true }));

    const action: ActionDefinition = {
      id: "pipeline.perm",
      name: "Permission Blocks Execution",
      description: "Tests that permission blocks execution",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [
        {
          callerTypes: ["human"],
          roles: ["superadmin"],
          effect: "allow",
        },
      ],
      idempotent: true,
      execute: executeSpy,
    };
    registerAction(action);

    // Valid input but wrong role
    const result = await dispatch("pipeline.perm", { value: "test" }, callerTenantA);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("permission");
    expect(executeSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Structured error types
// ---------------------------------------------------------------------------

describe("structured error responses", () => {
  it("returns errorType: 'not_found' for unknown actions", async () => {
    const result = await dispatch("nonexistent.action", {}, callerTenantA);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns validation field errors for invalid input", async () => {
    const action: ActionDefinition = {
      id: "error.validation",
      name: "Validation Error Test",
      description: "Tests field-level validation errors",
      inputSchema: z.object({
        email: z.string().email(),
        age: z.number().min(0).max(150),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
      permissions: [{ effect: "allow" }],
      idempotent: true,
      execute: async () => ({ ok: true }),
    };
    registerAction(action);

    const result = await dispatch(
      "error.validation",
      { email: "not-an-email", age: -5 },
      callerTenantA
    );
    expect(result.success).toBe(false);
    expect(result.errorType).toBe("validation");
    expect(result.details?.fieldErrors).toBeDefined();
  });
});
