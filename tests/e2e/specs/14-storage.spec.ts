import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs, sessionToken } from "../src/session.js";
import { ROLES } from "../src/data.js";

/**
 * Storage through the browser session. GCS is not configured in prod, so
 * uploads must fail CLOSED (503, clear message) — never silently, never open.
 */
test.describe("storage", () => {
  test("signed-out upload-URL minting is rejected", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    const r = await page.evaluate(async (apiURL: string) => {
      const res = await fetch(`${apiURL}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x.png", size: 100, contentType: "image/png" }),
      });
      return res.status;
    }, apiURL);
    expect(r).toBe(401);
    void baseURL;
  });

  test("oversized upload rejected; unconfigured backend fails closed", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    const token = await sessionToken(page);
    const big = await page.evaluate(
      async ({ apiURL, token }: { apiURL: string; token: string }) => {
        const res = await fetch(`${apiURL}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: "big.png", size: 11 * 1024 * 1024, contentType: "image/png" }),
        });
        return { status: res.status, body: await res.text() };
      },
      { apiURL: apiURL!, token },
    );
    expect(big.status).toBe(400);
    const small = await page.evaluate(
      async ({ apiURL, token }: { apiURL: string; token: string }) => {
        const res = await fetch(`${apiURL}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: "small.png", size: 100, contentType: "image/png" }),
        });
        return { status: res.status, body: await res.text() };
      },
      { apiURL: apiURL!, token },
    );
    // GCS unconfigured in prod AND legacy sidecar absent → clean 503, not a silent success.
    expect(small.status).toBe(503);
    expect(small.body).toMatch(/not configured/i);
  });

  test("private object path requires a session", async ({ page }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    const r = await page.evaluate(async (apiURL: string) => {
      const res = await fetch(`${apiURL}/api/storage/gcs/private/nope/x.png`);
      return res.status;
    }, apiURL);
    expect([401, 403, 404]).toContain(r);
  });
});
