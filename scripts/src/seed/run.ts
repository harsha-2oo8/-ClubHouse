/**
 * Demo seed runner — idempotent, production-safe.
 *
 * Usage:
 *   pnpm seed:demo [--with-clerk]
 *
 * Env:
 *   DATABASE_URL        REQUIRED — target database (pooler URI in prod)
 *   CLERK_SECRET_KEY    REQUIRED only with --with-clerk
 *   DEMO_USER_PASSWORD  REQUIRED only with --with-clerk (never commit it)
 *
 * Safety:
 * - Re-runs never duplicate: every insert is keyed by a natural unique key
 *   (unique constraints + ON CONFLICT) or an existence check.
 * - Never touches non-demo rows. Demo colleges keep status=approved so the
 *   content is usable immediately; pre-existing same-name rows are left alone.
 * - Demo projects/clubs/events carry a "[Demo]" title prefix.
 */
import pg from "pg";
import {
  DEMO_CLUBS,
  DEMO_CLUB_EVENTS,
  DEMO_COLLEGES,
  DEMO_EVENTS,
  DEMO_PROJECTS,
  buildStudents,
  portfolioFor,
  socialsFor,
  type DemoStudent,
} from "./data";

const WITH_CLERK = process.argv.includes("--with-clerk");

function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env ${name}.`);
    process.exit(2);
  }
  return v.trim();
}

const counts: Record<string, number> = {};
function bump(key: string, n = 1) {
  counts[key] = (counts[key] ?? 0) + n;
}

async function clerkResolveId(email: string, secret: string): Promise<string | null> {
  const r = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!r.ok) throw new Error(`Clerk lookup failed HTTP ${r.status}`);
  const list = (await r.json()) as Array<{ id: string }>;
  return list[0]?.id ?? null;
}

async function clerkCreateUser(student: DemoStudent, password: string, secret: string): Promise<string> {
  const [firstName, ...rest] = student.name.split(" ");
  const r = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email_address: [student.email],
      password,
      first_name: firstName,
      last_name: rest.join(" ") || undefined,
      public_metadata: { demo: true },
    }),
  });
  if (r.ok) {
    const u = (await r.json()) as { id: string };
    return u.id;
  }
  const err = await r.text();
  // 422 usually means the email already exists — resolve instead of failing.
  const existing = await clerkResolveId(student.email, secret).catch(() => null);
  if (existing) return existing;
  throw new Error(`Clerk create failed for ${student.email}: HTTP ${r.status} ${err.slice(0, 200)}`);
}

async function main() {
  const databaseUrl = req("DATABASE_URL");
  let password = "";
  let clerkSecret = "";
  if (WITH_CLERK) {
    clerkSecret = req("CLERK_SECRET_KEY");
    password = req("DEMO_USER_PASSWORD");
    if (password.length < 12) {
      console.error("DEMO_USER_PASSWORD must be at least 12 characters.");
      process.exit(2);
    }
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const q = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
    const r = await pool.query(text, params as unknown[]);
    return r.rows as T[];
  };

  // --- Colleges (approved listings) -----------------------------------------
  const collegeIds = new Map<string, number>();
  for (const c of DEMO_COLLEGES) {
    await q(
      `INSERT INTO colleges (name, location, description, website, status)
       VALUES ($1,$2,$3,$4,'approved') ON CONFLICT (name) DO NOTHING`,
      [c.name, c.location, c.description, c.website],
    );
    const rows = await q<{ id: number }>(`SELECT id FROM colleges WHERE name = $1`, [c.name]);
    collegeIds.set(c.name, rows[0].id);
    bump("colleges");
  }

  // --- Students ---------------------------------------------------------------
  const students = buildStudents();
  const byIndex = new Map<number, DemoStudent>();
  for (const s of students) {
    let clerkId = s.clerkId;
    if (WITH_CLERK) {
      clerkId = await clerkCreateUser(s, password, clerkSecret);
      // Upgrade placeholder ids from earlier DB-only seeds.
      await q(`UPDATE users SET clerk_id = $1 WHERE email = $2 AND clerk_id LIKE 'demo\\_%'`, [clerkId, s.email]);
      bump("clerk_upgraded");
    }
    await q(
      `INSERT INTO users (clerk_id, name, email, age, course, semester, college, pronouns, bio, role, portfolio_projects, socials)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'user',$10,$11)
       ON CONFLICT (email) DO NOTHING`,
      [clerkId, s.name, s.email, s.age, s.course, s.semester, s.college, s.pronouns, s.bio,
        JSON.stringify(portfolioFor(s)), JSON.stringify(socialsFor(s))],
    );
    const rows = await q<{ clerk_id: string }>(`SELECT clerk_id FROM users WHERE email = $1`, [s.email]);
    byIndex.set(s.index, { ...s, clerkId: rows[0].clerk_id });
    // Membership in own college.
    await q(
      `INSERT INTO college_members (college_id, clerk_id, role)
       VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`,
      [collegeIds.get(s.college), rows[0].clerk_id],
    );
    bump("users");
  }
  const cid = (i: number) => byIndex.get(i)!.clerkId;

  // --- Moderator applications + join requests (for the admin demo) ------------
  const modApps: Array<[number, number]> = [[2, 0], [13, 3], [24, 11]]; // [studentIdx, collegeIdx]
  for (const [si, ci] of modApps) {
    await q(
      `INSERT INTO moderator_applications (college_id, clerk_id, motivation, status)
       VALUES ($1,$2,'I want to help run our college community on ClubHouse.','pending')
       ON CONFLICT DO NOTHING`,
      [collegeIds.get(DEMO_COLLEGES[ci].name), cid(si)],
    );
    bump("moderator_applications");
  }
  const joinReqs: Array<[number, number]> = [[16, 2], [25, 7]];
  for (const [si, ci] of joinReqs) {
    await q(
      `INSERT INTO college_join_requests (college_id, clerk_id, status)
       VALUES ($1,$2,'pending') ON CONFLICT DO NOTHING`,
      [collegeIds.get(DEMO_COLLEGES[ci].name), cid(si)],
    );
    bump("join_requests");
  }

  // --- Projects -----------------------------------------------------------------
  for (const p of DEMO_PROJECTS) {
    const owner = cid(p.ownerIndex);
    const existing = await q<{ id: number }>(
      `SELECT id FROM projects WHERE title = $1 AND owner_id = $2`, [p.title, owner]);
    let projectId: number;
    if (existing.length) {
      projectId = existing[0].id;
    } else {
      const roles = p.requiredRoles.map((role, i) => ({ id: i + 1, role, description: null }));
      const rows = await q<{ id: number }>(
        `INSERT INTO projects (title, description, tech_stack, status, visibility, owner_id, college_id, is_joint, open_for_applications, required_roles)
         VALUES ($1,$2,$3,$4,'public',$5,$6,false,$7,$8) RETURNING id`,
        [p.title, p.description, p.techStack, p.status, owner,
          collegeIds.get(p.college) ?? null, p.openForApplications, JSON.stringify(roles)],
      );
      projectId = rows[0].id;
      bump("projects_created");
    }
    await q(
      `INSERT INTO project_members (project_id, clerk_id, role)
       VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`, [projectId, owner]);
    for (const mi of p.memberIndexes) {
      if (mi === p.ownerIndex) continue;
      await q(
        `INSERT INTO project_members (project_id, clerk_id, role)
         VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`, [projectId, cid(mi)]);
    }
    bump("project_members");
    for (const [ai, status] of p.applications) {
      const rows = await q<{ id: number }>(
        `INSERT INTO project_applications (project_id, clerk_id, applied_role, message, status)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [projectId, cid(ai), p.requiredRoles[0] ?? null,
          `Hi! I'm ${byIndex.get(ai)!.name} and I'd love to contribute to this project.`, status],
      );
      if (rows.length) bump("applications");
      if (status === "accepted") {
        await q(
          `INSERT INTO project_members (project_id, clerk_id, role)
           VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`, [projectId, cid(ai)]);
      }
    }
  }

  // --- Clubs --------------------------------------------------------------------
  const clubIds = new Map<string, number>();
  for (const c of DEMO_CLUBS) {
    const owner = cid(c.ownerIndex);
    const existing = await q<{ id: number }>(
      `SELECT id FROM clubs WHERE name = $1 AND college_id = $2`,
      [c.name, collegeIds.get(c.college)]);
    let clubId: number;
    if (existing.length) {
      clubId = existing[0].id;
    } else {
      const rows = await q<{ id: number }>(
        `INSERT INTO clubs (college_id, name, description, created_by, status)
         VALUES ($1,$2,$3,$4,'published') RETURNING id`,
        [collegeIds.get(c.college), c.name, c.description, owner],
      );
      clubId = rows[0].id;
      bump("clubs_created");
    }
    clubIds.set(c.name, clubId);
    for (const [displayName, role] of c.memberNames) {
      const match = students.find((s) => s.name === displayName);
      const found = await q<{ id: number }>(
        `SELECT id FROM club_members WHERE club_id = $1 AND name = $2`, [clubId, displayName]);
      if (!found.length) {
        await q(
          `INSERT INTO club_members (club_id, clerk_id, name, role)
           VALUES ($1,$2,$3,$4)`,
          [clubId, match ? byIndex.get(match.index)!.clerkId : null, displayName, role],
        );
        bump("club_members");
      }
    }
  }

  // --- Club events ----------------------------------------------------------------
  for (const e of DEMO_CLUB_EVENTS) {
    const clubId = clubIds.get(e.clubName);
    if (!clubId) continue;
    const when = new Date(Date.now() + e.startInDays * 86400000);
    const found = await q<{ id: number }>(
      `SELECT id FROM club_management_events WHERE club_id = $1 AND title = $2`, [clubId, e.title]);
    if (!found.length) {
      const ownerIdx = DEMO_CLUBS.find((c) => c.name === e.clubName)!.ownerIndex;
      await q(
        `INSERT INTO club_management_events (club_id, title, scheduled_at, description, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [clubId, e.title, when.toISOString(), e.description, cid(ownerIdx)],
      );
      bump("club_events");
    }
  }

  // --- Global events (hackathons / workshops / seminars) -----------------------------
  for (const e of DEMO_EVENTS) {
    const found = await q<{ id: number }>(`SELECT id FROM club_events WHERE title = $1`, [e.title]);
    let eventId: number;
    if (found.length) {
      eventId = found[0].id;
    } else {
      const start = new Date(Date.now() + e.startInDays * 86400000);
      const end = new Date(start.getTime() + e.durationHours * 3600000);
      const rows = await q<{ id: number }>(
        `INSERT INTO club_events (title, description, type, visibility, college_id, start_date, end_date, max_participants, created_by)
         VALUES ($1,$2,$3,'public',$4,$5,$6,$7,$8) RETURNING id`,
        [e.title, e.description, e.type, e.college ? collegeIds.get(e.college) ?? null : null,
          start.toISOString(), end.toISOString(), e.maxParticipants, cid(e.creatorIndex)],
      );
      eventId = rows[0].id;
      bump("events_created");
    }
    for (const ri of e.registrantIndexes) {
      await q(
        `INSERT INTO event_registrations (event_id, clerk_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`, [eventId, cid(ri)]);
    }
    bump("event_registrations");
  }

  // --- Notifications (a believable sample; existence-checked for idempotency) --------
  const navProj = await q<{ id: number }>(
    `SELECT id FROM projects WHERE title = '[Demo] Smart Campus Navigation' LIMIT 1`);
  const peerProj = await q<{ id: number }>(
    `SELECT id FROM projects WHERE title = '[Demo] Peer Tutoring Platform' LIMIT 1`);
  const wellProj = await q<{ id: number }>(
    `SELECT id FROM projects WHERE title = '[Demo] Student Mental Wellness Hub' LIMIT 1`);
  const planProj = await q<{ id: number }>(
    `SELECT id FROM projects WHERE title = '[Demo] AI Study Planner' LIMIT 1`);
  const cmrId = collegeIds.get("CMR Institute of Technology");
  const btiId = collegeIds.get("Bangalore Technological Institute");
  const notifs: Array<[number, string, string, string]> = [
    [14, "project_application", "New application for \"[Demo] Smart Campus Navigation\"",
      navProj.length ? `/projects/${navProj[0].id}` : "/discover"],
    [1, "application_approved", "Your application for \"[Demo] Peer Tutoring Platform\" was approved!",
      peerProj.length ? `/projects/${peerProj[0].id}` : "/discover"],
    [2, "project_invite", "You were invited to \"[Demo] Student Mental Wellness Hub\"",
      wellProj.length ? `/projects/${wellProj[0].id}` : "/discover"],
    [16, "college_join_approved", "Your request to join \"CMR Institute of Technology\" was approved!",
      cmrId ? `/colleges/${cmrId}` : "/discover/colleges"],
    [24, "moderator_approved", "Your moderator application has been approved!",
      btiId ? `/colleges/${btiId}` : "/discover/colleges"],
    [3, "meeting_scheduled", "New meeting: \"AI Study Planner sprint planning\"",
      planProj.length ? `/projects/${planProj[0].id}` : "/discover"],
  ];
  for (const [si, type, message, link] of notifs) {
    const found = await q<{ id: number }>(
      `SELECT id FROM notifications WHERE clerk_id = $1 AND type = $2 AND message = $3`,
      [cid(si), type, message]);
    if (!found.length) {
      await q(
        `INSERT INTO notifications (clerk_id, type, message, link_url, read)
         VALUES ($1,$2,$3,$4,false)`, [cid(si), type, message, link]);
      bump("notifications");
    }
  }

  // --- One open report so the admin Reports tab has content --------------------------
  {
    const found = await q<{ id: number }>(
      `SELECT id FROM reports WHERE reporter_id = $1 AND target_type = 'project' AND status = 'open' LIMIT 1`,
      [cid(20)]);
    if (!found.length) {
      const proj = await q<{ id: number }>(
        `SELECT id FROM projects WHERE title = '[Demo] Campus Lost & Found' LIMIT 1`);
      if (proj.length) {
        await q(
          `INSERT INTO reports (reporter_id, target_type, target_id, reason, description, status)
           VALUES ($1,'project',$2,'Spam or misleading','Demo report: description looks like placeholder text.', 'open')`,
          [cid(20), String(proj[0].id)]);
        bump("reports");
      }
    }
  }

  await pool.end();
  console.log("seed:demo complete", JSON.stringify(counts));
}

main().catch((e) => {
  console.error("seed:demo failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
