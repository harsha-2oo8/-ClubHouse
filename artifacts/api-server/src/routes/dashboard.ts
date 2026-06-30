import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, projectMembersTable, projectsTable, collegeMembersTable, notificationsTable, clubEventsTable, collegeMeetingsTable } from "@workspace/db";
import { eq, and, sql, gt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);

  const myMemberships = await db.select().from(projectMembersTable).where(eq(projectMembersTable.clerkId, userId!));
  const myProjectsCount = myMemberships.length;

  const myCollegeMemberships = await db.select().from(collegeMembersTable).where(eq(collegeMembersTable.clerkId, userId!));
  const myCollegeId = myCollegeMemberships[0]?.collegeId ?? null;
  const myRole = myCollegeMemberships[0]?.role ?? null;

  let myCollegeName: string | null = null;
  if (myCollegeId) {
    const { collegesTable } = await import("@workspace/db");
    const college = await db.select().from(collegesTable).where(eq(collegesTable.id, myCollegeId)).limit(1);
    myCollegeName = college[0]?.name ?? null;
  }

  const unreadResult = await db.select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.clerkId, userId!), eq(notificationsTable.read, false)));
  const unreadNotifications = Number(unreadResult[0]?.count ?? 0);

  const now = new Date();
  let upcomingMeetings = 0;
  if (myCollegeId) {
    const meetings = await db.select({ count: sql<number>`count(*)` })
      .from(collegeMeetingsTable)
      .where(and(eq(collegeMeetingsTable.collegeId, myCollegeId), gt(collegeMeetingsTable.scheduledAt, now)));
    upcomingMeetings = Number(meetings[0]?.count ?? 0);
  }

  const openProjectsResult = await db.select({ count: sql<number>`count(*)` })
    .from(projectsTable)
    .where(and(eq(projectsTable.openForApplications, true), eq(projectsTable.visibility, "public")));
  const openProjectsCount = Number(openProjectsResult[0]?.count ?? 0);

  const upcomingEventsResult = await db.select({ count: sql<number>`count(*)` })
    .from(clubEventsTable)
    .where(and(eq(clubEventsTable.visibility, "public"), gt(clubEventsTable.startDate, now)));
  const upcomingEvents = Number(upcomingEventsResult[0]?.count ?? 0);

  res.json({
    myProjectsCount, myCollegeId, myCollegeName, myRole,
    unreadNotifications, upcomingMeetings, openProjectsCount, upcomingEvents,
  });
});

router.get("/activity", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.clerkId, userId!));
  const activity = notifications
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map(n => ({
      id: n.id, type: n.type, message: n.message,
      linkUrl: n.linkUrl, actorName: null, createdAt: n.createdAt,
    }));
  res.json(activity);
});

export default router;
