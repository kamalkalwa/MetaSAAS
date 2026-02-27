/**
 * Event Bus — Test Suite
 *
 * Validates the pub/sub event system:
 *   - subscribe + publish delivers events to handlers
 *   - Wildcard ("*") subscribers receive all events
 *   - Multiple subscribers for the same event type
 *   - Failed handlers are logged but don't break other handlers
 *   - clearSubscribers resets state for test isolation
 *   - subscribeAll registers multiple subscribers at once
 *   - Events are enriched with a timestamp if missing
 *   - No subscribers means publish is a no-op
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  subscribe,
  subscribeAll,
  publish,
  getSubscriberCount,
  clearSubscribers,
} from "./index.js";
import type { DomainEvent, EventSubscriber } from "@metasaas/contracts";

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearSubscribers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(type: string, payload?: unknown): DomainEvent {
  return { type, payload: payload ?? {} };
}

function makeSubscriber(
  eventType: string,
  name: string,
  handler?: (event: DomainEvent) => Promise<void>
): EventSubscriber {
  return {
    eventType,
    name,
    handler: handler ?? vi.fn(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subscribe + publish", () => {
  it("delivers event to a matching subscriber", async () => {
    const handler = vi.fn(async () => {});
    subscribe(makeSubscriber("task.created", "onTaskCreated", handler));

    await publish(makeEvent("task.created", { id: "1" }));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].type).toBe("task.created");
    expect(handler.mock.calls[0][0].payload).toEqual({ id: "1" });
  });

  it("does not deliver event to non-matching subscribers", async () => {
    const handler = vi.fn(async () => {});
    subscribe(makeSubscriber("task.deleted", "onTaskDeleted", handler));

    await publish(makeEvent("task.created"));

    expect(handler).not.toHaveBeenCalled();
  });

  it("enriches event with timestamp if not present", async () => {
    const handler = vi.fn(async () => {});
    subscribe(makeSubscriber("x", "timestampCheck", handler));

    await publish({ type: "x", payload: {} });

    const received = handler.mock.calls[0][0] as DomainEvent;
    expect(received.timestamp).toBeInstanceOf(Date);
  });

  it("preserves existing timestamp if already set", async () => {
    const handler = vi.fn(async () => {});
    subscribe(makeSubscriber("x", "timestampPreserve", handler));

    const ts = new Date("2026-01-01T00:00:00Z");
    await publish({ type: "x", payload: {}, timestamp: ts });

    const received = handler.mock.calls[0][0] as DomainEvent;
    expect(received.timestamp).toEqual(ts);
  });
});

describe("wildcard subscribers", () => {
  it("wildcard * receives all event types", async () => {
    const handler = vi.fn(async () => {});
    subscribe(makeSubscriber("*", "auditLog", handler));

    await publish(makeEvent("task.created"));
    await publish(makeEvent("contact.updated"));
    await publish(makeEvent("anything.else"));

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("wildcard + exact both receive the same event", async () => {
    const wildcardHandler = vi.fn(async () => {});
    const exactHandler = vi.fn(async () => {});

    subscribe(makeSubscriber("*", "wildcard", wildcardHandler));
    subscribe(makeSubscriber("task.created", "exact", exactHandler));

    await publish(makeEvent("task.created"));

    expect(wildcardHandler).toHaveBeenCalledOnce();
    expect(exactHandler).toHaveBeenCalledOnce();
  });
});

describe("multiple subscribers", () => {
  it("multiple subscribers for the same event type all receive it", async () => {
    const handler1 = vi.fn(async () => {});
    const handler2 = vi.fn(async () => {});
    const handler3 = vi.fn(async () => {});

    subscribe(makeSubscriber("task.created", "sub1", handler1));
    subscribe(makeSubscriber("task.created", "sub2", handler2));
    subscribe(makeSubscriber("task.created", "sub3", handler3));

    await publish(makeEvent("task.created"));

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler3).toHaveBeenCalledOnce();
  });
});

describe("error isolation", () => {
  it("failed handler does not break other handlers", async () => {
    const failingHandler = vi.fn(async () => {
      throw new Error("Subscriber crashed");
    });
    const successHandler = vi.fn(async () => {});

    subscribe(makeSubscriber("task.created", "failing", failingHandler));
    subscribe(makeSubscriber("task.created", "success", successHandler));

    // Suppress console.error during this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await publish(makeEvent("task.created"));

    // Both were called
    expect(failingHandler).toHaveBeenCalledOnce();
    expect(successHandler).toHaveBeenCalledOnce();

    // Error was logged (once by event-bus, once by observability console provider)
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain("failing");

    consoleSpy.mockRestore();
  });

  it("publish does not throw even when a handler throws", async () => {
    subscribe(
      makeSubscriber("x", "boom", async () => {
        throw new Error("boom");
      })
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should not throw
    await expect(publish(makeEvent("x"))).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});

describe("subscribeAll", () => {
  it("registers multiple subscribers at once", async () => {
    const h1 = vi.fn(async () => {});
    const h2 = vi.fn(async () => {});

    subscribeAll([
      makeSubscriber("a", "sub-a", h1),
      makeSubscriber("b", "sub-b", h2),
    ]);

    await publish(makeEvent("a"));
    await publish(makeEvent("b"));

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });
});

describe("getSubscriberCount", () => {
  it("returns 0 when no subscribers are registered", () => {
    expect(getSubscriberCount()).toBe(0);
  });

  it("counts all registered subscribers", () => {
    subscribe(makeSubscriber("a", "s1"));
    subscribe(makeSubscriber("a", "s2"));
    subscribe(makeSubscriber("b", "s3"));

    expect(getSubscriberCount()).toBe(3);
  });
});

describe("clearSubscribers", () => {
  it("removes all subscribers", () => {
    subscribe(makeSubscriber("a", "s1"));
    subscribe(makeSubscriber("b", "s2"));
    expect(getSubscriberCount()).toBe(2);

    clearSubscribers();
    expect(getSubscriberCount()).toBe(0);
  });

  it("after clear, published events are not delivered", async () => {
    const handler = vi.fn(async () => {});
    subscribe(makeSubscriber("a", "s1", handler));

    clearSubscribers();
    await publish(makeEvent("a"));

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("no subscribers", () => {
  it("publish is a no-op when no subscribers exist", async () => {
    // Should not throw or error
    await expect(publish(makeEvent("anything"))).resolves.toBeUndefined();
  });
});
