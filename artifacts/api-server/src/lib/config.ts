/**
 * Centralized, validated server configuration.
 *
 * Imported first by `app.ts`, so misconfiguration fails fast at boot with an
 * actionable message instead of a cryptic runtime error.
 *
 * Conventions:
 * - REQUIRED vars throw when missing.
 * - Secrets are never logged (only their presence/shape is ever reported).
 * - GCS_* are optional here; the storage layer validates them when uploads
 *   are actually used (so deploys without file uploads keep working).
 */

function required(name: string, hint: string): string {
  const raw = process.env[name];
  if (!raw || !raw.trim()) {
    throw new Error(
      `${name} is required but was not provided. ${hint}`,
    );
  }
  return raw.trim();
}

function optional(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function stringList(name: string): string[] {
  const raw = process.env[name] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => s.length > 0);
}

function intVar(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < min) {
    throw new Error(
      `${name} must be an integer >= ${min} (got "${raw}").`,
    );
  }
  return n;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

function normalizePrivateKey(key: string): string {
  // Render/Vercel env vars often carry literal "\n" sequences.
  return key.replace(/\\n/g, "\n");
}

function load() {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided. " +
        "Render supplies PORT automatically; locally, export PORT=8080.",
    );
  }
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}".`);
  }

  // --- CORS origins ---------------------------------------------------------
  // CORS_ORIGINS=https://app.example.com,https://admin.example.com
  // When unset: development allows local origins; production falls back to
  // reflecting the request origin with a loud startup warning (keeps existing
  // deploys working until the allowlist is configured — see PRODUCTION_SETUP).
  const corsOrigins = stringList("CORS_ORIGINS");
  if (isProduction && corsOrigins.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      "[config] WARNING: CORS_ORIGINS is not set in production — reflecting " +
        "request origins. Set CORS_ORIGINS to your Vercel/custom domain(s) " +
        "to lock this down.",
    );
  }

  return {
    nodeEnv,
    isProduction,
    port,
    databaseUrl: required(
      "DATABASE_URL",
      "Use the Supabase Session pooler URI (port 5432). The direct db.* host is IPv6-only.",
    ),
    clerkPublishableKey: required(
      "CLERK_PUBLISHABLE_KEY",
      "Copy it from Clerk Dashboard → API keys. Production must use pk_live_….",
    ),
    clerkSecretKey: required(
      "CLERK_SECRET_KEY",
      "Copy it from Clerk Dashboard → API keys. Production must use sk_live_…. Never put this in frontend env.",
    ),
    adminEmails: stringList("ADMIN_EMAILS").map((s) => s.toLowerCase()),
    adminClerkIds: stringList("ADMIN_CLERK_IDS").map((s) => s.toLowerCase()),
    /** null = reflect request origin (dev default / prod fallback with warning). */
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : null,
    logLevel: optional("LOG_LEVEL", "info"),
    gcs: {
      projectId: optional("GCS_PROJECT_ID"),
      bucketName: optional("GCS_BUCKET_NAME"),
      clientEmail: optional("GCS_CLIENT_EMAIL"),
      privateKey: normalizePrivateKey(optional("GCS_PRIVATE_KEY")),
    },
    rateLimit: {
      windowMs: intVar("RATE_LIMIT_WINDOW_MS", 60_000, 1000),
      writeMax: intVar("RATE_LIMIT_WRITE_MAX", 20, 1),
      searchMax: intVar("RATE_LIMIT_SEARCH_MAX", 60, 1),
    },
  };
}

export type AppConfig = ReturnType<typeof load>;

let cached: AppConfig | null = null;

/**
 * Validated configuration singleton. Throws with an actionable message on
 * first call when REQUIRED vars are missing. Safe to import anywhere —
 * validation is deferred until first use so unit tests can stub env first.
 */
export function getConfig(): AppConfig {
  if (!cached) cached = load();
  return cached;
}

/** Test-only: reset the cached config after stubbing env. */
export function resetConfigForTests(): void {
  cached = null;
}

export function isTestClerkKey(key: string): boolean {
  return key.startsWith("pk_test_") || key.startsWith("sk_test_");
}
