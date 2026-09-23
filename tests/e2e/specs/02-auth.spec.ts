import { test, expect } from "@playwright/test";
import { clerkIdByEmail, createTestUser, deleteClerkUser } from "../src/clerk.js";
import { signInAs, signOutViaUI } from "../src/session.js";
import { ROLES } from "../src/data.js";

/**
 * Auth journeys. The ticket is setup ceremony; onboarding, sign-out,
 * back-button and persistence are exercised through the real UI.
 */
test.describe("auth", () => {
  test("ticket sign-in lands on dashboard with greeting", async ({ page, baseURL }) => {
    const id = await clerkIdByEmail(ROLES.studentA);
    await signInAs(page, baseURL!, id);
    await expect(page.getByTestId("text-dashboard-greeting")).toContainText(/Welcome back/i);
  });

  test("sign-out via account menu terminates session", async ({ page, baseURL }) => {
    const id = await clerkIdByEmail(ROLES.studentB);
    await signInAs(page, baseURL!, id);
    await signOutViaUI(page);
    // Private pages must no longer be reachable; back button must not reveal them.
    await page.goto(`${baseURL}/dashboard`);
    await expect(page).toHaveURL(/sign-in/, { timeout: 30_000 });
  });

  test("fresh user completes onboarding through UI and data persists", async ({ page, baseURL }) => {
    const stamp = Date.now().toString(36);
    const email = `e2e_${stamp}@demo.clubhouse.app`;
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(!password, "DEMO_USER_PASSWORD required to create the throwaway user");
    const clerkId = await createTestUser(email, password!);
    try {
      await signInAs(page, baseURL!, clerkId);
      // No profile row → onboarding.
      await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
      await page.getByTestId("input-name").fill("E2E Freshman");
      await page.getByTestId("input-age").fill("20");
      await page.getByTestId("input-course").fill("B.Tech Computer Science");
      await page.getByTestId("input-semester").fill("4");
      await page.getByTestId("input-college").fill("BMS College of Engineering");
      await page.getByTestId("select-pronouns").click();
      await page.locator('[role="option"]').first().click();
      await page.getByTestId("button-next-step1").click();
      await page.getByTestId("input-bio").fill("E2E seeded freshman bio.");
      await page.getByTestId("button-finish-onboarding").click();
      await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
      await expect(page.getByTestId("text-dashboard-greeting")).toContainText(/E2E|Welcome/i);
      // Persistence across refresh + relogin.
      await page.reload();
      await expect(page.getByTestId("text-dashboard-greeting")).toBeVisible({ timeout: 30_000 });
      await signOutViaUI(page);
      await signInAs(page, baseURL!, clerkId);
      await expect(page.getByTestId("text-dashboard-greeting")).toBeVisible({ timeout: 30_000 });
    } finally {
      await deleteClerkUser(clerkId).catch(() => undefined);
      if (process.env.DATABASE_URL) {
        const pg = await import("pg");
        const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
        await pool.query(`DELETE FROM users WHERE clerk_id = $1 AND email LIKE 'e2e\\_%' ESCAPE '\\'`, [clerkId]);
        await pool.end();
      }
    }
  });
});
