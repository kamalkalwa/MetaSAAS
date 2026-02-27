/**
 * Auth Module Tests
 *
 * Tests DevAuthProvider, SupabaseAuthProvider factory,
 * and initAuthProvider environment-based selection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevAuthProvider, DEV_TENANT_ID } from "./dev-provider.js";
import { initAuthProvider, getAuthProvider, setAuthProvider } from "./index.js";

// Mock Supabase to avoid real network calls
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "invalid token" },
      }),
    },
  })),
}));

describe("DevAuthProvider", () => {
  const provider = new DevAuthProvider();

  it("verifyToken returns dev caller for any token", async () => {
    const result = await provider.verifyToken("any-token");
    expect(result).toBeDefined();
    expect(result!.userId).toBe("dev-user");
    expect(result!.tenantId).toBe(DEV_TENANT_ID);
    expect(result!.roles).toContain("admin");
    expect(result!.type).toBe("human");
  });

  it("verifyToken returns dev caller for empty string", async () => {
    const result = await provider.verifyToken("");
    expect(result).toBeDefined();
    expect(result!.userId).toBe("dev-user");
  });

  it("getPublicConfig returns dev provider info", () => {
    const config = provider.getPublicConfig();
    expect(config.provider).toBe("dev");
    expect(config.message).toContain("Development mode");
  });

  it("DEV_TENANT_ID is a valid UUID format", () => {
    expect(DEV_TENANT_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("initAuthProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset module state
    setAuthProvider(null as any);
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("selects DevAuthProvider when no Supabase config", () => {
    process.env.NODE_ENV = "development";
    const provider = initAuthProvider();
    expect(provider).toBeInstanceOf(DevAuthProvider);
  });

  it("selects DevAuthProvider when NODE_ENV is test", () => {
    process.env.NODE_ENV = "test";
    const provider = initAuthProvider();
    expect(provider).toBeInstanceOf(DevAuthProvider);
  });

  it("throws in production without Supabase config", () => {
    process.env.NODE_ENV = "production";
    expect(() => initAuthProvider()).toThrow(
      "Authentication must be configured in production"
    );
  });

  it("selects SupabaseAuthProvider when env vars are set", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";
    const provider = initAuthProvider();
    expect(provider).not.toBeInstanceOf(DevAuthProvider);
  });
});

describe("getAuthProvider", () => {
  it("throws if not initialized", () => {
    setAuthProvider(null as any);
    expect(() => getAuthProvider()).toThrow("Auth provider not initialized");
  });

  it("returns provider after init", () => {
    const provider = new DevAuthProvider();
    setAuthProvider(provider);
    expect(getAuthProvider()).toBe(provider);
  });
});

describe("setAuthProvider", () => {
  it("allows setting a custom provider", async () => {
    const custom = {
      verifyToken: vi.fn().mockResolvedValue({
        userId: "custom-user",
        tenantId: "custom-tenant",
        roles: ["viewer"],
        type: "human" as const,
      }),
      getPublicConfig: () => ({ provider: "custom" }),
    };

    setAuthProvider(custom);
    const result = await getAuthProvider().verifyToken("test");
    expect(result!.userId).toBe("custom-user");
  });
});
