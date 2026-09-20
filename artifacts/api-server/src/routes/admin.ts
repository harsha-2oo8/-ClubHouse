import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, collegesTable, usersTable, moderatorApplicationsTable, collegeMembersTable, projectsTable, clubEventsTable, clubsTable, reportsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { getParam, getLimit } from "../lib/params";
import { notificationService } from "../lib/notify";
import { recordAuditLog } from "../lib/audit";
import { strictWriteLimit } from "../lib/rateLimit";

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
router.patch("/college-registrations/:collegeId", requireAdmin, strictWriteLimit(), async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, "collegeId"));
  const { status, reason } = req.body;

  const before = await db.select().from(collegesTable).where(eq(collegesTable.id, id)).limit(1);

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
    if (status === "approved") {
      await notificationService.send(
        updated.registeredBy,
        "college_approved",
        `Your college "${updated.name}" has been approved and is now live!`,
        `/colleges/${id}`,
      );
    } else {
      await notificationService.send(
        updated.registeredBy,
        "college_rejected",
        `Your college registration "${updated.name}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
        null,
      );
    }

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

  await recordAuditLog(req, {
    action: `college_registration_${status}`,
    entityType: "college",
    entityId: id,
    before: before[0] ?? null,
    after: updated,
    metadata: { reason: reason ?? null },
  });

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
router.patch("/moderator-applications/:applicationId", requireAdmin, strictWriteLimit(), async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, "applicationId"));
  const { status } = req.body;

  const before = await db.select().from(moderatorApplicationsTable).where(eq(moderatorApplicationsTable.id, id)).limit(1);

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
    await notificationService.send(
      updated.clerkId,
      "moderator_approved",
      "Your moderator application has been approved!",
      `/colleges/${updated.collegeId}`,
    );
  }

  await recordAuditLog(req, {
    action: `moderator_application_${status}`,
    entityType: "moderator_application",
    entityId: id,
    before: before[0] ?? null,
    after: updated,
  });

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
  const totalClubsResult = await db.select({ count: sql<number>`count(*)` }).from(clubsTable);
  const pendingModeratorsResult = await db.select({ count: sql<number>`count(*)` }).from(moderatorApplicationsTable).where(eq(moderatorApplicationsTable.status, "pending"));
  const pendingReportsResult = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(eq(reportsTable.status, "open"));

  res.json({
    totalUsers: Number(totalUsersResult[0]?.count ?? 0),
    totalColleges: Number(totalCollegesResult[0]?.count ?? 0),
    pendingColleges: Number(pendingCollegesResult[0]?.count ?? 0),
    totalProjects: Number(totalProjectsResult[0]?.count ?? 0),
    totalEvents: Number(totalEventsResult[0]?.count ?? 0),
    totalClubs: Number(totalClubsResult[0]?.count ?? 0),
    pendingModerators: Number(pendingModeratorsResult[0]?.count ?? 0),
    pendingReports: Number(pendingReportsResult[0]?.count ?? 0),
  });
});

// Get admin audit logs (paginated, newest first). Optional filters:
// ?action=ADMIN_DELETED_PROJECT&entityType=project&limit=50
router.get("/audit-logs", requireAdmin, async (req: Request, res: Response) => {
  const limit = getLimit(req, 50, 100);
  const action = typeof req.query.action === "string" && req.query.action ? req.query.action : null;
  const entityType = typeof req.query.entityType === "string" && req.query.entityType ? req.query.entityType : null;
  let query = db.select().from(adminAuditLogsTable).$dynamic();
  if (action) query = query.where(eq(adminAuditLogsTable.action, action));
  if (entityType) query = query.where(eq(adminAuditLogsTable.entityType, entityType));
  const rows = await query.orderBy(desc(adminAuditLogsTable.createdAt)).limit(limit);
  res.json(rows);
});

export default router;
