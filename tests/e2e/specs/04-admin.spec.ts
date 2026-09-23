import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { E2E, ROLES } from "../src/data.js";

/**
 * Admin journey: approve both E2E colleges, verify audit trail + discovery.
 * Runs after 03 (colleges exist as pending).
 */
test.describe("admin approvals", () => {
  test("admin approves E2E colleges; audit + discovery update", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.adminEmail));
    await page.goto("/admin");
    await expect(page.getByTestId("tab-colleges")).toBeVisible({ timeout: 30_000 });

    for (const name of [E2E.collegeAlpha, E2E.collegeBeta]) {
      const card = page.locator('[data-testid^="card-college-registration-"]', { hasText: name });
      await expect(card).toBeVisible({ timeout: 20_000 });
      await card.getByTestId(/button-approve-college-/).click();
      await expect(page.getByText(`College approved`, { exact: false })).toBeVisible({ timeout: 20_000 });
    }

    // Audit trail records both approvals.
    await page.getByTestId("tab-audit").click();
    await expect(page.getByText("college_registration_approved").first()).toBeVisible({ timeout: 20_000 });

    // Student-facing discovery now lists the approved college.
    await page.goto("/discover/colleges");
    await expect(page.getByText(E2E.collegeAlpha, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("admin dashboard stats + users search render", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.adminEmail));
    await page.goto("/admin");
    await expect(page.getByTestId("card-admin-stat-total-users")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("card-admin-stat-total-users")).toContainText(/\d+/);
  });

  test("student cannot open admin APIs (403)", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    const { clerkIdByEmail: byEmail } = await import("../src/clerk.js");
    const { sessionToken } = await import("../src/session.js");
    await signInAs(page, baseURL!, await byEmail(ROLES.studentB));
    const token = await sessionToken(page);
    const r = await page.evaluate(
      async ({ apiURL, token }: { apiURL: string; token: string }) => {
        const res = await fetch(`${apiURL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status;
      },
      { apiURL: apiURL!, token },
    );
    expect(r).toBe(403);
  });
});
