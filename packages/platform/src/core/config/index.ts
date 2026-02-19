/**
 * Application Configuration
 *
 * Loads configuration from environment variables with sensible defaults.
 * All config is validated at startup — fail fast if misconfigured.
 */

export interface AppConfig {
  database: {
    url: string;
  };
  api: {
    port: number;
    host: string;
  };
  web: {
    url: string;
  };
}

/**
 * Loads configuration from process.env.
 * Throws immediately if required variables are missing.
 */
export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. See .env.example."
    );
  }

  return {
    database: {
      url: databaseUrl,
    },
    api: {
      port: parseInt(process.env.API_PORT ?? "4000", 10),
      host: process.env.API_HOST ?? "0.0.0.0",
    },
    web: {
      url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
    },
  };
}
