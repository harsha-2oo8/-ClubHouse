import { test, expect } from "@playwright/test";

/**
 * Guest access: everything public must render with zero auth, and no
 * dev/debug residue may appear anywhere.
 */
test.describe("guest access", () => {
  test("landing loads with live content, no dev residue", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("button-cta-explore")).toBeVisible();
    await expect(page.getByText("Find your people.")).toBeVisible();
    for (const bad of ["Development mode", "Development instance", "localhost", "Replit", "TODO", "debug"]) {
      await expect(page.getByText(bad, { exact: false })).toHaveCount(0);
    }
  });

  test("public discovery pages render", async ({ page }) => {
    for (const [url, marker] of [
      ["/discover", "input-search"],
      ["/discover/colleges", "text-college-name-"],
      ["/discover/events", "select-type-filter"],
      ["/clubs", "card-club-"],
    ] as Array<[string, string]>) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain(url.split("?")[0]);
    }
    // At least the seeded demo content must be visible somewhere public.
    await page.goto("/discover");
    await expect(page.getByText(/\[Demo\]/).first()).toBeVisible({ timeout: 30_000 });
  });

  test("sign-in page renders Clerk form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator(".cl-rootBox, .cl-cardBox").first()).toBeVisible({ timeout: 30_000 });
  });

  test("protected routes redirect guests to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/, { timeout: 30_000 });
  });
});
