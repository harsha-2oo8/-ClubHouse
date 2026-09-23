import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { E2E, ROLES } from "../src/data.js";

/** Student A registers E2E College Alpha (+Beta for cross-college tests). */
test.describe("college registration", () => {
  test("student registers a college; status stays pending", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover/colleges");
    await page.getByTestId("button-register-college").click();
    await page.getByTestId("input-college-name").fill(E2E.collegeAlpha);
    await page.getByTestId("input-college-location").fill("E2E Test District, Bengaluru");
    await page.getByTestId("button-submit-college").click();
    await expect(page.getByText("College submitted for review!")).toBeVisible({ timeout: 20_000 });
    // Pending: must NOT appear in the approved discovery list yet.
    await page.goto("/discover/colleges");
    await expect(page.getByText(E2E.collegeAlpha, { exact: true })).toHaveCount(0);
  });

  test("second college for cross-college tests", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover/colleges");
    await page.getByTestId("button-register-college").click();
    await page.getByTestId("input-college-name").fill(E2E.collegeBeta);
    await page.getByTestId("input-college-location").fill("E2E Test District, Bengaluru");
    await page.getByTestId("button-submit-college").click();
    await expect(page.getByText("College submitted for review!")).toBeVisible({ timeout: 20_000 });
  });
});
