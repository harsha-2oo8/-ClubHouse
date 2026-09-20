import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubManagementEventsTable,
  collegesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getParam } from "../lib/params";
import { strictWriteLimit } from "../lib/rateLimit";
import { canDeleteClub, canDeleteClubManagementEvent } from "../lib/policy";
import { recordAuditLog } from "../lib/audit";
import { deleteObject, isGcsConfigured, objectNameFromPath } from "../lib/gcsStorage";

const router = Router();

async function getPrimaryCollege() {
  const [college] = await db.select().from(collegesTable)
    .where(eq(collegesTable.status, "approved"))
    .orderBy(asc(collegesTable.id))
    .limit(1);
  return college ?? null;
}

async function getUser(clerkId: string) {
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  return user ?? null;
}

async function getClubOrNull(id: number) {
  const [club] = await db.select().from(clubsTable)
    .where(eq(clubsTable.id, id))
    .limit(1);
  return club ?? null;
}

async function canManageClub(clubId: number, clerkId: string) {
  const club = await getClubOrNull(clubId);
  return Boolean(club && club.createdBy === clerkId);
}

async function formatClub(club: typeof clubsTable.$inferSelect, includeDetails = false) {
  const owner = await getUser(club.createdBy);
  const [memberCount] = await db.select({ count: sql<number>`count(*)` })
    .from(clubMembersTable).where(eq(clubMembersTable.clubId, club.id));
  const [eventCount] = await db.select({ count: sql<number>`count(*)` })
    .from(clubManagementEventsTable).where(eq(clubManagementEventsTable.clubId, club.id));
  const members = includeDetails
    ? await db.select().from(clubMembersTable)
      .where(eq(clubMembersTable.clubId, club.id))
      .orderBy(asc(clubMembersTable.displayOrder), asc(clubMembersTable.id))
    : undefined;
  const events = includeDetails
    ? await db.select().from(clubManagementEventsTable)
      .where(eq(clubManagementEventsTable.clubId, club.id))
      .orderBy(asc(clubManagementEventsTable.scheduledAt))
    : undefined;

  return {
    id: club.id,
    collegeId: club.collegeId,
    name: club.name,
    description: club.description,
    logoPath: club.logoPath,
    brochurePath: club.brochurePath,
    brochureName: club.brochureName,
    createdBy: club.createdBy,
    createdByName: owner?.name ?? "Club administrator",
    status: club.status,
    memberCount: Number(memberCount?.count ?? 0),
    eventCount: Number(eventCount?.count ?? 0),
    ...(includeDetails ? { members, events } : {}),
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
  };
}

async function getManagedClub(req: Request, res: Response) {
  const { userId } = getAuth(req);
  const id = Number(getParam(req, "clubId"));
  if (!Number.isInteger(id) || !userId || !(await canManageClub(id, userId))) {
    res.status(403).json({ error: "Club administrator access required" });
    return null;
  }
  return id;
}

router.get("/", async (_req: Request, res: Response) => {
  const college = await getPrimaryCollege();
  if (!college) {
    res.json([]);
    return;
  }
  const clubs = await db.select().from(clubsTable)
    .where(and(eq(clubsTable.collegeId, college.id), eq(clubsTable.status, "published")))
    .orderBy(asc(clubsTable.name));
  res.json(await Promise.all(clubs.map((club) => formatClub(club))));
});

router.post("/", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const college = await getPrimaryCollege();
  const { name, description, logoPath, brochurePath, brochureName } = req.body ?? {};
  if (!college) {
    res.status(400).json({ error: "No approved college is configured yet" });
    return;
  }
  if (!userId || typeof name !== "string" || name.trim().length < 2 ||
      typeof description !== "string" || description.trim().length < 10) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }
  const [club] = await db.insert(clubsTable).values({
    collegeId: college.id,
    name: name.trim(),
    description: description.trim(),
    logoPath: logoPath ?? null,
    brochurePath: brochurePath ?? null,
    brochureName: brochureName ?? null,
    createdBy: userId,
    status: "published",
  }).returning();
  res.status(201).json(await formatClub(club, true));
});

router.get("/:clubId", async (req: Request, res: Response) => {
  const id = Number(getParam(req, "clubId"));
  const club = await getClubOrNull(id);
  if (!club || club.status !== "published") {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  res.json(await formatClub(club, true));
});

router.patch("/:clubId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const id = await getManagedClub(req, res);
  if (!id) return;
  const { name, description, logoPath, brochurePath, brochureName } = req.body ?? {};
  const values: Partial<typeof clubsTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim().length >= 2) values.name = name.trim();
  if (typeof description === "string" && description.trim().length >= 10) values.description = description.trim();
  if (logoPath !== undefined) values.logoPath = logoPath;
  if (brochurePath !== undefined) values.brochurePath = brochurePath;
  if (brochureName !== undefined) values.brochureName = brochureName;
  const [club] = await db.update(clubsTable).set(values).where(eq(clubsTable.id, id)).returning();
  res.json(await formatClub(club, true));
});

