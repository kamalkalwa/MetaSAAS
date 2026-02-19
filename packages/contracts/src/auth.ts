/**
 * Authentication Contract
 *
 * Defines the AuthProvider interface — the abstraction that decouples
 * the application from any specific authentication implementation.
 *
 * Follows the Dependency Inversion Principle (DIP):
 *   - High-level modules (Action Bus, middleware) depend on this interface
 *   - Low-level modules (Supabase, in-house auth) implement it
 *   - The concrete provider is injected at startup, not imported directly
 *
 * Swapping auth providers (e.g., Supabase → in-house) requires:
 *   1. Implementing a new class that satisfies AuthProvider
 *   2. Changing the bootstrap code to inject the new provider
 *   3. No changes to middleware, actions, or frontend logic
 */

import type { Caller } from "./context.js";

/**
 * The result of verifying an authentication token.
 * Either a valid Caller (authenticated) or null (invalid/expired token).
 */
export type AuthResult = Caller | null;

/**
 * The contract that every authentication provider must implement.
 *
 * @example
 * class SupabaseAuthProvider implements AuthProvider {
 *   async verifyToken(token: string): Promise<AuthResult> {
 *     // Verify JWT using Supabase's public key
 *     // Extract userId, tenantId, roles from claims
 *     // Return a Caller object or null
 *   }
 *   getPublicConfig(): Record<string, string> {
 *     return { projectUrl: process.env.SUPABASE_URL! };
 *   }
 * }
 */
export interface AuthProvider {
  /**
   * Verify an authentication token and extract caller identity.
   *
   * @param token - The raw token (typically a JWT from the Authorization header)
   * @returns The authenticated Caller, or null if the token is invalid/expired
   */
  verifyToken(token: string): Promise<AuthResult>;

  /**
   * Returns public configuration that the frontend needs to initialize
   * the auth client (e.g., Supabase project URL, OAuth endpoints).
   *
   * This is served by a public API endpoint — never include secrets.
   */
  getPublicConfig(): Record<string, string>;
}
