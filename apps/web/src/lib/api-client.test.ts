/**
 * API Client — Test Suite
 *
 * Validates the API client's request construction, response parsing,
 * and error handling. Uses mocked fetch to test without a real server.
 *
 * This is where we verify that:
 *   - Correct HTTP methods are used for each operation
 *   - Request bodies are properly serialized
 *   - Error responses throw with meaningful messages
 *   - The Content-Type header is always set
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchEntityList,
  fetchEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
  fetchAllEntityMeta,
  fetchEntityMeta,
} from "./api-client";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
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
// fetchEntityList
// ---------------------------------------------------------------------------

describe("fetchEntityList", () => {
  it("sends GET request to /api/{pluralName}", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { data: [], total: 0 } })
    );

    await fetchEntityList("contacts");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/contacts");
    expect(options?.method).toBeUndefined(); // GET is the default
  });

  it("appends query parameters when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { data: [], total: 0 } })
    );

    await fetchEntityList("contacts", { limit: "10", offset: "0" });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=0");
  });

  it("returns parsed response data", async () => {
    const responseData = {
      success: true,
      data: { data: [{ id: "1", name: "Alice" }], total: 1 },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(responseData));

    const result = await fetchEntityList("contacts");
    expect(result).toEqual(responseData);
  });
});

// ---------------------------------------------------------------------------
// fetchEntityById
// ---------------------------------------------------------------------------

describe("fetchEntityById", () => {
  it("sends GET request to /api/{pluralName}/{id}", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { id: "abc", name: "Alice" } })
    );

    await fetchEntityById("contacts", "abc");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/contacts/abc");
  });
});

// ---------------------------------------------------------------------------
// createEntity
// ---------------------------------------------------------------------------

describe("createEntity", () => {
  it("sends POST request with JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { id: "new-id", name: "Bob" } })
    );

    await createEntity("contacts", { name: "Bob", email: "bob@test.com" });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/contacts");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.name).toBe("Bob");
    expect(body.email).toBe("bob@test.com");
  });
});

// ---------------------------------------------------------------------------
// updateEntity
// ---------------------------------------------------------------------------

describe("updateEntity", () => {
  it("sends PATCH request with JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { id: "abc", name: "Updated" } })
    );

    await updateEntity("contacts", "abc", { name: "Updated" });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/contacts/abc");
    expect(options.method).toBe("PATCH");

    const body = JSON.parse(options.body);
    expect(body.name).toBe("Updated");
  });
});

// ---------------------------------------------------------------------------
// deleteEntity
// ---------------------------------------------------------------------------

describe("deleteEntity", () => {
  it("sends DELETE request to /api/{pluralName}/{id}", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: { success: true } })
    );

    await deleteEntity("contacts", "abc");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/contacts/abc");
    expect(options.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Metadata operations
// ---------------------------------------------------------------------------

describe("fetchAllEntityMeta", () => {
  it("sends GET request to /api/meta/entities", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    await fetchAllEntityMeta();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/meta/entities");
  });
});

describe("fetchEntityMeta", () => {
  it("sends GET request to /api/meta/entities/{pluralName}", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ name: "Contact", pluralName: "Contacts" })
    );

    await fetchEntityMeta("contacts");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/meta/entities/contacts");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws on non-200 response with error message from body", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: "Entity not found" }, 404)
    );

    await expect(fetchEntityById("contacts", "bad-id")).rejects.toThrow(
      "Entity not found"
    );
  });

  it("throws with status code when body has no error message", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, 500));

    await expect(fetchEntityList("contacts")).rejects.toThrow("500");
  });

  it("throws when fetch itself fails (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(fetchEntityList("contacts")).rejects.toThrow("Failed to fetch");
  });
});

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

describe("request headers", () => {
  it("always sends Content-Type: application/json", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

    await createEntity("contacts", { name: "Test" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});
