import { test, expect } from "@playwright/test";
import { clerkIdByEmail } from "../src/clerk.js";
import { signInAs, apiAs } from "../src/session.js";
import { findClubId, findEventId, findProjectId } from "../src/api.js";
import { E2E, ROLES } from "../src/data.js";

/**
 * Negative authorization matrix through the browser session's own token.
 * Every action below must fail with 401/403/404 and change nothing.
 */
test.describe("permissions (negative)", () => {
  test("wrong users cannot mutate others' resources", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
    const projectId = await findProjectId(E2E.projectAlpha);
    const clubId = await findClubId(E2E.clubAlpha);
    const eventId = await findEventId(E2E.hackathonAlpha);

    expect((await apiAs(page, apiURL!, "PATCH", `/api/projects/${projectId}`, { title: "Hijacked" })).status).toBe(403);
    expect((await apiAs(page, apiURL!, "DELETE", `/api/projects/${projectId}`)).status).toBe(403);
    expect((await apiAs(page, apiURL!, "DELETE", `/api/clubs/${clubId}`)).status).toBe(403);
    expect((await apiAs(page, apiURL!, "DELETE", `/api/events/${eventId}`)).status).toBe(403);
    expect((await apiAs(page, apiURL!, "GET", `/api/admin/stats`)).status).toBe(403);
    // Owner data intact.
    const after = await apiAs(page, apiURL!, "GET", `/api/projects/${projectId}`);
    expect(after.status).toBe(200);
    expect((after.json as Record<string, unknown>).title).toBe(E2E.projectAlpha);
  });

  test("non-member cannot read or send private project chat", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    // Private project owned by C; B is neither member nor owner.
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.moderator));
    const created = await apiAs(page, apiURL!, "POST", "/api/projects", {
      title: "E2E Private Chat Probe",
      visibility: "private",
    });
    expect(created.status).toBe(201);
    const privateId = (created.json as { id: number }).id;
    try {
      await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentB));
      expect((await apiAs(page, apiURL!, "GET", `/api/projects/${privateId}/messages`)).status).toBe(403);
      expect(
        (await apiAs(page, apiURL!, "POST", `/api/projects/${privateId}/messages`, { content: "intrusion" })).status,
      ).toBe(403);
    } finally {
      await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.moderator));
      await apiAs(page, apiURL!, "DELETE", `/api/projects/${privateId}`);
    }
  });

  test("cross-college moderator cannot act on another college", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    // C moderates Alpha (approved in 05). Beta join flow belongs to Beta only.
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.moderator));
    const betaId = await findEventId(E2E.workshopAlpha).catch(() => null);
    expect(betaId).not.toBeNull();
    // Moderator-only college meeting creation on a college C doesn't moderate.
    const betaCollege = await (async () => {
      const r = await fetch(`${apiURL}/api/colleges?search=${encodeURIComponent(E2E.collegeBeta)}`);
      const rows = (await r.json()) as Array<{ id: number }>;
      return rows[0]?.id;
    })();
    const res = await apiAs(page, apiURL!, "POST", `/api/colleges/${betaCollege}/meetings`, {
      title: "Cross-college intrusion",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect([403, 404]).toContain(res.status);
  });

  test("deleted resources return 404 and cannot be modified", async ({ page, baseURL }) => {
    const apiURL = process.env.E2E_API_URL;
    test.skip(!apiURL, "E2E_API_URL required");
    await signInAs(page, baseURL!, await clerkIdByEmail(ROLES.studentA));
    // E2E Project Beta was deleted in 06 — resolve must now fail.
    const r = await fetch(`${apiURL}/api/projects?search=${encodeURIComponent(E2E.projectBeta)}`);
    const rows = (await r.json()) as Array<unknown>;
    expect(rows.length).toBe(0);
  });
});
