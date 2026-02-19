/**
 * Supabase Client (Browser)
 *
 * Creates a Supabase client for use in the browser.
 * Reads configuration from environment variables set at build time.
 *
 * When NEXT_PUBLIC_SUPABASE_URL is not set, returns null — the app
 * should fall back to "dev mode" (no authentication).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client singleton.
 * Returns null if Supabase is not configured (dev mode).
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey);
  }

  return supabaseClient;
}

/**
 * Whether Supabase auth is configured.
 * When false, the app runs in "dev mode" without authentication.
 */
export function isAuthEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
