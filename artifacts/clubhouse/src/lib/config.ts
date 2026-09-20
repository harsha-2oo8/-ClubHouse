/**
 * Centralized, typed frontend configuration.
 *
 * RULE: only VITE_* values may appear here (Vite embeds them in the bundle).
 * Secrets must NEVER use the VITE_ prefix — anything here ships to browsers.
 */

function read(name: string): string {
  const v = import.meta.env[name];
  return typeof v === "string" ? v.trim() : "";
}

const clerkPublishableKey = read("VITE_CLERK_PUBLISHABLE_KEY");
if (!clerkPublishableKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Set it in Vercel → Environment Variables (production Clerk uses pk_live_…).",
  );
}

const isProdBuild = import.meta.env.PROD === true;

if (isProdBuild && clerkPublishableKey.startsWith("pk_test_")) {
  // Console-only (never UI): tells the deployer why Clerk shows "development mode".
  console.warn(
    "[config] Production build is using a Clerk DEVELOPMENT key (pk_test_). " +
      "Clerk will display 'development mode'. Switch VITE_CLERK_PUBLISHABLE_KEY " +
      "to pk_live_… from a production instance and redeploy.",
  );
}

export const appConfig = {
  clerkPublishableKey,
  /** Render API origin, e.g. https://clubhouse-api-xxxx.onrender.com. Empty = same-origin /api. */
  apiUrl: read("VITE_API_URL"),
  appUrl: read("VITE_APP_URL"),
  clerkProxyUrl: read("VITE_CLERK_PROXY_URL") || undefined,
  isProdBuild,
} as const;

export type AppConfig = typeof appConfig;
