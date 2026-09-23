import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, clubEventsTable, eventRegistrationsTable, usersTable, collegesTable, collegeMembersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getParam, getLimit } from "../lib/params";
import { strictWriteLimit } from "../lib/rateLimit";
import { canDeleteEvent } from "../lib/policy";
import { notificationService } from "../lib/notify";
import { recordAuditLog } from "../lib/audit";

const router = Router();

async function getUserInfo(clerkId: string) {
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return users[0] ?? null;
}

async function formatEvent(e: typeof clubEventsTable.$inferSelect) {
  let collegeName: string | null = null;
  if (e.collegeId) {
    const college = await db.select().from(collegesTable).where(eq(collegesTable.id, e.collegeId)).limit(1);
    collegeName = college[0]?.name ?? null;
  }
  const registrantCount = await db.select({ count: sql<number>`count(*)` })
    .from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, e.id));
  const creator = await getUserInfo(e.createdBy);
  return {
    id: e.id, title: e.title, description: e.description, type: e.type,
    visibility: e.visibility, collegeId: e.collegeId ?? null, collegeName,
    startDate: e.startDate, endDate: e.endDate ?? null,
    registrationLink: e.registrationLink ?? null, maxParticipants: e.maxParticipants ?? null,
    registrantCount: Number(registrantCount[0]?.count ?? 0),
    createdByName: creator?.name ?? "", createdBy: e.createdBy, createdAt: e.createdAt,
  };
}

// List events
router.get("/", async (req: Request, res: Response) => {
  const { type, collegeId } = req.query;
  const limit = getLimit(req);
  let events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.visibility, "public")).limit(limit * 2);
  if (type) events = events.filter(e => e.type === type);
  if (collegeId) events = events.filter(e => e.collegeId === parseInt(String(collegeId)));
  const formatted = await Promise.all(events.slice(0, limit).map(formatEvent));
  res.json(formatted);
});

// Create event
router.post("/", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { title, description, type, visibility, collegeId, startDate, endDate, registrationLink, maxParticipants } = req.body;
  if (!title || !type || !startDate || !visibility) {
    res.status(400).json({ error: "title, type, startDate, and visibility are required" });
    return;
  }

  // Verify moderator if college-specific
  if (collegeId) {
    const member = await db.select().from(collegeMembersTable)
      .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, userId!))).limit(1);
    if (!member.length || (member[0].role !== "moderator" && member[0].role !== "admin")) {
      const user = await getUserInfo(userId!);
      if (user?.role !== "admin") {
        res.status(403).json({ error: "Moderator access required" });
        return;
      }
    }
  }

  const [event] = await db.insert(clubEventsTable).values({
    title, description, type, visibility, collegeId: collegeId ?? null,
    startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null,
    registrationLink, maxParticipants, createdBy: userId!,
  }).returning();

  res.status(201).json(await formatEvent(event));
});

// Get event
router.get("/:eventId", async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, "eventId"));
  const events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.id, id)).limit(1);
  if (!events.length) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(await formatEvent(events[0]));
});

// Register for event. Enforces maxParticipants (no waitlist exists yet —
// full events reject with 409; see docs for the roadmap note).
router.post("/:eventId/register", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "eventId"));

  const events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.id, id)).limit(1);
  if (!events.length) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const existing = await db.select().from(eventRegistrationsTable)
    .where(and(eq(eventRegistrationsTable.eventId, id), eq(eventRegistrationsTable.clerkId, userId!))).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Already registered" });
    return;
  }

  if (events[0].maxParticipants != null) {
    const count = await db.select({ count: sql<number>`count(*)` })
      .from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, id));
    if (Number(count[0]?.count ?? 0) >= events[0].maxParticipants) {
      res.status(409).json({ error: "Event is full" });
      return;
    }
  }

  const [reg] = await db.insert(eventRegistrationsTable).values({
    eventId: id, clerkId: userId!,
  }).returning();

  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: reg.id, eventId: reg.eventId, userId: reg.clerkId,
    userName: u?.name ?? "", userEmail: u?.email ?? "",
    registeredAt: reg.registeredAt,
  });
});

// Update event — creator/host or platform admin.
router.patch("/:eventId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "eventId"));
  const events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.id, id)).limit(1);
  if (!events.length) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (!(await canDeleteEvent(userId!, id))) {
    res.status(403).json({ error: "Only the event creator or an admin can edit this event." });
    return;
  }
  const { title, description, type, visibility, collegeId, startDate, endDate, registrationLink, maxParticipants } = req.body ?? {};
  if (title !== undefined && (typeof title !== "string" || title.trim().length < 2)) {
    res.status(400).json({ error: "title must be at least 2 characters" });
    return;
  }
  const start = startDate !== undefined ? new Date(startDate) : events[0].startDate;
  const end = endDate !== undefined ? (endDate ? new Date(endDate) : null) : events[0].endDate;
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  if (end && end < start) {
    res.status(400).json({ error: "endDate must not be before startDate" });
    return;
  }
  if (maxParticipants !== undefined && maxParticipants !== null &&
      (!Number.isInteger(maxParticipants) || maxParticipants < 1)) {
    res.status(400).json({ error: "maxParticipants must be a positive integer" });
    return;
  }
  const before = events[0];
  const [updated] = await db.update(clubEventsTable).set({
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(collegeId !== undefined ? { collegeId: collegeId ?? null } : {}),
    ...(startDate !== undefined ? { startDate: start } : {}),
    ...(endDate !== undefined ? { endDate: end } : {}),
    ...(registrationLink !== undefined ? { registrationLink: registrationLink || null } : {}),
    ...(maxParticipants !== undefined ? { maxParticipants: maxParticipants ?? null } : {}),
  }).where(eq(clubEventsTable.id, id)).returning();
  await recordAuditLog(req, {
    action: "CREATOR_UPDATED_EVENT",
    entityType: "event",
    entityId: id,
    before,
    after: updated,
  });
  res.json(await formatEvent(updated));
});

// Delete event — creator/host or platform admin. Registrations are removed
// (cascade) and registrants are notified.
router.delete("/:eventId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "eventId"));
  const events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.id, id)).limit(1);
  if (!events.length) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (!(await canDeleteEvent(userId!, id))) {
    res.status(403).json({ error: "Only the event creator or an admin can delete this event." });
    return;
  }
  const before = events[0];
  const regs = await db.select().from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, id));
  await db.delete(clubEventsTable).where(eq(clubEventsTable.id, id));
  await recordAuditLog(req, {
    action: userId === before.createdBy ? "CREATOR_DELETED_EVENT" : "ADMIN_DELETED_EVENT",
    entityType: "event",
    entityId: id,
    before,
    metadata: { title: before.title },
  });
  for (const r of regs) {
    if (r.clerkId !== userId) {
      await notificationService.send(
        r.clerkId,
        "event_cancelled",
        `Event "${before.title}" was cancelled.`,
        "/discover/events",
      );
    }
  }
  res.status(204).send();
});

// Get registrations
router.get("/:eventId/registrations", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, "eventId"));
  const regs = await db.select().from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, id));
  const enriched = await Promise.all(regs.map(async (r) => {
    const u = await getUserInfo(r.clerkId);
    return {
      id: r.id, eventId: r.eventId, userId: r.clerkId,
      userName: u?.name ?? "", userEmail: u?.email ?? "",
      registeredAt: r.registeredAt,
    };
  }));
  res.json(enriched);
});

export default router;
