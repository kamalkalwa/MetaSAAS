/**
 * Supabase Auth Provider
 *
 * Implements the AuthProvider contract using Supabase Auth.
 * Verifies JWTs issued by Supabase and extracts user identity
 * into a Caller object that the platform understands.
 *
 * Swap this out for InHouseAuthProvider later by:
 *   1. Creating a new class that implements AuthProvider
 *   2. Changing the bootstrap to inject the new provider
 *   3. Everything else stays the same (DIP in action)
 *
 * Required environment variables:
 *   SUPABASE_URL        — Your Supabase project URL
 *   SUPABASE_ANON_KEY   — The public anon/API key (safe for frontend)
 *   SUPABASE_SERVICE_KEY — The service role key (server-side only, never expose)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthProvider, AuthResult } from "@metasaas/contracts";
import { DEV_TENANT_ID } from "./dev-provider.js";

export class SupabaseAuthProvider implements AuthProvider {
  private readonly client: SupabaseClient;
  private readonly projectUrl: string;

  constructor(config: {
    url: string;
    serviceKey: string;
  }) {
    this.projectUrl = config.url;
    // Use the service role key for server-side token verification
    this.client = createClient(config.url, config.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Verify a Supabase JWT and extract the authenticated user.
   *
   * @param token - The JWT from the Authorization: Bearer header
   * @returns Caller object if valid, null if invalid/expired
   */
  async verifyToken(token: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    const user = data.user;

    return {
      userId: user.id,
      // Use app_metadata.tenant_id if set, otherwise the default dev tenant UUID.
      // The fallback must be a valid UUID since tenant_id is a UUID column.
      tenantId: (user.app_metadata?.tenant_id as string) ?? DEV_TENANT_ID,
      // Roles from app_metadata or default to ["user"]
      roles: (user.app_metadata?.roles as string[]) ?? ["user"],
      type: "human",
    };
  }

  /**
   * Returns the public Supabase config needed by the frontend.
   * The anon key is intentionally public — it's safe to expose.
   */
  getPublicConfig(): Record<string, string> {
    return {
      provider: "supabase",
      projectUrl: this.projectUrl,
    };
  }
}

/**
 * Factory function to create a SupabaseAuthProvider from environment variables.
 * Throws if required variables are missing.
 */
export function createSupabaseAuthProvider(): SupabaseAuthProvider {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE_URL environment variable is required for Supabase auth."
    );
  }
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_KEY environment variable is required for Supabase auth."
    );
  }

  return new SupabaseAuthProvider({ url, serviceKey });
}
