/**
 * Audit Log Query Tests
 *
 * Tests the queryAuditLog function with mocked database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockUnsafe = vi.fn();
vi.mock("../database/connection.js", () => ({
  getDatabase: () => ({ sql: { unsafe: mockUnsafe } }),
}));

import { queryAuditLog } from "./query.js";

describe("Audit Log Query", () => {
  beforeEach(() => {
    mockUnsafe.mockReset();
  });

  it("queries with only tenantId", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 2 }]) // count
      .mockResolvedValueOnce([ // data
        {
          id: "a1",
          tenant_id: "t1",
          user_id: "u1",
          action_id: "contact.create",
          success: true,
          duration_ms: 15,
          input: { name: "John" },
          error: null,
          created_at: new Date("2026-01-01"),
        },
        {
          id: "a2",
          tenant_id: "t1",
          user_id: "u1",
          action_id: "contact.findAll",
          success: true,
          duration_ms: 5,
          input: null,
          error: null,
          created_at: new Date("2026-01-02"),
        },
      ]);

    const result = await queryAuditLog({ tenantId: "t1" });

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].actionId).toBe("contact.create");
    expect(result.data[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("builds correct SQL with userId filter", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({ tenantId: "t1", userId: "u1" });

    // Count query should contain user_id filter
    expect(mockUnsafe.mock.calls[0][0]).toContain("user_id = $2");
    expect(mockUnsafe.mock.calls[0][1]).toEqual(["t1", "u1"]);
  });

  it("builds correct SQL with entity filter (LIKE prefix)", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({ tenantId: "t1", entity: "contact" });

    expect(mockUnsafe.mock.calls[0][0]).toContain("action_id LIKE $2");
    expect(mockUnsafe.mock.calls[0][1]).toEqual(["t1", "contact.%"]);
  });

  it("builds correct SQL with success filter", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({ tenantId: "t1", success: false });

    expect(mockUnsafe.mock.calls[0][0]).toContain("success = $2");
    expect(mockUnsafe.mock.calls[0][1]).toEqual(["t1", false]);
  });

  it("builds correct SQL with date range", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({
      tenantId: "t1",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(mockUnsafe.mock.calls[0][0]).toContain("created_at >= $2");
    expect(mockUnsafe.mock.calls[0][0]).toContain("created_at <= $3");
  });

  it("applies pagination with limit and offset", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 100 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({ tenantId: "t1", limit: 10, offset: 20 });

    // Data query should contain LIMIT and OFFSET
    const dataQuery = mockUnsafe.mock.calls[1][0];
    expect(dataQuery).toContain("LIMIT");
    expect(dataQuery).toContain("OFFSET");
    const dataParams = mockUnsafe.mock.calls[1][1];
    expect(dataParams).toContain(10); // limit
    expect(dataParams).toContain(20); // offset
  });

  it("defaults limit to 50 and offset to 0", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({ tenantId: "t1" });

    const dataParams = mockUnsafe.mock.calls[1][1];
    expect(dataParams).toContain(50);
    expect(dataParams).toContain(0);
  });

  it("combines multiple filters", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await queryAuditLog({
      tenantId: "t1",
      userId: "u1",
      entity: "task",
      success: true,
    });

    const sql = mockUnsafe.mock.calls[0][0];
    expect(sql).toContain("tenant_id = $1");
    expect(sql).toContain("user_id = $2");
    expect(sql).toContain("action_id LIKE $3");
    expect(sql).toContain("success = $4");
  });

  it("maps row data correctly", async () => {
    mockUnsafe
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([
        {
          id: "entry-1",
          tenant_id: "t1",
          user_id: "u1",
          action_id: "task.update",
          success: false,
          duration_ms: 42,
          input: { status: "done" },
          error: "Workflow violation",
          created_at: "2026-02-15T12:00:00.000Z",
        },
      ]);

    const result = await queryAuditLog({ tenantId: "t1" });

    expect(result.data[0]).toEqual({
      id: "entry-1",
      tenantId: "t1",
      userId: "u1",
      actionId: "task.update",
      success: false,
      durationMs: 42,
      input: { status: "done" },
      error: "Workflow violation",
      createdAt: "2026-02-15T12:00:00.000Z",
    });
  });
});
