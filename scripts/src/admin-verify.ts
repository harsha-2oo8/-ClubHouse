/**
 * Production admin verification (read-only — changes nothing).
 *
 * Usage:
 *   pnpm admin:verify
 *
 * Env (never commit values):
 *   DATABASE_URL        REQUIRED — Supabase Session pooler URI
 *   CLERK_SECRET_KEY    REQUIRED — sk_live_… (server-side Clerk REST auth)
 *   ADMIN_CLERK_ID      Admin's Clerk user id (or ADMIN_EMAIL)
 *   ADMIN_EMAIL         Admin's login email (alternative lookup)
 *   API_BASE_URL        OPTIONAL — default http://localhost:8080
 *   ADMIN_SESSION_TOKEN OPTIONAL — live session JWT; when set, proves the
 *                                  admin endpoint returns 200 for the admin
 *   NORMAL_SESSION_TOKEN OPTIONAL — live session JWT of a regular student;
 *                                  when set, proves admin endpoint returns 403
 *
 * Reports: Clerk user exists / DB user exists / DB role is admin /
 * admin endpoint auth behavior / health+readiness. Exits non-zero on failure.
 * Secrets are never printed.
 */
import pg from "pg";

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const pass = (name: string, detail = "ok") => checks.push({ name, ok: true, detail });
const fail = (name: string, detail: string) => checks.push({ name, ok: false, detail });

function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env ${name}. See docs/ADMIN_SETUP.md.`);
    process.exit(2);
  }
  return v.trim();
}

async function main() {
  const databaseUrl = req("DATABASE_URL");
  const clerkSecret = req("CLERK_SECRET_KEY");
  const adminClerkId = (process.env.ADMIN_CLERK_ID ?? "").trim();
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const apiBase = (process.env.API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
  const adminToken = (process.env.ADMIN_SESSION_TOKEN ?? "").trim();
  const normalToken = (process.env.NORMAL_SESSION_TOKEN ?? "").trim();
  if (!adminClerkId && !adminEmail) {
    console.error("Set ADMIN_CLERK_ID or ADMIN_EMAIL.");
    process.exit(2);
  }

  // 1. Clerk user exists (resolve id via email when needed)
  let clerkId = adminClerkId;
  try {
    if (!clerkId) {
      const r = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(adminEmail)}&limit=1`,
        { headers: { Authorization: `Bearer ${clerkSecret}` } },
      );
      if (!r.ok) throw new Error(`Clerk lookup HTTP ${r.status}`);
      const list = (await r.json()) as Array<{ id: string }>;
      clerkId = list[0]?.id ?? "";
    } else {
      const r = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
        headers: { Authorization: `Bearer ${clerkSecret}` },
      });
      if (r.status === 404) clerkId = "";
      else if (!r.ok) throw new Error(`Clerk lookup HTTP ${r.status}`);
    }
    if (clerkId) pass("Clerk user exists", `id ${clerkId.slice(0, 8)}…`);
    else fail("Clerk user exists", "no Clerk user matches ADMIN_CLERK_ID/ADMIN_EMAIL");
  } catch (e) {
    fail("Clerk user exists", e instanceof Error ? e.message : String(e));
  }

  // 2+3. DB user exists with role=admin
  try {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const r = await pool.query("SELECT clerk_id, email, role FROM users WHERE clerk_id = $1 OR lower(email) = $2 LIMIT 1", [
      clerkId || "__none__",
      adminEmail || "__none__",
    ]);
    await pool.end();
    const row = r.rows[0] as { email: string; role: string } | undefined;
    if (!row) fail("DB user exists", "no users row matches");
    else {
      pass("DB user exists", `email domain ${row.email.split("@")[1] ?? "?"}`);
      if (row.role === "admin") pass("DB role is admin", "role=admin");
      else fail("DB role is admin", `role is "${row.role}" — re-run bootstrap with ADMIN_EMAILS set, then remove it`);
    }
  } catch (e) {
    fail("DB user/role check", e instanceof Error ? e.message : String(e));
  }

  // 4. Health + readiness
  for (const path of ["/api/healthz", "/api/readyz"]) {
    try {
      const r = await fetch(`${apiBase}${path}`);
      if (r.ok) pass(`GET ${path}`, `HTTP ${r.status}`);
      else fail(`GET ${path}`, `HTTP ${r.status}`);
    } catch (e) {
      fail(`GET ${path}`, e instanceof Error ? e.message : String(e));
    }
  }

  // 5. Admin endpoint is auth-gated (no token → 401 proves middleware is mounted)
  try {
    const r = await fetch(`${apiBase}/api/admin/stats`);
    if (r.status === 401) pass("Admin endpoint requires auth", "HTTP 401 without token");
    else fail("Admin endpoint requires auth", `expected 401, got HTTP ${r.status}`);
  } catch (e) {
    fail("Admin endpoint requires auth", e instanceof Error ? e.message : String(e));
  }

  // 6. Live token checks (only when tokens supplied — never logged)
  if (adminToken) {
    try {
      const r = await fetch(`${apiBase}/api/admin/stats`, {
        // Token value is never printed; only the HTTP outcome is reported.
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (r.ok) pass("Admin token reaches admin endpoint", `HTTP ${r.status}`);
      else fail("Admin token reaches admin endpoint", `HTTP ${r.status} — check role + key instance (live vs test)`);
    } catch (e) {
      fail("Admin token reaches admin endpoint", e instanceof Error ? e.message : String(e));
    }
  } else {
    checks.push({ name: "Admin token reaches admin endpoint", ok: true, detail: "skipped (set ADMIN_SESSION_TOKEN for live check)" });
  }
  if (normalToken) {
    try {
      const r = await fetch(`${apiBase}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${normalToken}` },
      });
      if (r.status === 403) pass("Normal user denied on admin endpoint", "HTTP 403");
      else fail("Normal user denied on admin endpoint", `expected 403, got HTTP ${r.status}`);
    } catch (e) {
      fail("Normal user denied on admin endpoint", e instanceof Error ? e.message : String(e));
    }
  } else {
    checks.push({ name: "Normal user denied on admin endpoint", ok: true, detail: "skipped (set NORMAL_SESSION_TOKEN for live check)" });
  }

  console.log("\n--- admin:verify ---");
  let failed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
    if (!c.ok) failed += 1;
  }
  if (failed > 0) {
    console.log(`\n${failed} check(s) failed. See docs/ADMIN_SETUP.md.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error("admin:verify crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
