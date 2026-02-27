"use client";

/**
 * User Settings Hook
 *
 * Reads and writes user preferences to localStorage.
 * Shared across layout (theme) and settings page (all preferences).
 *
 * Settings shape:
 *   - theme: "light" | "dark" | "system"
 *   - notifications.onCreate: boolean
 *   - notifications.onUpdate: boolean
 *   - notifications.onDelete: boolean
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "metasaas:settings";

export interface UserSettings {
  theme: "light" | "dark" | "system";
  notifications: {
    onCreate: boolean;
    onUpdate: boolean;
    onDelete: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  notifications: {
    onCreate: true,
    onUpdate: true,
    onDelete: true,
  },
};

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate legacy theme key
      const legacyTheme = localStorage.getItem("metasaas:theme");
      if (legacyTheme === "dark" || legacyTheme === "light") {
        return { ...DEFAULT_SETTINGS, theme: legacyTheme };
      }
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Apply the theme to the document element. */
function applyTheme(theme: UserSettings["theme"]): void {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("dark", "light");

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.classList.add(prefersDark ? "dark" : "light");
  } else {
    html.classList.add(theme);
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Load on mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettingsState(loaded);
    applyTheme(loaded.theme);
  }, []);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      if (partial.notifications) {
        next.notifications = { ...prev.notifications, ...partial.notifications };
      }
      saveSettings(next);
      if (partial.theme) {
        applyTheme(next.theme);
      }
      return next;
    });
  }, []);

  const setTheme = useCallback(
    (theme: UserSettings["theme"]) => updateSettings({ theme }),
    [updateSettings]
  );

  const setNotificationPref = useCallback(
    (key: keyof UserSettings["notifications"], value: boolean) => {
      updateSettings({ notifications: { [key]: value } as any });
    },
    [updateSettings]
  );

  return {
    settings,
    updateSettings,
    setTheme,
    setNotificationPref,
  };
}
