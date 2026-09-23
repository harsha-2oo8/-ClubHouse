/**
 * Guarded E2E cleanup — deletes ONLY E2E_*-prefixed rows and their children.
 *
 * Usage:  E2E_CLEANUP_CONFIRM=yes pnpm --filter @workspace/e2e exec tsx src/cleanup.ts
 *
 * Guards (all required):
 *   E2E_CLEANUP_CONFIRM=yes
 *   Refuses NODE_ENV=production unless E2E_ALLOW_PROD=yes
 * Every statement is scoped by an E2E_ prefix or an id resolved from one.
 */
import pg from "pg";

async function main() {
  if (process.env.E2E_CLEANUP_CONFIRM !== "yes") {
    console.error("Refusing: set E2E_CLEANUP_CONFIRM=yes.");
    process.exit(2);
  }
  if (process.env.NODE_ENV === "production" && process.env.E2E_ALLOW_PROD !== "yes") {
    console.error("Refusing: production database without E2E_ALLOW_PROD=yes.");
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(2);
  }
  const pool = new pg.Pool({ connectionString: url });
  const total: Record<string, number> = {};
  const del = async (label: string, text: string, params: unknown[] = []) => {
    const r = await pool.query(text, params as unknown[]);
    total[label] = (total[label] ?? 0) + (r.rowCount ?? 0);
  };

  const proj = await pool.query<{ id: number }>(`SELECT id FROM projects WHERE title LIKE 'E2E%'`);
  const projIds = proj.rows.map((r) => r.id);
  const club = await pool.query<{ id: number }>(`SELECT id FROM clubs WHERE name LIKE 'E2E%'`);
  const clubIds = club.rows.map((r) => r.id);
  const evt = await pool.query<{ id: number }>(`SELECT id FROM club_events WHERE title LIKE 'E2E%'`);
  const evtIds = evt.rows.map((r) => r.id);
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
  await del(
    "colleges",
    `DELETE FROM colleges WHERE name LIKE 'E2E%' AND NOT EXISTS (
       SELECT 1 FROM college_members m WHERE m.college_id = colleges.id
       AND m.clerk_id NOT IN (SELECT clerk_id FROM users WHERE email LIKE '%@demo.clubhouse.app'))`,
  );
  await del("reports", `DELETE FROM reports WHERE reporter_id IN (SELECT clerk_id FROM users WHERE email LIKE '%@demo.clubhouse.app') AND (target_id LIKE 'E2E%' OR target_id IN (${[...projIds, ...clubIds, ...evtIds].map(String).join(",") || "NULL"}))`);
  await pool.end();
  console.log("e2e cleanup complete", JSON.stringify(total));
}

main().catch((e) => {
  console.error("cleanup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
