/**
 * Development Auth Provider
 *
 * A no-op auth provider for local development when no external auth
 * service is configured. Always returns a hardcoded admin caller.
 *
 * NEVER use this in production — it bypasses all authentication.
 *
 * Activated automatically when SUPABASE_URL is not set and
 * NODE_ENV !== "production".
 */

import type { AuthProvider, AuthResult } from "@metasaas/contracts";

/**
 * Deterministic UUID for the development tenant.
 * Used by DevAuthProvider and the seed script so dev data is visible.
 */
export const DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/** The default caller used in development mode */
const DEV_CALLER = {
  userId: "dev-user",
  tenantId: DEV_TENANT_ID,
  roles: ["admin"] as string[],
  type: "human" as const,
};

export class DevAuthProvider implements AuthProvider {
  /**
   * In dev mode, any token (or no token) returns the hardcoded admin caller.
   */
  async verifyToken(_token: string): Promise<AuthResult> {
    return DEV_CALLER;
  }

  getPublicConfig(): Record<string, string> {
    return {
      provider: "dev",
      message: "Development mode — authentication is bypassed",
    };
  }
}
