/**
 * Webhook System — Test Suite
 *
 * Validates registration, removal, listing, delivery log, and edge cases.
 * All functions are async; the in-memory fallback is used automatically
 * because getDatabase() is not initialized in the test environment.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerWebhook,
  removeWebhook,
  listWebhooks,
  getDeliveryLog,
} from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistration(overrides: Partial<Parameters<typeof registerWebhook>[0]> = {}) {
  return {
    eventType: overrides.eventType ?? "task.created",
    url: overrides.url ?? "https://example.com/hook",
    active: overrides.active ?? true,
    tenantId: overrides.tenantId ?? `tenant-${Date.now()}-${Math.random()}`,
    secret: overrides.secret,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerWebhook", () => {
  it("returns a webhook with a generated id and createdAt", async () => {
    const wh = await registerWebhook(makeRegistration());

    expect(wh.id).toBeDefined();
    expect(typeof wh.id).toBe("string");
    expect(wh.createdAt).toBeInstanceOf(Date);
    expect(wh.eventType).toBe("task.created");
    expect(wh.url).toBe("https://example.com/hook");
    expect(wh.active).toBe(true);
  });

  it("each registration gets a unique id", async () => {
    const tenant = `tenant-unique-${Date.now()}`;
    const wh1 = await registerWebhook(makeRegistration({ tenantId: tenant }));
    const wh2 = await registerWebhook(makeRegistration({ tenantId: tenant }));

    expect(wh1.id).not.toBe(wh2.id);
  });
});

describe("removeWebhook", () => {
  it("returns true when removing an existing webhook", async () => {
    const wh = await registerWebhook(makeRegistration());
    expect(await removeWebhook(wh.id)).toBe(true);
  });

  it("returns false when removing a non-existent webhook", async () => {
    expect(await removeWebhook("non-existent-id")).toBe(false);
  });

  it("removed webhook no longer appears in list", async () => {
    const tenant = `tenant-rm-${Date.now()}`;
    const wh = await registerWebhook(makeRegistration({ tenantId: tenant }));
    await removeWebhook(wh.id);
    const list = await listWebhooks(tenant);
    expect(list.find((w) => w.id === wh.id)).toBeUndefined();
  });
});

describe("listWebhooks", () => {
  it("returns only webhooks for the specified tenant", async () => {
    const tenantA = `tenant-a-${Date.now()}`;
    const tenantB = `tenant-b-${Date.now()}`;

    await registerWebhook(makeRegistration({ tenantId: tenantA }));
    await registerWebhook(makeRegistration({ tenantId: tenantA }));
    await registerWebhook(makeRegistration({ tenantId: tenantB }));

    const listA = await listWebhooks(tenantA);
    const listB = await listWebhooks(tenantB);

    expect(listA.length).toBe(2);
    expect(listB.length).toBe(1);
    expect(listA.every((w) => w.tenantId === tenantA)).toBe(true);
    expect(listB.every((w) => w.tenantId === tenantB)).toBe(true);
  });

  it("returns empty array for tenant with no webhooks", async () => {
    expect(await listWebhooks("nonexistent-tenant")).toEqual([]);
  });
});

describe("getDeliveryLog", () => {
  it("returns an array", async () => {
    const result = await getDeliveryLog();
    expect(Array.isArray(result)).toBe(true);
  });

  it("filters by webhookId when provided", async () => {
    const result = await getDeliveryLog("non-existent-webhook-id");
    expect(result).toEqual([]);
  });
});

describe("wildcard eventType", () => {
  it("a webhook with eventType '*' is registered and listed", async () => {
    const tenant = `tenant-wild-${Date.now()}`;
    const wh = await registerWebhook(makeRegistration({ eventType: "*", tenantId: tenant }));
    const list = await listWebhooks(tenant);
    const found = list.find((w) => w.id === wh.id);

    expect(found).toBeDefined();
    expect(found!.eventType).toBe("*");
  });
});

describe("optional secret", () => {
  it("stores the secret when provided", async () => {
    const wh = await registerWebhook(makeRegistration({ secret: "my-secret" }));
    expect(wh.secret).toBe("my-secret");
  });

  it("secret is undefined when not provided", async () => {
    const wh = await registerWebhook(makeRegistration());
    expect(wh.secret).toBeUndefined();
  });
});

describe("inactive webhooks", () => {
  it("registers an inactive webhook", async () => {
    const tenant = `tenant-inactive-${Date.now()}`;
    const wh = await registerWebhook(makeRegistration({ active: false, tenantId: tenant }));
    expect(wh.active).toBe(false);

    const list = await listWebhooks(tenant);
    expect(list.find((w) => w.id === wh.id)?.active).toBe(false);
  });
});
