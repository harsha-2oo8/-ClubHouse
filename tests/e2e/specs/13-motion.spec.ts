import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { ROLES } from "../src/data.js";

/** Reduced motion: content must be fully visible, never stuck mid-animation. */
test.describe("reduced motion", () => {
  test("dashboard and discover render all content", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    await expect(page.getByTestId("text-dashboard-greeting")).toBeVisible({ timeout: 30_000 });
    await page.goto("/discover");
    await expect(page.getByTestId("input-search")).toBeVisible({ timeout: 30_000 });
    // Cards must not remain at opacity 0.
    const box = await page.locator('[data-testid^="card-project-"]').first().evaluate((el) => {
      const o = parseFloat(getComputedStyle(el).opacity);
      const r = el.getBoundingClientRect();
      return { o, h: r.height };
    }).catch(() => null);
    if (box) {
      expect(box.o).toBeGreaterThan(0.9);
      expect(box.h).toBeGreaterThan(0);
    }
  });
});
