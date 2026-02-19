"use client";

/**
 * Root page — redirects based on auth state.
 *
 * Auth enabled + no user → /login
 * Auth enabled + user    → /dashboard
 * Auth disabled (dev)    → /dashboard
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, loading, authEnabled } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (authEnabled && !user) {
      router.replace("/login");
    } else {
      router.replace("/dashboard");
    }
  }, [loading, authEnabled, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}
