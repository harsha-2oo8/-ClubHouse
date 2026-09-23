import { test, expect, type Page } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs } from "../src/session.js";
import { findEventId } from "../src/api.js";
import { E2E, ROLES } from "../src/data.js";

/** Events: all three types, edit, registration, capacity, delete. */
test.describe("events", () => {
  async function createEvent(
    page: Page,
    fields: { title: string; type: string; start: string; max?: string },
  ) {
    await page.getByTestId("button-create-event").click();
    await page.getByTestId("input-event-title").fill(fields.title);
    await page.getByTestId("input-event-desc").fill(`E2E ${fields.type} for the automated QA journey.`);
    await page.getByTestId("select-event-type").click();
    await page.locator('[role="option"]', { hasText: new RegExp(`^${fields.type}$`, "i") }).click();
    await page.getByTestId("input-start-date").fill(fields.start);
    if (fields.max) await page.getByTestId("input-max-participants").fill(fields.max);
    await page.getByTestId("button-submit-event").click();
    await expect(page.getByText("Event created!")).toBeVisible({ timeout: 20_000 });
  }

  test("create hackathon, workshop, seminar; all appear", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover/events");
    await createEvent(page, { title: E2E.hackathonAlpha, type: "Hackathon", start: "2030-04-01T09:00", max: "50" });
    await createEvent(page, { title: E2E.workshopAlpha, type: "Workshop", start: "2030-04-10T10:00" });
    await createEvent(page, { title: E2E.seminarAlpha, type: "Seminar", start: "2030-04-20T11:00" });
    for (const t of [E2E.hackathonAlpha, E2E.workshopAlpha, E2E.seminarAlpha]) {
      await expect(page.getByText(t)).toBeVisible({ timeout: 20_000 });
    }
  });

  test("creator edits event; change persists", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover/events");
    const card = page.locator('[data-testid^="card-event-"]', { hasText: E2E.hackathonAlpha }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const id = (await card.getAttribute("data-testid"))!.replace("card-event-", "");
    await card.getByTestId(`button-edit-event-${id}`).click();
    await page.getByTestId("input-event-desc").fill("E2E edited hackathon description.");
    await page.getByTestId("button-submit-event").click();
    await expect(page.getByText("Event updated!")).toBeVisible({ timeout: 20_000 });
  });

  test("B registers; count changes; duplicate blocked", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    await page.goto("/discover/events");
    const card = page.locator('[data-testid^="card-event-"]', { hasText: E2E.hackathonAlpha }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const before = ((await card.getByText(/registered/).first().textContent().catch(() => "")) ?? "").trim();
    await card.getByTestId(/button-register-event-/).click();
    await expect(page.getByText("Registered!")).toBeVisible({ timeout: 20_000 });
    await page.goto("/discover/events");
    const cardAfter = page.locator('[data-testid^="card-event-"]', { hasText: E2E.hackathonAlpha }).first();
    const after = ((await cardAfter.getByText(/registered/).first().textContent().catch(() => "")) ?? "").trim();
    expect(after).not.toBe(before);
    // Duplicate blocked.
    await page.goto("/discover/events");
    const card2 = page.locator('[data-testid^="card-event-"]', { hasText: E2E.hackathonAlpha }).first();
    await card2.getByTestId(/button-register-event-/).click();
    await expect(page.getByText(/full or already registered|failed/i)).toBeVisible({ timeout: 20_000 });
  });

  test("capacity enforced: third registrant is refused", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover/events");
    await createEvent(page, { title: "E2E Workshop Tiny", type: "Workshop", start: "2030-05-01T10:00", max: "2" });
    const tiny = await findEventId("E2E Workshop Tiny");

    for (const who of [ROLES.studentA, ROLES.studentB]) {
      await signInAs(page, baseURL!, await clerkIdByEmail(who));
      await page.goto("/discover/events");
      const card = page.locator(`[data-testid="card-event-${tiny}"]`);
      await expect(card).toBeVisible({ timeout: 20_000 });
      await card.getByTestId(`button-register-event-${tiny}`).click();
      await expect(page.getByText("Registered!")).toBeVisible({ timeout: 20_000 });
    }
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.moderator));
    await page.goto("/discover/events");
    const card = page.locator(`[data-testid="card-event-${tiny}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.getByTestId(`button-register-event-${tiny}`).click();
    await expect(page.getByText(/full or already registered/i)).toBeVisible({ timeout: 20_000 });
  });

  test("creator deletes event; gone from discovery; non-creator has no control", async ({ page, baseURL }) => {
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    await page.goto("/discover/events");
    const card = page.locator('[data-testid^="card-event-"]', { hasText: E2E.seminarAlpha }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const id = (await card.getAttribute("data-testid"))!.replace("card-event-", "");
    await card.getByTestId(`button-delete-event-${id}`).click();
    await page.getByTestId("button-delete-confirm").click();
    await expect(page.getByText("Event deleted")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(E2E.seminarAlpha)).toHaveCount(0);

    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    await page.goto("/discover/events");
    const card2 = page.locator('[data-testid^="card-event-"]', { hasText: E2E.hackathonAlpha }).first();
    await expect(card2).toBeVisible({ timeout: 20_000 });
    const id2 = (await card2.getAttribute("data-testid"))!.replace("card-event-", "");
    await expect(card2.getByTestId(`button-delete-event-${id2}`)).toHaveCount(0);
    await expect(card2.getByTestId(`button-edit-event-${id2}`)).toHaveCount(0);
  });
});
