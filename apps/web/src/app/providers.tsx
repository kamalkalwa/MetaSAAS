"use client";

/**
 * Global Providers
 *
 * Wraps the application in all required React context providers.
 * Currently:
 *   - AuthProvider (session management, login/logout)
 *   - Token wiring (connects auth to the API client)
 *
 * Adding a new global provider? Add it here so every page receives it.
 */

import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { setTokenProvider } from "@/lib/api-client";
import { ToastProvider } from "@metasaas/ui";

/**
 * Bridges the auth context to the API client.
 * Runs once on mount to register the token provider function.
 */
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenProvider(getToken);
  }, [getToken]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TokenBridge>
        <ToastProvider>{children}</ToastProvider>
      </TokenBridge>
    </AuthProvider>
  );
}
