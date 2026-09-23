import type { Page } from "@playwright/test";
import { signInTicket } from "./clerk.js";

/**
 * Sign a page in as a Clerk user WITHOUT touching the login form.
 * Setup ceremony only: every business action under test still goes
 * through the real UI afterwards. Returns after /dashboard renders.
 */
export async function signInAs(page: Page, baseURL: string, clerkUserId: string): Promise<void> {
  const ticket = await signInTicket(clerkUserId);
  await page.goto(`${baseURL}/sign-in`);
  await page.waitForFunction(() => (window as unknown as { Clerk?: { load: () => Promise<void> } }).Clerk !== undefined, null, {
    timeout: 30_000,
  });
  await page.evaluate(async (t: string) => {
    const w = window as unknown as {
      Clerk: {
        load: () => Promise<void>;
        client: { signIn: { create: (o: unknown) => Promise<{ createdSessionId: string }> } };
        setActive: (o: unknown) => Promise<void>;
      };
    };
    await w.Clerk.load();
    const res = await w.Clerk.client.signIn.create({ strategy: "ticket", ticket: t });
    await w.Clerk.setActive({ session: res.createdSessionId });
  }, ticket);
  await page.goto(`${baseURL}/dashboard`);
  await page.getByTestId("text-dashboard-greeting").waitFor({ timeout: 30_000 });
}

/** Sign out through the real account menu (this IS a tested UI action). */
export async function signOutViaUI(page: Page): Promise<void> {
  await page.getByTestId("button-account-menu").click();
  await page.getByTestId("account-sign-out").click();
  await page.waitForURL(/\/?$/, { timeout: 30_000 });
}

/**
 * Current Clerk session JWT for API-level negative tests (called from an
 * already-signed-in page). The session belongs to the browser user; all
 * business setup still happens through the UI.
 */
export async function sessionToken(page: Page): Promise<string> {
  return await page.evaluate(async () => {
    const w = window as unknown as {
      Clerk: { load: () => Promise<void>; session: { getToken: () => Promise<string> } | null };
    };
    await w.Clerk.load();
    if (!w.Clerk.session) throw new Error("no active Clerk session");
    return await w.Clerk.session.getToken();
  });
}

/** Authenticated API call with the browser session's token (negative tests). */
export async function apiAs(
  page: Page,
  apiURL: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const token = await sessionToken(page);
  const r = await page.evaluate(
    async ({ apiURL, method, path, body, token }: { apiURL: string; method: string; path: string; body: unknown; token: string }) => {
      const res = await fetch(`${apiURL}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json };
    },
    { apiURL, method, path, body: body ?? null, token },
  );
  return r;
}
