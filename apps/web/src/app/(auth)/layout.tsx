"use client";

/**
 * Auth Layout
 *
 * Centers the login/signup forms on a minimal, clean background.
 * If the user is already authenticated (and auth is enabled),
 * they are redirected to the dashboard.
 */

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading, authEnabled } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If auth is enabled and user is already logged in, go to dashboard
    if (!loading && authEnabled && user) {
      router.replace("/dashboard");
    }
  }, [loading, authEnabled, user, router]);

  // Show nothing while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
