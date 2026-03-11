/**
 * Workspace & Entity Stats API — Test Suite
 *
 * Validates workspace-related API client functions:
 *   - fetchWorkspaces sends GET and returns workspace list
 *   - createWorkspace sends POST with name and returns created workspace
 *   - createWorkspace throws on failure response
 *   - setActiveWorkspace attaches X-Workspace-Id header
 *   - fetchEntityStats sends GET to the correct stats URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWorkspaces,
  createWorkspace,
  setActiveWorkspace,
  fetchEntityStats,
  fetchEntityList,
} from "./api-client";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  // Reset active workspace between tests
  setActiveWorkspace(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Helper: creates a mock Response for fetch.
 */
function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  } as Response;
}

// ---------------------------------------------------------------------------
// fetchWorkspaces
// ---------------------------------------------------------------------------

describe("fetchWorkspaces", () => {
  it("sends GET to /api/workspaces and returns data", async () => {
    const workspaces = [
      { id: "ws-1", name: "Acme Corp", slug: "acme", role: "admin", created_at: "2025-01-01" },
      { id: "ws-2", name: "Beta Inc", slug: "beta", role: "member", created_at: "2025-02-01" },
    ];
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: workspaces })
    );

    const result = await fetchWorkspaces();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/workspaces");
    expect(options?.method).toBeUndefined(); // GET is the default
    expect(result).toEqual(workspaces);
  });

  it("returns empty array when response has no data", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true })
    );

    const result = await fetchWorkspaces();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createWorkspace
// ---------------------------------------------------------------------------

describe("createWorkspace", () => {
  it("sends POST with name in body and returns created workspace", async () => {
    const workspace = {
      id: "ws-new",
      name: "New Workspace",
      slug: "new-workspace",
      role: "admin",
      created_at: "2025-03-01",
    };
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: workspace })
    );

    const result = await createWorkspace("New Workspace");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/workspaces");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.name).toBe("New Workspace");
    expect(result).toEqual(workspace);
  });

  it("throws on failure response with error message", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: false, error: "Workspace name already taken" })
    );

    await expect(createWorkspace("Duplicate")).rejects.toThrow(
      "Workspace name already taken"
    );
  });

  it("throws default message when no error is provided", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: false })
    );

    await expect(createWorkspace("Bad")).rejects.toThrow(
      "Failed to create workspace"
    );
  });
});

// ---------------------------------------------------------------------------
// setActiveWorkspace — X-Workspace-Id header
// ---------------------------------------------------------------------------

describe("setActiveWorkspace", () => {
  it("adds X-Workspace-Id header to subsequent requests", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: [] })
    );

    setActiveWorkspace("ws-123");
    await fetchWorkspaces();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Workspace-Id"]).toBe("ws-123");
  });

  it("removes X-Workspace-Id header when set to null", async () => {
    setActiveWorkspace("ws-123");
    setActiveWorkspace(null);

    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: [] })
    );
    await fetchWorkspaces();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Workspace-Id"]).toBeUndefined();
  });

  it("sends X-Workspace-Id on entity requests too", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { data: [], total: 0 } })
    );

    setActiveWorkspace("ws-456");
    await fetchEntityList("contacts");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Workspace-Id"]).toBe("ws-456");
  });
});

// ---------------------------------------------------------------------------
// fetchEntityStats
// ---------------------------------------------------------------------------

describe("fetchEntityStats", () => {
  it("sends GET to /api/entities/{pluralName}/stats", async () => {
    const stats = { workflows: { status: { open: 5, closed: 3 } } };
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: stats })
    );

    const result = await fetchEntityStats("tasks");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/entities/tasks/stats");
    expect(result).toEqual({ success: true, data: stats });
  });

  it("returns the full response object", async () => {
    const stats = { workflows: { priority: { high: 2, low: 10 } } };
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: stats })
    );

    const result = await fetchEntityStats("deals");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/entities/deals/stats");
    expect(result.data).toEqual(stats);
  });
});
