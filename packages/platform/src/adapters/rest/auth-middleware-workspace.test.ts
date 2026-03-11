/**
 * Auth Middleware – X-Workspace-Id Header Tests
 *
 * Tests that the auth middleware correctly handles workspace switching
 * via the X-Workspace-Id request header:
 *   - Overrides tenantId and roles when the user is a workspace member
 *   - Keeps the original tenantId when the user is not a member
 *   - Does not call getDatabase when the header is absent
 *   - Silently falls back when getDatabase throws (DB not ready)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { authMiddleware } from "./auth-middleware.js";
import { setAuthProvider } from "../../auth/index.js";

// ── Mock getDatabase ────────────────────────────────────────────────────
const mockUnsafe = vi.fn();
const mockGetDatabase = vi.fn(() => ({
  sql: { unsafe: mockUnsafe },
}));

vi.mock("../../core/database/connection.js", () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));

// ── Helpers ─────────────────────────────────────────────────────────────
function mockRequest(
  overrides: Partial<{
    url: string;
    method: string;
    headers: Record<string, string>;
  }> = {}
) {
  return {
    url: overrides.url ?? "/api/tasks",
    method: overrides.method ?? "GET",
    headers: overrides.headers ?? {},
    caller: undefined,
  } as any;
}

function mockReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: any) {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

const acceptAllProvider = {
  verifyToken: vi.fn().mockImplementation(() =>
    Promise.resolve({
      userId: "test-user",
      tenantId: "test-tenant",
      roles: ["admin"],
      type: "human" as const,
    })
  ),
  getPublicConfig: () => ({ provider: "mock" }),
};

// ── Tests ───────────────────────────────────────────────────────────────
describe("authMiddleware – X-Workspace-Id handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthProvider(acceptAllProvider);
  });

  it("overrides tenantId and roles when user is a workspace member", async () => {
    mockUnsafe.mockResolvedValue([{ role: "editor" }]);

    const req = mockRequest({
      url: "/api/tasks",
      headers: {
        authorization: "Bearer valid-token",
        "x-workspace-id": "workspace-42",
      },
    });
    const reply = mockReply();

    await authMiddleware(req, reply);

    expect(reply.statusCode).toBe(200);
    expect(req.caller).toBeDefined();
    expect(req.caller.tenantId).toBe("workspace-42");
    expect(req.caller.roles).toEqual(["editor"]);
    expect(mockGetDatabase).toHaveBeenCalled();
    expect(mockUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("workspace_members"),
      ["workspace-42", "test-user"]
    );
  });

  it("keeps original tenantId when user is not a workspace member", async () => {
    mockUnsafe.mockResolvedValue([]); // no rows → not a member

    const req = mockRequest({
      url: "/api/tasks",
      headers: {
        authorization: "Bearer valid-token",
        "x-workspace-id": "workspace-99",
      },
    });
    const reply = mockReply();

    await authMiddleware(req, reply);

    expect(reply.statusCode).toBe(200);
    expect(req.caller).toBeDefined();
    expect(req.caller.tenantId).toBe("test-tenant");
    expect(req.caller.roles).toEqual(["admin"]);
  });

  it("does not call getDatabase when X-Workspace-Id is absent", async () => {
    const req = mockRequest({
      url: "/api/tasks",
      headers: { authorization: "Bearer valid-token" },
    });
    const reply = mockReply();

    await authMiddleware(req, reply);

    expect(reply.statusCode).toBe(200);
    expect(req.caller).toBeDefined();
    expect(req.caller.tenantId).toBe("test-tenant");
    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  it("silently falls back to default tenantId when getDatabase throws", async () => {
    mockGetDatabase.mockImplementationOnce(() => {
      throw new Error("DB not ready");
    });

    const req = mockRequest({
      url: "/api/tasks",
      headers: {
        authorization: "Bearer valid-token",
        "x-workspace-id": "workspace-broken",
      },
    });
    const reply = mockReply();

    await authMiddleware(req, reply);

    expect(reply.statusCode).toBe(200);
    expect(req.caller).toBeDefined();
    expect(req.caller.tenantId).toBe("test-tenant");
    expect(req.caller.roles).toEqual(["admin"]);
  });
});
