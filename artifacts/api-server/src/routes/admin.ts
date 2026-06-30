import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, collegesTable, usersTable, moderatorApplicationsTable, collegeMembersTable, projectsTable, clubEventsTable, notificationsTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

async function getUserInfo(clerkId: string) {
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return users[0] ?? null;
}

async function formatCollege(c: typeof collegesTable.$inferSelect) {
  const memberCount = await db.select({ count: sql<number>`count(*)` }).from(collegeMembersTable).where(eq(collegeMembersTable.collegeId, c.id));
  const projectCount = await db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(eq(projectsTable.collegeId, c.id));
  return {
    id: c.id, name: c.name, location: c.location, description: c.description,
    logoUrl: c.logoUrl, website: c.website, status: c.status, registeredBy: c.registeredBy,
    memberCount: Number(memberCount[0]?.count ?? 0),
    projectCount: Number(projectCount[0]?.count ?? 0),
    createdAt: c.createdAt,
  };
}

// Get college registrations
router.get("/college-registrations", requireAdmin, async (req: Request, res: Response) => {
  const { status } = req.query;
  let colleges;
  if (status) {
    colleges = await db.select().from(collegesTable).where(eq(collegesTable.status, String(status)));
  } else {
    colleges = await db.select().from(collegesTable).where(eq(collegesTable.status, "pending"));
  }
  const formatted = await Promise.all(colleges.map(formatCollege));
  res.json(formatted);
});

// Update college registration
router.patch("/college-registrations/:collegeId", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.collegeId);
  const { status, reason } = req.body;

  const [updated] = await db.update(collegesTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(collegesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "College not found" });
    return;
  }

  // Notify registrant
  if (updated.registeredBy) {
    await db.insert(notificationsTable).values({
      clerkId: updated.registeredBy,
      type: status === "approved" ? "college_approved" : "college_rejected",
      message: status === "approved"
        ? `Your college "${updated.name}" has been approved and is now live!`
        : `Your college registration "${updated.name}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
      linkUrl: status === "approved" ? `/colleges/${id}` : null,
      read: false,
    });

    // Add registrant as first member and moderator if approved
    if (status === "approved") {
      const existing = await db.select().from(collegeMembersTable)
        .where(and(eq(collegeMembersTable.collegeId, id), eq(collegeMembersTable.clerkId, updated.registeredBy))).limit(1);
      if (!existing.length) {
        await db.insert(collegeMembersTable).values({
          collegeId: id, clerkId: updated.registeredBy, role: "moderator",
        });
      }
    }
  }

  res.json(await formatCollege(updated));
});

// Get all moderator applications
router.get("/moderator-applications", requireAdmin, async (req: Request, res: Response) => {
  const apps = await db.select().from(moderatorApplicationsTable).where(eq(moderatorApplicationsTable.status, "pending"));
  const enriched = await Promise.all(apps.map(async (a) => {
    const u = await getUserInfo(a.clerkId);
    const college = await db.select().from(collegesTable).where(eq(collegesTable.id, a.collegeId)).limit(1);
    return {
      id: a.id, collegeId: a.collegeId, collegeName: college[0]?.name ?? "",
      userId: a.clerkId, userName: u?.name ?? "", userEmail: u?.email ?? "",
      motivation: a.motivation, status: a.status, createdAt: a.createdAt,
    };
  }));
  res.json(enriched);
});

// Update moderator application
router.patch("/moderator-applications/:applicationId", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.applicationId);
  const { status } = req.body;

  const [updated] = await db.update(moderatorApplicationsTable)
    .set({ status })
    .where(eq(moderatorApplicationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (status === "approved") {
    await db.update(collegeMembersTable)
      .set({ role: "moderator" })
      .where(and(eq(collegeMembersTable.collegeId, updated.collegeId), eq(collegeMembersTable.clerkId, updated.clerkId)));
    await db.insert(notificationsTable).values({
      clerkId: updated.clerkId,
      type: "moderator_approved",
      message: "Your moderator application has been approved!",
      linkUrl: `/colleges/${updated.collegeId}`,
      read: false,
    });
  }

  const u = await getUserInfo(updated.clerkId);
  const college = await db.select().from(collegesTable).where(eq(collegesTable.id, updated.collegeId)).limit(1);
  res.json({
    id: updated.id, collegeId: updated.collegeId, collegeName: college[0]?.name ?? "",
    userId: updated.clerkId, userName: u?.name ?? "", userEmail: u?.email ?? "",
    motivation: updated.motivation, status: updated.status, createdAt: updated.createdAt,
  });
});

// Get all users
router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  const { search } = req.query;
  let users = await db.select().from(usersTable);
  if (search) {
    users = users.filter(u => u.name.toLowerCase().includes(String(search).toLowerCase()) || u.email.toLowerCase().includes(String(search).toLowerCase()));
  }
  res.json(users.map(u => ({
    clerkId: u.clerkId, name: u.name, email: u.email, age: u.age,
    course: u.course, semester: u.semester, college: u.college, pronouns: u.pronouns,
    bio: u.bio, avatarUrl: u.avatarUrl, portfolioProjects: u.portfolioProjects ?? [],
    socials: u.socials ?? {}, role: u.role, createdAt: u.createdAt,
  })));
});

// Get admin stats
router.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const totalCollegesResult = await db.select({ count: sql<number>`count(*)` }).from(collegesTable).where(eq(collegesTable.status, "approved"));
  const pendingCollegesResult = await db.select({ count: sql<number>`count(*)` }).from(collegesTable).where(eq(collegesTable.status, "pending"));
  const totalProjectsResult = await db.select({ count: sql<number>`count(*)` }).from(projectsTable);
  const totalEventsResult = await db.select({ count: sql<number>`count(*)` }).from(clubEventsTable);
  const pendingModeratorsResult = await db.select({ count: sql<number>`count(*)` }).from(moderatorApplicationsTable).where(eq(moderatorApplicationsTable.status, "pending"));

  res.json({
    totalUsers: Number(totalUsersResult[0]?.count ?? 0),
    totalColleges: Number(totalCollegesResult[0]?.count ?? 0),
    pendingColleges: Number(pendingCollegesResult[0]?.count ?? 0),
    totalProjects: Number(totalProjectsResult[0]?.count ?? 0),
    totalEvents: Number(totalEventsResult[0]?.count ?? 0),
    pendingModerators: Number(pendingModeratorsResult[0]?.count ?? 0),
  });
});

export default router;