router.delete("/:clubId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = Number(getParam(req, "clubId"));
  if (!Number.isInteger(id) || !userId || !(await canDeleteClub(userId, id))) {
    res.status(403).json({ error: "Only the club creator or an admin can delete this club." });
    return;
  }
  const before = await getClubOrNull(id);
  if (!before) {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  await db.delete(clubMembersTable).where(eq(clubMembersTable.clubId, id));
  await db.delete(clubManagementEventsTable).where(eq(clubManagementEventsTable.clubId, id));
  await db.delete(clubsTable).where(eq(clubsTable.id, id));
  // Best-effort storage cleanup — never fail the resource delete over files.
  if (isGcsConfigured()) {
    const paths = [before.logoPath, before.brochurePath];
    await Promise.all(paths.map(async (p) => {
      const name = objectNameFromPath(p);
      if (!name) return;
      try { await deleteObject(name); } catch { /* ignore */ }
    }));
  }
  await recordAuditLog(req, {
    action: userId === before.createdBy ? "CREATOR_DELETED_CLUB" : "ADMIN_DELETED_CLUB",
    entityType: "club",
    entityId: id,
    before,
    metadata: { name: before.name },
  });
  res.status(204).end();
});

router.get("/:clubId/members", async (req: Request, res: Response) => {
  const id = Number(getParam(req, "clubId"));
  res.json(await db.select().from(clubMembersTable)
    .where(eq(clubMembersTable.clubId, id))
    .orderBy(asc(clubMembersTable.displayOrder), asc(clubMembersTable.id)));
});

router.post("/:clubId/members", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const id = await getManagedClub(req, res);
  if (!id) return;
  const { name, role, displayOrder } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || typeof role !== "string" || role.trim().length < 2) {
    res.status(400).json({ error: "name and role are required" });
    return;
  }
  const [member] = await db.insert(clubMembersTable).values({
    clubId: id, name: name.trim(), role: role.trim(),
    displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
  }).returning();
  res.status(201).json(member);
});

router.patch("/:clubId/members/:memberId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const clubId = await getManagedClub(req, res);
  if (!clubId) return;
  const memberId = Number(getParam(req, "memberId"));
  const { name, role, displayOrder } = req.body ?? {};
  const [member] = await db.update(clubMembersTable).set({
    ...(typeof name === "string" ? { name: name.trim() } : {}),
    ...(typeof role === "string" ? { role: role.trim() } : {}),
    ...(Number.isInteger(displayOrder) ? { displayOrder } : {}),
  }).where(and(eq(clubMembersTable.id, memberId), eq(clubMembersTable.clubId, clubId))).returning();
  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.json(member);
});

router.delete("/:clubId/members/:memberId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const clubId = await getManagedClub(req, res);
  if (!clubId) return;
  await db.delete(clubMembersTable).where(and(
    eq(clubMembersTable.id, Number(getParam(req, "memberId"))),
    eq(clubMembersTable.clubId, clubId),
  ));
  res.status(204).end();
});

router.get("/:clubId/events", async (req: Request, res: Response) => {
  res.json(await db.select().from(clubManagementEventsTable)
    .where(eq(clubManagementEventsTable.clubId, Number(getParam(req, "clubId"))))
    .orderBy(asc(clubManagementEventsTable.scheduledAt)));
});

router.post("/:clubId/events", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const clubId = await getManagedClub(req, res);
  if (!clubId) return;
  const { userId } = getAuth(req);
  const { title, scheduledAt, description, bannerPath } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 2 || !scheduledAt) {
    res.status(400).json({ error: "title and scheduledAt are required" });
    return;
  }
  const [event] = await db.insert(clubManagementEventsTable).values({
    clubId, title: title.trim(), scheduledAt: new Date(scheduledAt),
    description: description ?? null, bannerPath: bannerPath ?? null, createdBy: userId!,
  }).returning();
  res.status(201).json(event);
});

router.patch("/:clubId/events/:eventId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const clubId = await getManagedClub(req, res);
  if (!clubId) return;
  const { title, scheduledAt, description, bannerPath } = req.body ?? {};
  const [event] = await db.update(clubManagementEventsTable).set({
    ...(typeof title === "string" ? { title: title.trim() } : {}),
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(bannerPath !== undefined ? { bannerPath } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(clubManagementEventsTable.id, Number(getParam(req, "eventId"))),
    eq(clubManagementEventsTable.clubId, clubId),
  )).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(event);
});

router.delete("/:clubId/events/:eventId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const clubId = Number(getParam(req, "clubId"));
  const eventId = Number(getParam(req, "eventId"));
  if (!Number.isInteger(clubId) || !Number.isInteger(eventId) || !userId ||
      !(await canDeleteClubManagementEvent(userId, clubId, eventId))) {
    res.status(403).json({ error: "Only the club owner, the event creator, or an admin can delete this event." });
    return;
  }
  const [before] = await db.select().from(clubManagementEventsTable).where(and(
    eq(clubManagementEventsTable.id, eventId),
    eq(clubManagementEventsTable.clubId, clubId),
  )).limit(1);
  if (!before) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  await db.delete(clubManagementEventsTable).where(eq(clubManagementEventsTable.id, eventId));
  if (isGcsConfigured()) {
    const name = objectNameFromPath(before.bannerPath);
    if (name) {
      try { await deleteObject(name); } catch { /* ignore */ }
    }
  }
  await recordAuditLog(req, {
    action: "CREATOR_DELETED_CLUB_EVENT",
    entityType: "club_event",
    entityId: eventId,
    before,
    metadata: { clubId },
  });
  res.status(204).end();
});

export default router;