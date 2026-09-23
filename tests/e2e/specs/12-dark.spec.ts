import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { findProjectId } from "../src/api.js";
import { E2E, ROLES } from "../src/data.js";

/** Dark mode: app renders themed, no invisible text. */
test.describe("dark mode", () => {
  test("landing, dashboard and project render dark with legible headings", async ({ page, baseURL }) => {
    await page.goto("/");
    const landingBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(landingBg).not.toBe("rgb(255, 255, 255)");

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    const id = await findProjectId(E2E.projectAlpha);
    await page.goto(`/projects/${id}`);
    await expect(page.getByTestId("text-project-title")).toBeVisible({ timeout: 30_000 });
    const color = await page.getByTestId("text-project-title").evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe("rgb(0, 0, 0)");
  });
});
