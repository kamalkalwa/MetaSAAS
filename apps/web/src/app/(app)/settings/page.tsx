"use client";

/**
 * User Settings Page
 *
 * Centralizes user preferences: profile info, theme selection,
 * and notification preferences. Persists to localStorage via useSettings.
 */

import { useAuth } from "@/lib/auth-context";
import { useSettings, type UserSettings } from "@/lib/use-settings";
import { cn } from "@/lib/utils";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ThemeOption({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: UserSettings["theme"];
  current: UserSettings["theme"];
  onSelect: (v: UserSettings["theme"]) => void;
}) {
  const isActive = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
        isActive
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 items-center shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </label>
  );
}

export default function SettingsPage() {
  const { user, authEnabled } = useAuth();
  const { settings, setTheme, setNotificationPref } = useSettings();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your preferences
        </p>
      </div>

      {/* Profile */}
      <Section title="Profile" description="Your account information">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Email</span>
            <p className="font-medium mt-0.5">
              {authEnabled && user ? user.email : "dev@localhost"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Auth Provider</span>
            <p className="font-medium mt-0.5">
              {authEnabled ? "Supabase" : "Disabled (dev mode)"}
            </p>
          </div>
          {user?.id && (
            <div className="col-span-2">
              <span className="text-muted-foreground">User ID</span>
              <p className="font-mono text-xs mt-0.5 text-muted-foreground">
                {user.id}
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* Theme */}
      <Section title="Theme" description="Choose your preferred appearance">
        <div className="flex gap-3">
          <ThemeOption label="Light" value="light" current={settings.theme} onSelect={setTheme} />
          <ThemeOption label="Dark" value="dark" current={settings.theme} onSelect={setTheme} />
          <ThemeOption label="System" value="system" current={settings.theme} onSelect={setTheme} />
        </div>
      </Section>

      {/* Notification Preferences */}
      <Section
        title="Notifications"
        description="Control which events trigger in-app notifications"
      >
        <div className="space-y-1">
          <Toggle
            label="Record created"
            checked={settings.notifications.onCreate}
            onChange={(v) => setNotificationPref("onCreate", v)}
          />
          <Toggle
            label="Record updated"
            checked={settings.notifications.onUpdate}
            onChange={(v) => setNotificationPref("onUpdate", v)}
          />
          <Toggle
            label="Record deleted"
            checked={settings.notifications.onDelete}
            onChange={(v) => setNotificationPref("onDelete", v)}
          />
        </div>
      </Section>
    </div>
  );
}
