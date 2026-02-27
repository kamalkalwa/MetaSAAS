/**
 * MetaSAAS API Server
 *
 * Fastify entry point. Boots the platform, registers routes, starts listening.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { registerRESTRoutes, registerPluginRoutes, closeDatabase, initWebhooks, flushObservability, captureException } from "@metasaas/platform";
import { bootstrap } from "./bootstrap.js";

async function main() {
  // 1. Bootstrap platform + domain
  const config = await bootstrap();

  // 2. Create Fastify instance
  const app = Fastify({
    logger: false, // We use our own structured logging
    // Trust proxy headers when behind a reverse proxy (e.g., Nginx, Cloudflare).
    // Required for rate limiting to use the real client IP, not the proxy's.
    trustProxy: process.env.NODE_ENV === "production",
  });

  // 3a. Security headers via Helmet (XSS, clickjacking, MIME sniffing, etc.)
  await app.register(helmet, {
    // Content Security Policy disabled in dev for hot reload; enable in production
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  });

  // 3b. Rate limiting — protects against brute force and API abuse.
  //     Public routes (health, meta) get a much higher ceiling.
  //     In non-production environments, the default limit is generous
  //     to avoid interfering with rapid development and E2E tests.
  const isProd = process.env.NODE_ENV === "production";
  const publicPaths = new Set(["/api/health", "/api/meta/entities"]);

  await app.register(rateLimit, {
    max: (req) => {
      if (publicPaths.has(req.url)) return 10_000;
      return Number(process.env.RATE_LIMIT_MAX ?? (isProd ? 100 : 1_000));
    },
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  });

  // 3c. CORS — environment-based lockdown.
  //     In production, only allow the configured frontend origin.
  //     In development, allow all origins for convenience.
  const corsOrigin = process.env.CORS_ORIGIN;
  await app.register(cors, {
    origin: corsOrigin
      ? corsOrigin.split(",").map((o) => o.trim())
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // 4. Health check
  app.get("/api/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  // 5. Initialize webhook system (subscribes to Event Bus)
  initWebhooks();

  // 6. Register all REST routes (generated from Action Bus + Entity Registry)
  await registerRESTRoutes(app);

  // 7. Register plugin routes (if any plugins added Fastify routes)
  await registerPluginRoutes(app);

  // 8. Start server
  await app.listen({
    port: config.api.port,
    host: config.api.host,
  });

  console.log(
    `\n  MetaSAAS API running at http://localhost:${config.api.port}\n`
  );

  // 7. Graceful shutdown
  const shutdown = async () => {
    console.log("\n[shutdown] Closing...");
    await app.close();
    await flushObservability(2000);
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  captureException(err instanceof Error ? err : new Error(String(err)));
  await flushObservability(2000).catch(() => {});
  process.exit(1);
});
