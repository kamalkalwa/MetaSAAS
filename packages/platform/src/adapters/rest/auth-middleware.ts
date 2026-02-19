/**
 * Fastify Authentication Middleware
 *
 * Intercepts incoming HTTP requests and verifies authentication tokens.
 * Extracts the Bearer token from the Authorization header, verifies it
 * through the configured AuthProvider, and attaches the Caller to the
 * request object for downstream handlers.
 *
 * Public routes (health check, meta endpoints, auth config) are exempt.
 *
 * Usage: Register this as a Fastify preHandler hook during bootstrap.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { getAuthProvider } from "../../auth/index.js";
import type { Caller } from "@metasaas/contracts";

/**
 * Routes that do NOT require authentication.
 * Health checks and public metadata endpoints.
 */
const PUBLIC_ROUTES = new Set([
  "/health",
  "/api/health",
  "/api/meta/entities",
  "/api/auth/config",
]);

/**
 * Extend Fastify's request type to include the authenticated caller.
 * This is the standard Fastify pattern for adding custom properties.
 */
declare module "fastify" {
  interface FastifyRequest {
    caller?: Caller;
  }
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  return parts[1];
}

/**
 * Fastify preHandler hook that enforces authentication.
 *
 * For protected routes:
 *   1. Extracts the Bearer token from the Authorization header
 *   2. Verifies it through the AuthProvider
 *   3. Attaches the Caller to request.caller
 *   4. Returns 401 if the token is missing or invalid
 *
 * For public routes: passes through without checking.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip CORS preflight requests — these are handled by @fastify/cors.
  // Preflight OPTIONS requests never carry Authorization headers, so
  // attempting token verification would always fail and break CORS.
  if (request.method === "OPTIONS") {
    return;
  }

  // Skip auth for public routes
  const path = request.url.split("?")[0]; // strip query params
  if (PUBLIC_ROUTES.has(path)) {
    return;
  }

  // Skip auth for entity metadata by path prefix (supports /api/meta/entities/:name)
  if (path.startsWith("/api/meta/")) {
    return;
  }

  const provider = getAuthProvider();
  const token = extractBearerToken(request);

  // If no token is provided, try verifying with empty string.
  // The DevAuthProvider accepts anything; real providers return null.
  const caller = await provider.verifyToken(token ?? "");

  if (!caller) {
    // Only return 401 if the provider rejected the request
    reply.status(401).send({
      success: false,
      error: token
        ? "Invalid or expired authentication token."
        : "Authentication required. Provide a Bearer token in the Authorization header.",
    });
    return;
  }

  // Attach the authenticated caller to the request
  request.caller = caller;
}
