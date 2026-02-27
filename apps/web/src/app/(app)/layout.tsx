"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { fetchAllEntityMeta } from "@/lib/api-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";

const ChatSidebar = dynamic(
  () => import("@/components/chat-sidebar").then((m) => ({ default: m.ChatSidebar })),
  { ssr: false }
);
import type { EntityDefinition } from "@metasaas/contracts";

/**
 * Icon component — renders a Lucide icon by name.
 * Uses a simple SVG mapping for v0 (no dynamic icon loading needed).
 */
function Icon({ name, className }: { name: string; className?: string }) {
  // Simple icon set for v0. Expand as needed.
  const icons: Record<string, string> = {
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    building: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4",
    "layout-dashboard": "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
    "folder-kanban": "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2zM8 10v4M12 10v2M16 10v6",
    "check-square": "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
    "credit-card": "M1 10h22M1 6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6z",
    package: "M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  };

  const path = icons[name] ?? icons["package"];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

/**
 * App Layout — the main application shell.
 *
 * Renders a sidebar with navigation items dynamically generated
 * from the entity registry, plus the main content area.
 *
 * Auth guard:
 *   When authentication is enabled and the user is not logged in,
 *   they are redirected to the login page.
 *   In dev mode (auth not enabled), access is unrestricted.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, authEnabled, signOut } = useAuth();
  const [entities, setEntities] = useState<EntityDefinition[]>([]);

  useEffect(() => {
    fetchAllEntityMeta()
      .then(setEntities)
      .catch((err) => console.error("Failed to load entity metadata:", err));
  }, []);

  useEffect(() => {
    // Auth guard: redirect to login if auth is enabled but user is not authenticated
    if (!loading && authEnabled && !user) {
      router.replace("/login");
    }
  }, [loading, authEnabled, user, router]);

  // Show loading state while checking authentication
  if (loading || (authEnabled && !user)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  // Build nav items from entities
  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    ...entities.map((e) => ({
      label: e.pluralName,
      href: `/${e.pluralName.toLowerCase()}`,
      icon: e.ui.icon,
    })),
    { label: "Activity", href: "/activity", icon: "activity" },
    { label: "Billing", href: "/billing", icon: "credit-card" },
  ];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-sidebar-border">
          <span className="text-lg font-semibold tracking-tight">
            MetaSAAS
          </span>
          <NotificationBell />
        </div>

        {/* Command Bar shortcut hint */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => {
              // Programmatically trigger the command bar by dispatching Cmd+K
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  ctrlKey: true,
                  bubbles: true,
                })
              );
            }}
            className={cn(
              "w-full flex items-center gap-2 rounded-md border border-border",
              "bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground",
              "hover:bg-accent/50 hover:text-foreground transition-colors cursor-pointer"
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            <span className="flex-1 text-left">Command</span>
            <kbd className="text-[10px] font-medium border border-border rounded px-1 py-0.5">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          {/* Settings link */}
          <Link
            href="/settings"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon name="settings" />
            Settings
          </Link>

          {authEnabled && user && (
            <div className="flex items-center justify-between">
              <span
                className="text-xs text-muted-foreground truncate max-w-[140px]"
                title={user.email ?? ""}
              >
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            MetaSAAS v0.0.2
          </div>
        </div>
      </aside>

      {/* Main content — wrapped in error boundary to isolate page crashes */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <ErrorBoundary fallbackMessage="This page encountered an error. Try navigating to a different page.">
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* AI Chat Sidebar — error boundary prevents chat crashes from breaking the app */}
      <ErrorBoundary fallbackMessage="The AI assistant encountered an error. Click retry to reload it.">
        <ChatSidebar />
      </ErrorBoundary>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette />
    </div>
  );
}
