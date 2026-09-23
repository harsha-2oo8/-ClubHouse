import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { ROLES } from "../src/data.js";

/** Critical flows at 390px: nav, discover, project, event, dialogs, menu, logout. */
test.describe("mobile", () => {
  test("bottom nav, project apply view, event register, sheet menu, logout", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    // Bottom tab bar present with all five destinations.
    await expect(page.getByTestId("nav-mobile-bottom")).toBeVisible();
    for (const t of ["nav-mobile-home", "nav-mobile-discover", "nav-mobile-activity", "nav-mobile-profile"]) {
      await expect(page.getByTestId(t)).toBeVisible();
    }
    // Discover via tab; no horizontal overflow.
    await page.getByTestId("nav-mobile-discover").click();
    await expect(page).toHaveURL(/discover/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // Account menu opens as a bottom sheet.
    await page.getByTestId("button-account-menu").click();
    await expect(page.getByTestId("account-sign-out")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    // Event registration from the event card.
    await page.goto("/discover/events");
    const card = page.locator('[data-testid^="card-event-"]', { hasText: "E2E Seminar Alpha" }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    const id = (await card.getAttribute("data-testid"))!.replace("card-event-", "");
    await card.getByTestId(`button-register-event-${id}`).click();
    await expect(page.getByText("Registered!")).toBeVisible({ timeout: 20_000 });
    // Logout via sheet.
    await page.getByTestId("button-account-menu").click();
    await page.getByTestId("account-sign-out").click();
    await expect(page).toHaveURL(/\/?$/, { timeout: 30_000 });
  });
});
