"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchNotifications,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  type NotificationData,
} from "./api-client";

const POLL_INTERVAL = 30_000; // 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchNotifications({ limit: 20, unreadOnly: false });
      setNotifications(result.data);
      setUnreadCount(result.unread);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await markNotificationReadApi(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Silently fail
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh };
}
