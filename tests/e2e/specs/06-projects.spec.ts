import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { findProjectId } from "../src/api.js";
import { E2E, ROLES } from "../src/data.js";

/** Full project lifecycle through the UI, both sides verified. */
test.describe("projects", () => {
  test("A creates an open project; it appears in Discover + persists", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover");
    await page.getByTestId("button-create-project").click();
    await page.getByTestId("input-project-title").fill(E2E.projectAlpha);
    await page.getByTestId("input-project-desc").fill("E2E test project for the automated QA journey.");
    await page.getByTestId("input-tech-stack").fill("React, Node.js");
    await page.getByTestId("switch-open-applications").click();
    await page.getByTestId("button-submit-project").click();
    await expect(page.getByText("Project created!")).toBeVisible({ timeout: 20_000 });
    await page.goto("/discover");
    await expect(page.getByText(E2E.projectAlpha)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText(E2E.projectAlpha)).toBeVisible({ timeout: 20_000 });
  });

  test("owner edits project; non-owner has no edit control", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const id = await findProjectId(E2E.projectAlpha);
    await page.goto(`/projects/${id}`);
    await page.getByTestId("button-edit-project").click();
    await page.getByTestId("input-edit-desc").fill("E2E test project — edited description.");
    await page.getByTestId("button-save-project").click();
    await expect(page.getByText("Project updated!")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E test project — edited description.")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    await page.goto(`/projects/${id}`);
    await expect(page.getByTestId("button-edit-project")).toHaveCount(0);
    await expect(page.getByTestId("button-delete-project")).toHaveCount(0);
  });

  test("B applies; duplicate blocked; owner sees application + notification", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    const id = await findProjectId(E2E.projectAlpha);
    await page.goto(`/projects/${id}`);
    await page.getByTestId("button-apply-project").click();
    // Note: role field renders only when the project declares required roles.
    await page.getByTestId("input-apply-message").fill("E2E applicant with React experience.");
    await page.getByTestId("button-submit-application").click();
    await expect(page.getByText("Application sent!")).toBeVisible({ timeout: 20_000 });
    // Duplicate blocked.
    await page.getByTestId("button-apply-project").click();
    await page.getByTestId("input-apply-message").fill("Trying twice with enough words.");
    await page.getByTestId("button-submit-application").click();
    await expect(page.getByText("Already applied or error")).toBeVisible({ timeout: 20_000 });

    // Owner side sees it + gets notified.
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto(`/projects/${id}`);
    await page.getByTestId("tab-applications").click();
    await expect(page.getByText("Diya Patel")).toBeVisible({ timeout: 20_000 });
    await page.goto("/notifications");
    await expect(page.getByText(/applied to join your project/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("owner approves B; membership + count + notification update", async ({ page, baseURL }) => {
    const bId = await clerkIdByEmail(ROLES.studentB);
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const id = await findProjectId(E2E.projectAlpha);
    await page.goto(`/projects/${id}`);
    await page.getByTestId("tab-applications").click();
    const card = page.locator('[data-testid^="card-application-"]', { hasText: "Diya Patel" });
    await expect(card).toBeVisible({ timeout: 20_000 });
    const appId = (await card.getAttribute("data-testid"))!.replace("card-application-", "");
    await card.getByTestId(`button-approve-application-${appId}`).click();
    await expect(page.getByText("Member approved!")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(`card-member-${bId}`)).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, bId);
    await page.goto(`/projects/${id}`);
    await expect(page.getByTestId(`card-member-${bId}`)).toBeVisible({ timeout: 20_000 });
    await page.goto("/notifications");
    await expect(page.getByText(/application.*approved/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("owner invites C; C becomes member + notified", async ({ page, baseURL }) => {
    const cId = await clerkIdByEmail(ROLES.moderator);
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const id = await findProjectId(E2E.projectAlpha);
    await page.goto(`/projects/${id}`);
    await page.getByTestId("button-invite-project").click();
    await page.getByTestId("input-search-project-invite").fill("Arjun");
    const dialog = page.getByRole("dialog");
    const row = dialog.locator("div", { hasText: "Arjun Reddy" }).filter({ has: page.getByRole("button", { name: "Invite" }) }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByText("Teammate invited")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, cId);
    await page.goto(`/projects/${id}`);
    await expect(page.getByTestId(`card-member-${cId}`)).toBeVisible({ timeout: 20_000 });
    await page.goto("/notifications");
    await expect(page.getByText(/invited/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("chat works both ways, ordered, persistent", async ({ page, baseURL }) => {
    const bId = await clerkIdByEmail(ROLES.studentB);
    const id = await findProjectId(E2E.projectAlpha);
    await signInAs(page, baseURL!, bId);
    await page.goto(`/projects/${id}`);
    await page.getByRole("tab", { name: /chat/i }).click();
    await page.getByTestId("input-message").fill("E2E hello from B");
    await page.getByTestId("button-send-message").click();
    await expect(page.getByText("E2E hello from B")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto(`/projects/${id}`);
    await page.getByRole("tab", { name: /chat/i }).click();
    await expect(page.getByText("E2E hello from B")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("input-message").fill("E2E reply from A");
    await page.getByTestId("button-send-message").click();
    const texts = await page.getByTestId(/message-\d+/).allTextContents();
    const joined = texts.join("\n");
    expect(joined.indexOf("E2E hello from B")).toBeLessThan(joined.indexOf("E2E reply from A"));
    await page.reload();
    await page.getByRole("tab", { name: /chat/i }).click();
    await expect(page.getByText("E2E reply from A")).toBeVisible({ timeout: 20_000 });
  });

  test("owner schedules + deletes a meeting", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const id = await findProjectId(E2E.projectAlpha);
    await page.goto(`/projects/${id}`);
    await page.getByRole("tab", { name: /meetings/i }).click();
    await page.getByTestId("button-schedule-project-meeting").click();
    await page.getByTestId("input-event-title").fill("E2E Sync Call");
    await page.getByTestId("input-event-date").fill("2030-02-01T10:00");
    await page.getByTestId("button-submit-event").click();
    await expect(page.getByText("Meeting scheduled!")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E Sync Call")).toBeVisible({ timeout: 20_000 });
    const card = page.locator('[data-testid^="card-event-"]', { hasText: "E2E Sync Call" });
    const eventId = (await card.getAttribute("data-testid"))!.replace("card-event-", "");
    await card.getByTestId(`button-delete-meeting-${eventId}`).click();
    await page.getByTestId("button-delete-confirm").click();
    await expect(page.getByText("Meeting deleted")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E Sync Call")).toHaveCount(0);
  });

  test("owner deletes project with typed confirm; gone everywhere", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover");
    await page.getByTestId("button-create-project").click();
    await page.getByTestId("input-project-title").fill(E2E.projectBeta);
    await page.getByTestId("input-project-desc").fill("Temporary E2E deletion target.");
    await page.getByTestId("button-submit-project").click();
    await expect(page.getByText("Project created!")).toBeVisible({ timeout: 20_000 });
    const id = await findProjectId(E2E.projectBeta);
    await page.goto(`/projects/${id}`);
    await page.getByTestId("button-delete-project").click();
    await page.getByTestId("input-delete-confirm").fill("DELETE");
    await page.getByTestId("button-delete-confirm").click();
    await expect(page).toHaveURL(/discover/, { timeout: 20_000 });
    await page.goto("/discover");
    await expect(page.getByText(E2E.projectBeta)).toHaveCount(0);
    await page.goto(`/projects/${id}`);
    await expect(page.getByText("Project not found.")).toBeVisible({ timeout: 20_000 });
  });
});
