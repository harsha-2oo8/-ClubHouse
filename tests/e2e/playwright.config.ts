import { defineConfig, devices } from "@playwright/test";

/**
 * ClubHouse E2E — real Edge browser against the deployed stack.
 *
 * Required env (never commit; see docs/E2E_TEST_ACCOUNTS.md):
 *   E2E_BASE_URL       Vercel frontend origin, e.g. https://clubhouse-xxx.vercel.app
 *   E2E_API_URL        Render API origin, e.g. https://clubhouse-api-yxsm.onrender.com
 *   CLERK_SECRET_KEY   sk_... for sign-in tickets (test setup only)
 *   DATABASE_URL       pooler URI — verification + guarded cleanup ONLY
 *
 * Safety: specs create ONLY E2E_*-prefixed rows; cleanup deletes only those.
 * Authenticated specs sign in via Clerk sign-in tickets (setup ceremony);
 * every business action itself goes through the real UI.
 */
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("E2E_BASE_URL is required (Vercel frontend origin).");
}

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false, // journeys share prod data; run serially for determinism
  retries: 0, // honest first run — no masking flakes
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "e2e",
      use: {
        channel: "msedge", // real system Edge on Windows
        viewport: { width: 1366, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        channel: "msedge",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "dark",
      testMatch: /dark\.spec\.ts/,
      use: {
        channel: "msedge",
        colorScheme: "dark",
        viewport: { width: 1366, height: 900 },
      },
    },
    {
      name: "reduced-motion",
      testMatch: /motion\.spec\.ts/,
      use: {
        channel: "msedge",
        reducedMotion: "reduce",
      },
    },
  ],
});
