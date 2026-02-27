import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Load environment variables from the monorepo root .env file.
 *
 * Next.js only auto-loads .env from its own project directory (apps/web/),
 * but our single .env lives at the monorepo root for centralized configuration.
 * This is the same pattern used in apps/api/src/index.ts.
 *
 * The `env` config key explicitly forwards NEXT_PUBLIC_* values into the
 * client-side JavaScript bundle, since Next.js's built-in NEXT_PUBLIC_*
 * inlining only picks up vars from its own env loading phase.
 *
 * @see https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  /** Transpile workspace packages so Next.js can process them */
  transpilePackages: ["@metasaas/contracts", "@metasaas/ui"],

  /**
   * Explicitly forward NEXT_PUBLIC_* env vars into the client bundle.
   * Values come from the monorepo root .env loaded by dotenv above.
   */
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
};

export default nextConfig;
