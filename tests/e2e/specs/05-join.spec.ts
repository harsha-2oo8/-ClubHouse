import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { findCollegeId } from "../src/api.js";
import { E2E, ROLES } from "../src/data.js";

/**
 * Join flow: B requests → duplicate blocked → A (auto-moderator via admin
 * approval) approves in the Requests tab → B is a member + notified.
 * Then C joins, A approves, C applies as moderator, admin approves C.
 */
test.describe("college join + moderation", () => {
  test("B requests to join; duplicate is blocked; persists", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    const collegeId = await findCollegeId(E2E.collegeAlpha);
    await page.goto(`/colleges/${collegeId}`);
    await page.getByTestId("button-join-college").click();
    await expect(page.getByText("Join request sent!")).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await page.getByTestId("button-join-college").click();
    await expect(page.getByText("Error or already requested")).toBeVisible({ timeout: 20_000 });
  });

  test("A approves B in Requests tab; B becomes member + notified", async ({ page, baseURL }) => {
    const bId = await clerkIdByEmail(ROLES.studentB);
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const collegeId = await findCollegeId(E2E.collegeAlpha);
    await page.goto(`/colleges/${collegeId}`);
    await page.getByTestId("tab-college-requests").click();
    const card = page.locator('[data-testid^="card-join-request-"]', { hasText: "Diya Patel" });
    await expect(card).toBeVisible({ timeout: 20_000 });
    const reqId = (await card.getAttribute("data-testid"))!.replace("card-join-request-", "");
    await card.getByTestId(`button-approve-join-${reqId}`).click();
    await expect(page.getByText("Member approved!")).toBeVisible({ timeout: 20_000 });
    // Member list shows B.
    await page.getByRole("tab", { name: /members/i }).click();
    await expect(page.getByTestId(`card-member-${bId}`)).toBeVisible({ timeout: 20_000 });

    // Other side: B sees membership + notification.
    await signInAs(page, baseURL!, bId);
    await page.goto(`/colleges/${collegeId}`);
    await page.getByRole("tab", { name: /members/i }).click();
    await expect(page.getByTestId(`card-member-${bId}`)).toBeVisible({ timeout: 20_000 });
    await page.goto("/notifications");
    await expect(page.getByText(/join.*approved/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("C joins, is approved, applies as moderator, admin approves", async ({ page, baseURL }) => {
    const cId = await clerkIdByEmail(ROLES.moderator);
    const collegeId = await findCollegeId(E2E.collegeAlpha);
    await signInAs(page, baseURL!, cId);
    await page.goto(`/colleges/${collegeId}`);
    await page.getByTestId("button-join-college").click();
    await expect(page.getByText("Join request sent!")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto(`/colleges/${collegeId}`);
    await page.getByTestId("tab-college-requests").click();
    const card = page.locator('[data-testid^="card-join-request-"]', { hasText: "Karthik Menon" });
    await expect(card).toBeVisible({ timeout: 20_000 });
    const reqId = (await card.getAttribute("data-testid"))!.replace("card-join-request-", "");
    await card.getByTestId(`button-approve-join-${reqId}`).click();
    await expect(page.getByText("Member approved!")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, cId);
    await page.goto(`/colleges/${collegeId}`);
    await page.getByTestId("button-apply-moderator").click();
    await expect(page.getByText("Moderator application submitted!")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.adminEmail));
    await page.goto("/admin");
    await page.getByTestId("tab-moderators").click();
    const app = page.locator('[data-testid^="card-mod-app-"]', { hasText: "Karthik Menon" });
    await expect(app).toBeVisible({ timeout: 20_000 });
    const appId = (await app.getAttribute("data-testid"))!.replace("card-mod-app-", "");
    await app.getByTestId(`button-approve-mod-${appId}`).click();
    await expect(page.getByText("Application approved")).toBeVisible({ timeout: 20_000 });

    // C now sees moderator tooling (Requests tab).
    await signInAs(page, baseURL!, cId);
    await page.goto(`/colleges/${collegeId}`);
    await expect(page.getByTestId("tab-college-requests")).toBeVisible({ timeout: 20_000 });
  });

  test("moderator schedules a meeting; members see it", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    const collegeId = await findCollegeId(E2E.collegeAlpha);
    await page.goto(`/colleges/${collegeId}`);
    await page.getByTestId("button-schedule-meeting").click();
    await page.getByTestId("input-meeting-title").fill("E2E Kickoff Call");
    await page.getByTestId("input-meeting-date").fill("2030-06-01T10:00");
    await page.getByTestId("button-submit-meeting").click();
    await expect(page.getByText("Meeting scheduled!")).toBeVisible({ timeout: 20_000 });

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    await page.goto(`/colleges/${collegeId}`);
    await page.getByRole("tab", { name: /meetings/i }).click();
    await expect(page.getByText("E2E Kickoff Call")).toBeVisible({ timeout: 20_000 });
  });
});
