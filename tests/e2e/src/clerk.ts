/** Clerk Backend API helpers — test SETUP ceremony only (never business actions). */

function secret(): string {
  const v = process.env.CLERK_SECRET_KEY;
  if (!v) throw new Error("CLERK_SECRET_KEY is required for E2E auth setup.");
  return v;
}

async function clerk(path: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`Clerk API ${init.method ?? "GET"} ${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** Resolve a Clerk user id by email (demo accounts). */
export async function clerkIdByEmail(email: string): Promise<string> {
  const list = (await clerk(`/users?email_address=${encodeURIComponent(email)}&limit=1`)) as Array<{ id: string }>;
  if (!list[0]?.id) throw new Error(`No Clerk user for ${email}`);
  return list[0].id;
}

/** Mint a short-lived sign-in ticket for a user id. */
export async function signInTicket(clerkUserId: string): Promise<string> {
  const t = (await clerk("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 300 }),
  })) as { token: string };
  if (!t.token) throw new Error("Clerk did not return a sign-in token");
  return t.token;
}

/** Create a fresh throwaway Clerk user (for signup/onboarding-adjacent flows). */
export async function createTestUser(email: string, password: string): Promise<string> {
  const [first, ...rest] = email.split("@")[0].replace(/[^a-z]/gi, " ").split(" ").filter(Boolean);
  const u = (await clerk("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: first || "E2E",
      last_name: rest.join(" ") || "Tester",
      public_metadata: { e2e: true },
    }),
  })) as { id: string };
  return u.id;
}

/** Delete a Clerk user (cleanup only). */
export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  await clerk(`/users/${clerkUserId}`, { method: "DELETE" });
}
