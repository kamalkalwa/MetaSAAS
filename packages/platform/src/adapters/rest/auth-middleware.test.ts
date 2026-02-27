/**
 * Auth Middleware Tests
 *
 * Tests that the Fastify authentication middleware correctly:
 *   - Bypasses auth for public routes
 *   - Returns 401 for missing/invalid tokens on protected routes
 *   - Attaches caller to request on valid auth
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { authMiddleware } from "./auth-middleware.js";
import { setAuthProvider } from "../../auth/index.js";

// Create mock request and reply objects
function mockRequest(overrides: Partial<{ url: string; method: string; headers: Record<string, string> }> = {}) {
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

// DevAuthProvider-like mock that accepts anything
const acceptAllProvider = {
  verifyToken: vi.fn().mockResolvedValue({
    userId: "test-user",
    tenantId: "test-tenant",
    roles: ["admin"],
    type: "human" as const,
  }),
  getPublicConfig: () => ({ provider: "mock" }),
};

// Strict mock that rejects all tokens
const rejectAllProvider = {
  verifyToken: vi.fn().mockResolvedValue(null),
  getPublicConfig: () => ({ provider: "mock" }),
};

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("public routes", () => {
    beforeEach(() => {
      setAuthProvider(rejectAllProvider);
    });

    it("bypasses /health", async () => {
      const req = mockRequest({ url: "/health" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
      expect(rejectAllProvider.verifyToken).not.toHaveBeenCalled();
    });

    it("bypasses /api/health", async () => {
      const req = mockRequest({ url: "/api/health" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("bypasses /api/meta/entities", async () => {
      const req = mockRequest({ url: "/api/meta/entities" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("bypasses /api/meta/entities/:name", async () => {
      const req = mockRequest({ url: "/api/meta/entities/tasks" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("bypasses /api/auth/config", async () => {
      const req = mockRequest({ url: "/api/auth/config" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("bypasses /api/billing/plans GET", async () => {
      const req = mockRequest({ url: "/api/billing/plans", method: "GET" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("bypasses /api/billing/webhook", async () => {
      const req = mockRequest({ url: "/api/billing/webhook" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("bypasses OPTIONS preflight", async () => {
      const req = mockRequest({ url: "/api/tasks", method: "OPTIONS" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it("strips query params when matching public routes", async () => {
      const req = mockRequest({ url: "/api/meta/entities?format=json" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(200);
    });
  });

  describe("protected routes", () => {
    describe("with reject-all provider", () => {
      beforeEach(() => {
        setAuthProvider(rejectAllProvider);
      });

      it("returns 401 without Authorization header", async () => {
        const req = mockRequest({ url: "/api/tasks" });
        const reply = mockReply();
        await authMiddleware(req, reply);
        expect(reply.statusCode).toBe(401);
        expect(reply.body.error).toContain("Authentication required");
      });

      it("returns 401 with invalid token", async () => {
        const req = mockRequest({
          url: "/api/tasks",
          headers: { authorization: "Bearer invalid-token" },
        });
        const reply = mockReply();
        await authMiddleware(req, reply);
        expect(reply.statusCode).toBe(401);
        expect(reply.body.error).toContain("Invalid or expired");
      });

      it("returns 401 with malformed authorization header", async () => {
        const req = mockRequest({
          url: "/api/tasks",
          headers: { authorization: "NotBearer token" },
        });
        const reply = mockReply();
        await authMiddleware(req, reply);
        expect(reply.statusCode).toBe(401);
      });
    });

    describe("with accept-all provider", () => {
      beforeEach(() => {
        setAuthProvider(acceptAllProvider);
      });

      it("attaches caller to request on valid token", async () => {
        const req = mockRequest({
          url: "/api/tasks",
          headers: { authorization: "Bearer valid-token" },
        });
        const reply = mockReply();
        await authMiddleware(req, reply);
        expect(reply.statusCode).toBe(200);
        expect(req.caller).toBeDefined();
        expect(req.caller.userId).toBe("test-user");
        expect(req.caller.tenantId).toBe("test-tenant");
      });

      it("passes token to verifyToken", async () => {
        const req = mockRequest({
          url: "/api/tasks",
          headers: { authorization: "Bearer my-jwt-token" },
        });
        const reply = mockReply();
        await authMiddleware(req, reply);
        expect(acceptAllProvider.verifyToken).toHaveBeenCalledWith("my-jwt-token");
      });

      it("works with DevAuthProvider pattern (no token)", async () => {
        const req = mockRequest({ url: "/api/tasks" });
        const reply = mockReply();
        await authMiddleware(req, reply);
        // DevAuthProvider accepts empty string, so caller is set
        expect(req.caller).toBeDefined();
        expect(req.caller.userId).toBe("test-user");
      });
    });
  });

  describe("does NOT bypass protected routes", () => {
    beforeEach(() => {
      setAuthProvider(rejectAllProvider);
    });

    it("requires auth for /api/tasks", async () => {
      const req = mockRequest({ url: "/api/tasks" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(401);
    });

    it("requires auth for /api/billing/plans POST", async () => {
      const req = mockRequest({ url: "/api/billing/plans", method: "POST" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(401);
    });

    it("requires auth for /api/notifications", async () => {
      const req = mockRequest({ url: "/api/notifications" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(401);
    });

    it("requires auth for /api/ai/command", async () => {
      const req = mockRequest({ url: "/api/ai/command" });
      const reply = mockReply();
      await authMiddleware(req, reply);
      expect(reply.statusCode).toBe(401);
    });
  });
});
