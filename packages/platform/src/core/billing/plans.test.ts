/**
 * Plan CRUD Tests
 *
 * Tests plan management functions with mocked database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockUnsafe = vi.fn();
vi.mock("../database/connection.js", () => ({
  getDatabase: () => ({ sql: { unsafe: mockUnsafe } }),
}));

import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  seedDefaultPlans,
} from "./plans.js";

const MOCK_PLAN_ROW = {
  id: "plan-1",
  name: "Pro",
  description: "For growing teams",
  price_cents: 2900,
  currency: "usd",
  interval: "month",
  stripe_price_id: "price_test_123",
  features: ["Feature 1", "Feature 2"],
  sort_order: 1,
  is_active: true,
  is_default: false,
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-01"),
};

describe("Plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPlans", () => {
    it("lists active plans by default", async () => {
      mockUnsafe.mockResolvedValue([MOCK_PLAN_ROW]);

      const plans = await listPlans();

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("WHERE is_active = TRUE")
      );
      expect(plans).toHaveLength(1);
      expect(plans[0].name).toBe("Pro");
      expect(plans[0].priceCents).toBe(2900);
      expect(plans[0].features).toEqual(["Feature 1", "Feature 2"]);
    });

    it("lists all plans when activeOnly is false", async () => {
      mockUnsafe.mockResolvedValue([]);

      await listPlans(false);

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.not.stringContaining("WHERE is_active = TRUE")
      );
    });
  });

  describe("getPlan", () => {
    it("returns a plan when found", async () => {
      mockUnsafe.mockResolvedValue([MOCK_PLAN_ROW]);

      const plan = await getPlan("plan-1");

      expect(plan).not.toBeNull();
      expect(plan!.id).toBe("plan-1");
      expect(plan!.stripePriceId).toBe("price_test_123");
    });

    it("returns null when not found", async () => {
      mockUnsafe.mockResolvedValue([]);

      const plan = await getPlan("nonexistent");

      expect(plan).toBeNull();
    });
  });

  describe("createPlan", () => {
    it("creates a plan with defaults", async () => {
      mockUnsafe.mockResolvedValue([MOCK_PLAN_ROW]);

      const plan = await createPlan({
        name: "Pro",
        priceCents: 2900,
      });

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO plans"),
        expect.arrayContaining(["Pro", 2900, "usd", "month"])
      );
      expect(plan.name).toBe("Pro");
    });

    it("passes custom values", async () => {
      mockUnsafe.mockResolvedValue([MOCK_PLAN_ROW]);

      await createPlan({
        name: "Enterprise",
        priceCents: 9900,
        currency: "eur",
        interval: "year",
        features: ["SSO", "SLA"],
        isDefault: true,
      });

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO plans"),
        expect.arrayContaining(["Enterprise", 9900, "eur", "year"])
      );
    });
  });

  describe("updatePlan", () => {
    it("updates specified fields", async () => {
      mockUnsafe.mockResolvedValue([{ ...MOCK_PLAN_ROW, name: "Pro Plus" }]);

      const plan = await updatePlan("plan-1", { name: "Pro Plus" });

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE plans SET"),
        expect.arrayContaining(["Pro Plus", "plan-1"])
      );
      expect(plan).not.toBeNull();
      expect(plan!.name).toBe("Pro Plus");
    });

    it("returns null when plan not found", async () => {
      mockUnsafe.mockResolvedValue([]);

      const plan = await updatePlan("nonexistent", { name: "Test" });

      expect(plan).toBeNull();
    });

    it("returns existing plan when no fields to update", async () => {
      mockUnsafe.mockResolvedValue([MOCK_PLAN_ROW]);

      const plan = await updatePlan("plan-1", {});

      expect(plan).not.toBeNull();
      // Should call getPlan instead of UPDATE
      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM plans WHERE id"),
        ["plan-1"]
      );
    });
  });

  describe("deletePlan", () => {
    it("soft-deletes a plan", async () => {
      mockUnsafe.mockResolvedValue([{ id: "plan-1" }]);

      const result = await deletePlan("plan-1");

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("is_active = FALSE"),
        ["plan-1"]
      );
      expect(result).toBe(true);
    });

    it("returns false when plan not found", async () => {
      mockUnsafe.mockResolvedValue([]);

      const result = await deletePlan("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("seedDefaultPlans", () => {
    it("seeds plans when table is empty", async () => {
      // First call: count query returns 0
      mockUnsafe.mockResolvedValueOnce([{ count: 0 }]);
      // Subsequent calls: inserts for each default plan
      mockUnsafe.mockResolvedValue([]);

      await seedDefaultPlans();

      // 1 count query + 3 inserts (Free, Pro, Enterprise)
      expect(mockUnsafe).toHaveBeenCalledTimes(4);
      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO plans"),
        expect.arrayContaining(["Free"])
      );
      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO plans"),
        expect.arrayContaining(["Pro"])
      );
      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO plans"),
        expect.arrayContaining(["Enterprise"])
      );
    });

    it("skips seeding when plans already exist", async () => {
      mockUnsafe.mockResolvedValueOnce([{ count: 3 }]);

      await seedDefaultPlans();

      // Only the count query
      expect(mockUnsafe).toHaveBeenCalledTimes(1);
    });

    it("silently skips when plans table does not exist", async () => {
      mockUnsafe.mockRejectedValue(new Error('relation "plans" does not exist'));

      await seedDefaultPlans();

      // Should not throw
    });
  });
});
