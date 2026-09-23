import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { findClubId } from "../src/api.js";
import { E2E, ROLES } from "../src/data.js";

/** Club lifecycle: validation → create → manage → events → delete. */
test.describe("clubs", () => {
  test("validation blocks short description; create succeeds", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/clubs/register");
    await page.getByPlaceholder("e.g. Robotics Club").fill(E2E.clubAlpha);
    await page.getByPlaceholder("What does your club do, and who is it for?").fill("short");
    await page.getByRole("button", { name: "Register club" }).click();
    // Native minLength validation keeps us on the page with no success toast.
    await expect(page).toHaveURL(/clubs\/register/);
    await expect(page.getByText("Club registered")).toHaveCount(0);
    await page.getByPlaceholder("What does your club do, and who is it for?").fill(
      "E2E test club for the automated QA journey, open to all students.",
    );
    await page.getByRole("button", { name: "Register club" }).click();
    await expect(page.getByText("Club registered")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/clubs\/\d+\/admin/, { timeout: 20_000 });
  });

  test("owner manages club: member, event create/edit/delete", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const id = await findClubId(E2E.clubAlpha);
    await page.goto(`/clubs/${id}/admin`);
    // Add member.
    await page.getByPlaceholder("Name").fill("E2E Member");
    await page.getByPlaceholder("Role").fill("Drummer");
    await page.getByRole("button", { name: "Add team member" }).click();
    await expect(page.getByText("E2E Member")).toBeVisible({ timeout: 20_000 });
    // Create event.
    await page.getByPlaceholder("Event title").fill("E2E Jam Night");
    await page.locator('input[type="datetime-local"]').fill("2030-03-01T18:00");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("E2E Jam Night")).toBeVisible({ timeout: 20_000 });
    // Edit event.
    const card = page.locator("div", { hasText: "E2E Jam Night" }).filter({ has: page.getByRole("button", { name: /Edit E2E Jam Night/ }) }).first();
    await card.getByRole("button", { name: /Edit E2E Jam Night/ }).click();
    await page.getByTestId("input-edit-club-event-title").fill("E2E Jam Night v2");
    await page.getByTestId("button-save-club-event").click();
    await expect(page.getByText("Event updated")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E Jam Night v2")).toBeVisible({ timeout: 20_000 });
    // Delete event with confirm.
    const card2 = page.locator("div", { hasText: "E2E Jam Night v2" }).filter({ has: page.getByRole("button", { name: /Delete E2E Jam Night v2/ }) }).first();
    await card2.getByRole("button", { name: /Delete E2E Jam Night v2/ }).click();
    await page.getByTestId("button-delete-confirm").click();
    await expect(page.getByText("Event deleted")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E Jam Night v2")).toHaveCount(0);
  });

  test("owner deletes club with typed confirm; gone from directory", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const beta = "E2E Club Beta";
    await page.goto("/clubs/register");
    await page.getByPlaceholder("e.g. Robotics Club").fill(beta);
    await page.getByPlaceholder("What does your club do, and who is it for?").fill("Temporary E2E deletion target club.");
    await page.getByRole("button", { name: "Register club" }).click();
    await expect(page.getByText("Club registered")).toBeVisible({ timeout: 20_000 });
    const id = await findClubId(beta);
    await page.goto(`/clubs/${id}/admin`);
    await page.getByTestId("button-delete-club").click();
    await page.getByTestId("input-delete-confirm").fill("DELETE");
    await page.getByTestId("button-delete-confirm").click();
    await expect(page).toHaveURL(/clubs$/, { timeout: 20_000 });
    await page.goto("/clubs");
    await expect(page.getByText(beta)).toHaveCount(0);
    await page.goto(`/clubs/${id}`);
    await expect(page.getByText("Club not found.")).toBeVisible({ timeout: 20_000 });
  });

  test("non-owner is blocked from club admin", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    const id = await findClubId(E2E.clubAlpha);
    await page.goto(`/clubs/${id}/admin`);
    await expect(page.getByText("Admin access required")).toBeVisible({ timeout: 20_000 });
  });
});
