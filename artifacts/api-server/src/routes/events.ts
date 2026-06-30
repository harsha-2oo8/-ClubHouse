import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, clubEventsTable, eventRegistrationsTable, usersTable, collegesTable, collegeMembersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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
    createdByName: creator?.name ?? "", createdAt: e.createdAt,
  };
}

// List events
router.get("/", async (req: Request, res: Response) => {
  const { type, collegeId } = req.query;
  let events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.visibility, "public"));
  if (type) events = events.filter(e => e.type === type);
  if (collegeId) events = events.filter(e => e.collegeId === parseInt(String(collegeId)));
  const formatted = await Promise.all(events.map(formatEvent));
  res.json(formatted);
});

// Create event
router.post("/", requireAuth, async (req: Request, res: Response) => {
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
  const id = parseInt(req.params.eventId);
  const events = await db.select().from(clubEventsTable).where(eq(clubEventsTable.id, id)).limit(1);
  if (!events.length) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(await formatEvent(events[0]));
});

// Register for event
router.post("/:eventId/register", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.eventId);

  const existing = await db.select().from(eventRegistrationsTable)
    .where(and(eq(eventRegistrationsTable.eventId, id), eq(eventRegistrationsTable.clerkId, userId!))).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Already registered" });
    return;
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

// Get registrations
router.get("/:eventId/registrations", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.eventId);
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
