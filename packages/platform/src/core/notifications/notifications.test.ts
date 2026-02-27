/**
 * Notifications Module Tests
 *
 * Tests notification sending, provider switching, listing, and marking as read.
 * Uses ConsoleNotificationProvider — no database needed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initNotifications,
  sendNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationProvider,
  setNotificationProvider,
  resetNotifications,
  ConsoleNotificationProvider,
  InAppNotificationProvider,
  type NotificationProvider,
  type NotificationInput,
} from "./index.js";

// Mock event bus to prevent actual subscription
vi.mock("../event-bus/index.js", () => ({
  subscribe: vi.fn(),
}));

// Mock database connection
vi.mock("../database/connection.js", () => ({
  getDatabase: vi.fn(() => {
    throw new Error("Database not initialized");
  }),
}));

describe("Notifications Module", () => {
  beforeEach(() => {
    resetNotifications();
  });

  describe("initNotifications()", () => {
    it("uses console provider when no database is available", () => {
      initNotifications();
      expect(getNotificationProvider().name).toBe("console");
    });

    it("subscribes to event bus for auto-notifications", async () => {
      const { subscribe } = await import("../event-bus/index.js");
      initNotifications();
      expect(subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "notification-dispatcher",
          eventType: "*",
        })
      );
    });
  });

  describe("sendNotification()", () => {
    it("creates a notification via the provider", async () => {
      const input: NotificationInput = {
        tenantId: "t1",
        userId: "u1",
        title: "New Contact",
        body: "John Doe was created",
        type: "info",
        link: "/contacts/abc-123",
      };

      const result = await sendNotification(input);

      expect(result.id).toBeTruthy();
      expect(result.tenantId).toBe("t1");
      expect(result.userId).toBe("u1");
      expect(result.title).toBe("New Contact");
      expect(result.body).toBe("John Doe was created");
      expect(result.type).toBe("info");
      expect(result.link).toBe("/contacts/abc-123");
      expect(result.read).toBe(false);
      expect(result.createdAt).toBeTruthy();
    });

    it("supports all notification types", async () => {
      for (const type of ["info", "success", "warning", "error"] as const) {
        const result = await sendNotification({
          tenantId: "t1",
          userId: "u1",
          title: "Test",
          body: "Test body",
          type,
        });
        expect(result.type).toBe(type);
      }
    });
  });

  describe("getNotifications()", () => {
    it("returns notifications for a specific user", async () => {
      await sendNotification({ tenantId: "t1", userId: "u1", title: "A", body: "a", type: "info" });
      await sendNotification({ tenantId: "t1", userId: "u1", title: "B", body: "b", type: "info" });
      await sendNotification({ tenantId: "t1", userId: "u2", title: "C", body: "c", type: "info" });

      const result = await getNotifications("t1", "u1");

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.unread).toBe(2);
    });

    it("filters by unreadOnly", async () => {
      await sendNotification({ tenantId: "t1", userId: "u1", title: "A", body: "a", type: "info" });
      const b = await sendNotification({ tenantId: "t1", userId: "u1", title: "B", body: "b", type: "info" });
      await markNotificationRead(b.id, "t1");

      const result = await getNotifications("t1", "u1", { unreadOnly: true });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("A");
    });

    it("supports pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await sendNotification({ tenantId: "t1", userId: "u1", title: `N${i}`, body: `n${i}`, type: "info" });
      }

      const page1 = await getNotifications("t1", "u1", { limit: 2, offset: 0 });
      const page2 = await getNotifications("t1", "u1", { limit: 2, offset: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    it("returns empty result for unknown user", async () => {
      const result = await getNotifications("t1", "unknown");
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.unread).toBe(0);
    });
  });

  describe("markNotificationRead()", () => {
    it("marks a notification as read", async () => {
      const notif = await sendNotification({
        tenantId: "t1",
        userId: "u1",
        title: "Test",
        body: "test",
        type: "info",
      });

      const marked = await markNotificationRead(notif.id, "t1");
      expect(marked).toBe(true);

      const result = await getNotifications("t1", "u1");
      expect(result.unread).toBe(0);
    });

    it("returns false for non-existent notification", async () => {
      const marked = await markNotificationRead("nonexistent", "t1");
      expect(marked).toBe(false);
    });
  });

  describe("markAllNotificationsRead()", () => {
    it("marks all notifications as read for a user", async () => {
      await sendNotification({ tenantId: "t1", userId: "u1", title: "A", body: "a", type: "info" });
      await sendNotification({ tenantId: "t1", userId: "u1", title: "B", body: "b", type: "info" });
      await sendNotification({ tenantId: "t1", userId: "u2", title: "C", body: "c", type: "info" });

      const count = await markAllNotificationsRead("t1", "u1");
      expect(count).toBe(2);

      const u1Result = await getNotifications("t1", "u1");
      expect(u1Result.unread).toBe(0);

      // u2 is unaffected
      const u2Result = await getNotifications("t1", "u2");
      expect(u2Result.unread).toBe(1);
    });
  });

  describe("ConsoleNotificationProvider", () => {
    it("stores notifications in memory", async () => {
      const provider = new ConsoleNotificationProvider();
      await provider.send({
        tenantId: "t1",
        userId: "u1",
        title: "Test",
        body: "Body",
        type: "success",
      });

      const result = await provider.getForUser("t1", "u1");
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe("success");
    });
  });

  describe("InAppNotificationProvider", () => {
    it("can be instantiated", () => {
      const provider = new InAppNotificationProvider();
      expect(provider.name).toBe("inapp");
    });
  });

  describe("setNotificationProvider()", () => {
    it("overrides the current provider", async () => {
      const custom: NotificationProvider = {
        name: "custom",
        send: async (input) => ({
          id: "custom-1",
          ...input,
          read: false,
          createdAt: new Date().toISOString(),
        }),
        getForUser: async () => ({ data: [], total: 0, unread: 0 }),
        markRead: async () => true,
        markAllRead: async () => 0,
      };

      setNotificationProvider(custom);
      expect(getNotificationProvider().name).toBe("custom");

      const result = await sendNotification({
        tenantId: "t1",
        userId: "u1",
        title: "Custom",
        body: "test",
        type: "info",
      });
      expect(result.id).toBe("custom-1");
    });
  });

  describe("resetNotifications()", () => {
    it("resets to default console provider", () => {
      setNotificationProvider({
        name: "custom",
        send: async () => ({ id: "x", tenantId: "", userId: "", title: "", body: "", type: "info" as const, read: false, createdAt: "" }),
        getForUser: async () => ({ data: [], total: 0, unread: 0 }),
        markRead: async () => true,
        markAllRead: async () => 0,
      });
      expect(getNotificationProvider().name).toBe("custom");

      resetNotifications();
      expect(getNotificationProvider().name).toBe("console");
    });
  });
});
