/**
 * Auth Module
 *
 * Manages the active AuthProvider instance. The provider is set at
 * startup (in bootstrap) and used by the auth middleware to verify
 * every incoming request.
 *
 * Provider selection:
 *   - If SUPABASE_URL is set → SupabaseAuthProvider
 *   - Otherwise in non-production → DevAuthProvider (bypasses auth)
 *   - In production without config → throws (fail fast)
 */

import type { AuthProvider } from "@metasaas/contracts";
import { SupabaseAuthProvider, createSupabaseAuthProvider } from "./supabase-provider.js";
import { DevAuthProvider } from "./dev-provider.js";

/** The singleton auth provider instance */
let authProvider: AuthProvider | null = null;

/**
 * Initialize the auth provider based on environment configuration.
 * Call this once at startup (in bootstrap).
 */
export function initAuthProvider(): AuthProvider {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    authProvider = createSupabaseAuthProvider();
    console.log("[auth] Using Supabase auth provider");
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Authentication must be configured in production. " +
      "Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
    );
  } else {
    authProvider = new DevAuthProvider();
    console.log("[auth] Using development auth provider (no authentication)");
  }

  return authProvider;
}

/**
 * Get the active auth provider.
 * Throws if initAuthProvider() hasn't been called.
 */
export function getAuthProvider(): AuthProvider {
  if (!authProvider) {
    throw new Error(
      "Auth provider not initialized. Call initAuthProvider() in bootstrap."
    );
  }
  return authProvider;
}

/**
 * Set a custom auth provider (for testing or custom implementations).
 */
export function setAuthProvider(provider: AuthProvider): void {
  authProvider = provider;
}

// Re-export provider implementations
export { SupabaseAuthProvider, createSupabaseAuthProvider } from "./supabase-provider.js";
export { DevAuthProvider } from "./dev-provider.js";
