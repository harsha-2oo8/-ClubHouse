/**
 * Demo reset — deletes ONLY demo-seeded rows. Never touches real user data.
 *
 * Usage:  pnpm seed:demo:reset
 *
 * Guards (all required):
 *   DEMO_RESET_CONFIRM=yes            explicit confirmation
 *   NODE_ENV != production            unless DEMO_ALLOW_PROD_RESET=yes
 *
 * Demo identity (must match scripts/src/seed/data.ts + run.ts):
 * - users: clerk_id LIKE 'demo\_%' OR email LIKE '%@demo.clubhouse.app'
 * - colleges: exact seeded name list
 * - projects/clubs/events: title LIKE '[Demo]%' OR owner/creator in demo set
 */
import pg from "pg";
import { DEMO_COLLEGES } from "./data";

function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env ${name}.`);
    process.exit(2);
  }
  return v.trim();
}

async function main() {
  if (process.env.DEMO_RESET_CONFIRM !== "yes") {
    console.error("Refusing: set DEMO_RESET_CONFIRM=yes to confirm deletion of demo rows.");
    process.exit(2);
  }
  if (process.env.NODE_ENV === "production" && process.env.DEMO_ALLOW_PROD_RESET !== "yes") {
    console.error("Refusing: production database. Set DEMO_ALLOW_PROD_RESET=yes to override (not recommended).");
    process.exit(2);
  }

  const databaseUrl = req("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const total: Record<string, number> = {};
  const del = async (label: string, text: string, params: unknown[] = []) => {
    const r = await pool.query(text, params as unknown[]);
    total[label] = (total[label] ?? 0) + (r.rowCount ?? 0);
  };

  const DEMO_USER = `(clerk_id LIKE 'demo\\_%' ESCAPE '\\' OR email LIKE '%@demo.clubhouse.app')`;
  const collegeNames = DEMO_COLLEGES.map((c) => c.name);

  // Resolve demo-owned ids first.
  const projRows = await pool.query<{ id: number }>(
    `SELECT p.id FROM projects p LEFT JOIN users u ON u.clerk_id = p.owner_id
     WHERE p.title LIKE '[Demo]%' OR u.email LIKE '%@demo.clubhouse.app'`,
  );
  const projIds = projRows.rows.map((r) => r.id);
  const clubRows = await pool.query<{ id: number }>(
    `SELECT c.id FROM clubs c LEFT JOIN users u ON u.clerk_id = c.created_by
     WHERE c.name LIKE '[Demo]%' OR u.email LIKE '%@demo.clubhouse.app'`,
  );
  const clubIds = clubRows.rows.map((r) => r.id);
  const evtRows = await pool.query<{ id: number }>(
    `SELECT e.id FROM club_events e LEFT JOIN users u ON u.clerk_id = e.created_by
     WHERE e.title LIKE '[Demo]%' OR u.email LIKE '%@demo.clubhouse.app'`,
  );
  const evtIds = evtRows.rows.map((r) => r.id);

  const inList = (ids: number[]) => (ids.length ? `IN (${ids.join(",")})` : `IN (NULL)`);

  if (evtIds.length) {
    await del("event_registrations", `DELETE FROM event_registrations WHERE event_id ${inList(evtIds)}`);
    await del("events", `DELETE FROM club_events WHERE id ${inList(evtIds)}`);
  }
  if (projIds.length) {
    await del("project_messages", `DELETE FROM project_messages WHERE project_id ${inList(projIds)}`);
    await del("project_applications", `DELETE FROM project_applications WHERE project_id ${inList(projIds)}`);
    await del("project_members", `DELETE FROM project_members WHERE project_id ${inList(projIds)}`);
    await del("project_events", `DELETE FROM project_events WHERE project_id ${inList(projIds)}`);
    await del("projects", `DELETE FROM projects WHERE id ${inList(projIds)}`);
  }
  if (clubIds.length) {
    await del("club_management_events", `DELETE FROM club_management_events WHERE club_id ${inList(clubIds)}`);
    await del("club_members", `DELETE FROM club_members WHERE club_id ${inList(clubIds)}`);
    await del("clubs", `DELETE FROM clubs WHERE id ${inList(clubIds)}`);
  }
  await del("moderator_applications", `DELETE FROM moderator_applications WHERE clerk_id IN (SELECT clerk_id FROM users WHERE ${DEMO_USER})`);
  await del("college_join_requests", `DELETE FROM college_join_requests WHERE clerk_id IN (SELECT clerk_id FROM users WHERE ${DEMO_USER})`);
  await del("college_meetings", `DELETE FROM college_meetings WHERE created_by IN (SELECT clerk_id FROM users WHERE ${DEMO_USER})`);
  await del("college_members", `DELETE FROM college_members WHERE clerk_id IN (SELECT clerk_id FROM users WHERE ${DEMO_USER})`);
  await del("notifications", `DELETE FROM notifications WHERE clerk_id IN (SELECT clerk_id FROM users WHERE ${DEMO_USER})`);
  await del("reports", `DELETE FROM reports WHERE reporter_id IN (SELECT clerk_id FROM users WHERE ${DEMO_USER})`);
  await del("users", `DELETE FROM users WHERE ${DEMO_USER}`);

  // Colleges: only when no NON-demo members remain (never strand real users).
  for (const name of collegeNames) {
    const strangers = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM college_members m JOIN colleges c ON c.id = m.college_id
       LEFT JOIN users u ON u.clerk_id = m.clerk_id
       WHERE c.name = $1 AND (u.clerk_id IS NULL OR NOT (${DEMO_USER.replace(/clerk_id/g, "u.clerk_id").replace(/email/g, "u.email")}))`,
      [name],
    );
    if (strangers.rows[0]?.n === "0") {
      await del("colleges", `DELETE FROM colleges WHERE name = $1`, [name]);
    } else {
      console.log(`keep college "${name}" (${strangers.rows[0]?.n} non-demo member(s))`);
    }
  }

  await pool.end();
  console.log("seed:demo:reset complete", JSON.stringify(total));
}

main().catch((e) => {
  console.error("seed:demo:reset failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
