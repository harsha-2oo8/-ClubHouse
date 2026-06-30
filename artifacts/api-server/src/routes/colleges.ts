import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, collegesTable, collegeMembersTable, collegeJoinRequestsTable, moderatorApplicationsTable, collegeMeetingsTable, usersTable, projectsTable, projectMembersTable, notificationsTable } from "@workspace/db";
import { eq, and, ilike, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getUserInfo(clerkId: string) {
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return users[0] ?? null;
}

async function getMemberRole(collegeId: number, clerkId: string) {
  const members = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, clerkId)))
    .limit(1);
  return members[0]?.role ?? null;
}

async function formatCollege(c: typeof collegesTable.$inferSelect) {
  const memberCount = await db.select({ count: sql<number>`count(*)` }).from(collegeMembersTable).where(eq(collegeMembersTable.collegeId, c.id));
  const projectCount = await db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(eq(projectsTable.collegeId, c.id));
  return {
    id: c.id,
    name: c.name,
    location: c.location,
    description: c.description,
    logoUrl: c.logoUrl,
    website: c.website,
    status: c.status,
    registeredBy: c.registeredBy,
    memberCount: Number(memberCount[0]?.count ?? 0),
    projectCount: Number(projectCount[0]?.count ?? 0),
    createdAt: c.createdAt,
  };
}

// List colleges
router.get("/", async (req: Request, res: Response) => {
  const { search } = req.query;
  let query = db.select().from(collegesTable).where(eq(collegesTable.status, "approved"));
  const colleges = await db.select().from(collegesTable)
    .where(search ? and(eq(collegesTable.status, "approved"), ilike(collegesTable.name, `%${search}%`)) : eq(collegesTable.status, "approved"));
  const formatted = await Promise.all(colleges.map(formatCollege));
  res.json(formatted);
});

// Register college
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { name, location, description, logoUrl, website } = req.body;
  if (!name || !location) {
    res.status(400).json({ error: "name and location are required" });
    return;
  }
  const [college] = await db.insert(collegesTable).values({
    name, location, description, logoUrl, website,
    status: "pending",
    registeredBy: userId!,
  }).returning();
  res.status(201).json(await formatCollege(college));
});

// Get college
router.get("/:collegeId", async (req: Request, res: Response) => {
  const id = parseInt(req.params.collegeId);
  const colleges = await db.select().from(collegesTable).where(eq(collegesTable.id, id)).limit(1);
  if (!colleges.length) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  res.json(await formatCollege(colleges[0]));
});

// Get members
router.get("/:collegeId/members", async (req: Request, res: Response) => {
  const id = parseInt(req.params.collegeId);
  const members = await db.select().from(collegeMembersTable).where(eq(collegeMembersTable.collegeId, id));
  const enriched = await Promise.all(members.map(async (m) => {
    const user = await getUserInfo(m.clerkId);
    return {
      clerkId: m.clerkId,
      name: user?.name ?? "Unknown",
      email: user?.email ?? "",
      avatarUrl: user?.avatarUrl ?? null,
      course: user?.course ?? "",
      semester: user?.semester ?? 0,
      role: m.role,
      customRole: m.customRole,
      joinedAt: m.joinedAt,
    };
  }));
  res.json(enriched);
});

// Join college
router.post("/:collegeId/join", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.collegeId);

  // Check already a member
  const existing = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, id), eq(collegeMembersTable.clerkId, userId!))).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Already a member" });
    return;
  }

  // Check pending request
  const pending = await db.select().from(collegeJoinRequestsTable)
    .where(and(eq(collegeJoinRequestsTable.collegeId, id), eq(collegeJoinRequestsTable.clerkId, userId!), eq(collegeJoinRequestsTable.status, "pending"))).limit(1);
  if (pending.length) {
    res.status(409).json({ error: "Join request already pending" });
    return;
  }

  const [request] = await db.insert(collegeJoinRequestsTable).values({
    collegeId: id,
    clerkId: userId!,
    status: "pending",
  }).returning();
  const user = await getUserInfo(userId!);
  res.status(201).json({
    id: request.id,
    collegeId: request.collegeId,
    userId: request.clerkId,
    userName: user?.name ?? "",
    userEmail: user?.email ?? "",
    status: request.status,
    createdAt: request.createdAt,
  });
});

// Get join requests (moderator/admin)
router.get("/:collegeId/join-requests", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.collegeId);
  const role = await getMemberRole(id, userId!);
  const user = await getUserInfo(userId!);
  if (role !== "moderator" && role !== "admin" && user?.role !== "admin") {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }
  const requests = await db.select().from(collegeJoinRequestsTable)
    .where(and(eq(collegeJoinRequestsTable.collegeId, id), eq(collegeJoinRequestsTable.status, "pending")));
  const enriched = await Promise.all(requests.map(async (r) => {
    const u = await getUserInfo(r.clerkId);
    return {
      id: r.id, collegeId: r.collegeId, userId: r.clerkId,
      userName: u?.name ?? "", userEmail: u?.email ?? "",
      status: r.status, createdAt: r.createdAt,
    };
  }));
  res.json(enriched);
});

// Update join request
router.patch("/:collegeId/join-requests/:requestId", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const collegeId = parseInt(req.params.collegeId);
  const requestId = parseInt(req.params.requestId);
  const { status } = req.body;

  const role = await getMemberRole(collegeId, userId!);
  const user = await getUserInfo(userId!);
  if (role !== "moderator" && role !== "admin" && user?.role !== "admin") {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }

  const [updated] = await db.update(collegeJoinRequestsTable)
    .set({ status })
    .where(eq(collegeJoinRequestsTable.id, requestId))
    .returning();

  if (status === "approved") {
    const existing = await db.select().from(collegeMembersTable)
      .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, updated.clerkId))).limit(1);
    if (!existing.length) {
      await db.insert(collegeMembersTable).values({
        collegeId, clerkId: updated.clerkId, role: "member",
      });
    }
    await db.insert(notificationsTable).values({
      clerkId: updated.clerkId,
      type: "join_request_approved",
      message: "Your request to join the college club has been approved!",
      linkUrl: `/colleges/${collegeId}`,
      read: false,
    });
  }

  const u = await getUserInfo(updated.clerkId);
  res.json({ id: updated.id, collegeId: updated.collegeId, userId: updated.clerkId, userName: u?.name ?? "", userEmail: u?.email ?? "", status: updated.status, createdAt: updated.createdAt });
});

// Get moderator applications
router.get("/:collegeId/moderator-applications", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.collegeId);
  const user = await getUserInfo(userId!);
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const apps = await db.select().from(moderatorApplicationsTable)
    .where(eq(moderatorApplicationsTable.collegeId, id));
  const college = await db.select().from(collegesTable).where(eq(collegesTable.id, id)).limit(1);
  const enriched = await Promise.all(apps.map(async (a) => {
    const u = await getUserInfo(a.clerkId);
    return {
      id: a.id, collegeId: a.collegeId, collegeName: college[0]?.name ?? "",
      userId: a.clerkId, userName: u?.name ?? "", userEmail: u?.email ?? "",
      motivation: a.motivation, status: a.status, createdAt: a.createdAt,
    };
  }));
  res.json(enriched);
});

// Apply for moderator
router.post("/:collegeId/moderator-applications", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.collegeId);
  const { motivation } = req.body;

  const role = await getMemberRole(id, userId!);
  if (!role) {
    res.status(403).json({ error: "Must be a college member to apply for moderator" });
    return;
  }

  const [app] = await db.insert(moderatorApplicationsTable).values({
    collegeId: id, clerkId: userId!, motivation, status: "pending",
  }).returning();
  const college = await db.select().from(collegesTable).where(eq(collegesTable.id, id)).limit(1);
  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: app.id, collegeId: app.collegeId, collegeName: college[0]?.name ?? "",
    userId: app.clerkId, userName: u?.name ?? "", userEmail: u?.email ?? "",
    motivation: app.motivation, status: app.status, createdAt: app.createdAt,
  });
});

// Update moderator application
router.patch("/:collegeId/moderator-applications/:applicationId", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const collegeId = parseInt(req.params.collegeId);
  const applicationId = parseInt(req.params.applicationId);
  const { status } = req.body;

  const user = await getUserInfo(userId!);
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const [updated] = await db.update(moderatorApplicationsTable)
    .set({ status })
    .where(eq(moderatorApplicationsTable.id, applicationId))
    .returning();

  if (status === "approved") {
    await db.update(collegeMembersTable)
      .set({ role: "moderator" })
      .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, updated.clerkId)));
    await db.insert(notificationsTable).values({
      clerkId: updated.clerkId,
      type: "moderator_approved",
      message: "Congratulations! Your moderator application has been approved.",
      linkUrl: `/colleges/${collegeId}`,
      read: false,
    });
  }

  const college = await db.select().from(collegesTable).where(eq(collegesTable.id, collegeId)).limit(1);
  const u = await getUserInfo(updated.clerkId);
  res.json({
    id: updated.id, collegeId: updated.collegeId, collegeName: college[0]?.name ?? "",
    userId: updated.clerkId, userName: u?.name ?? "", userEmail: u?.email ?? "",
    motivation: updated.motivation, status: updated.status, createdAt: updated.createdAt,
  });
});

// Update member role
router.patch("/:collegeId/members/:userId/role", requireAuth, async (req: Request, res: Response) => {
  const { userId: currentUserId } = getAuth(req);
  const collegeId = parseInt(req.params.collegeId);
  const targetUserId = req.params.userId;
  const { role, customRole } = req.body;

  const myRole = await getMemberRole(collegeId, currentUserId!);
  if (myRole !== "moderator" && myRole !== "admin") {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }

  const [updated] = await db.update(collegeMembersTable)
    .set({ role, customRole: customRole ?? null })
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, targetUserId)))
    .returning();

  const u = await getUserInfo(targetUserId);
  res.json({
    clerkId: updated.clerkId, name: u?.name ?? "", email: u?.email ?? "",
    avatarUrl: u?.avatarUrl ?? null, course: u?.course ?? "", semester: u?.semester ?? 0,
    role: updated.role, customRole: updated.customRole, joinedAt: updated.joinedAt,
  });
});

// Get college meetings
router.get("/:collegeId/meetings", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.collegeId);
  const meetings = await db.select().from(collegeMeetingsTable).where(eq(collegeMeetingsTable.collegeId, id));
  const enriched = await Promise.all(meetings.map(async (m) => {
    const u = await getUserInfo(m.createdBy);
    return {
      id: m.id, collegeId: m.collegeId, title: m.title, description: m.description,
      meetLink: m.meetLink, scheduledAt: m.scheduledAt, createdByName: u?.name ?? "",
      createdAt: m.createdAt,
    };
  }));
  res.json(enriched);
});

// Create college meeting
router.post("/:collegeId/meetings", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.collegeId);
  const { title, description, meetLink, scheduledAt } = req.body;

  const role = await getMemberRole(id, userId!);
  if (role !== "moderator" && role !== "admin") {
    const user = await getUserInfo(userId!);
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Moderator access required" });
      return;
    }
  }

  const [meeting] = await db.insert(collegeMeetingsTable).values({
    collegeId: id, title, description, meetLink, scheduledAt: new Date(scheduledAt), createdBy: userId!,
  }).returning();

  // Notify all college members
  const members = await db.select().from(collegeMembersTable).where(eq(collegeMembersTable.collegeId, id));
  for (const m of members) {
    if (m.clerkId !== userId) {
      await db.insert(notificationsTable).values({
        clerkId: m.clerkId,
        type: "college_meeting",
        message: `New college club meeting: ${title}`,
        linkUrl: `/colleges/${id}`,
        read: false,
      });
    }
  }

  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: meeting.id, collegeId: meeting.collegeId, title: meeting.title,
    description: meeting.description, meetLink: meeting.meetLink,
    scheduledAt: meeting.scheduledAt, createdByName: u?.name ?? "", createdAt: meeting.createdAt,
  });
});

// Get college projects
router.get("/:collegeId/projects", async (req: Request, res: Response) => {
  const id = parseInt(req.params.collegeId);
  const { userId } = getAuth(req);

  let projects;
  if (userId) {
    const role = await getMemberRole(id, userId);
    if (role) {
      // Member sees public and college_only
      projects = await db.select().from(projectsTable)
        .where(and(eq(projectsTable.collegeId, id)));
    } else {
      projects = await db.select().from(projectsTable)
        .where(and(eq(projectsTable.collegeId, id), eq(projectsTable.visibility, "public")));
    }
  } else {
    projects = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.collegeId, id), eq(projectsTable.visibility, "public")));
  }

  const enriched = await Promise.all(projects.map(async (p) => {
    const owner = await getUserInfo(p.ownerId);
    const college = await db.select().from(collegesTable).where(eq(collegesTable.id, id)).limit(1);
    const memberCount = await db.select({ count: sql<number>`count(*)` }).from(projectMembersTable).where(eq(projectMembersTable.projectId, p.id));
    return {
      id: p.id, title: p.title, description: p.description, techStack: p.techStack,
      status: p.status, visibility: p.visibility, ownerId: p.ownerId, ownerName: owner?.name ?? "",
      collegeId: p.collegeId, collegeName: college[0]?.name ?? null,
      isJoint: p.isJoint, partnerColleges: p.partnerColleges ?? [],
      openForApplications: p.openForApplications, requiredRoles: p.requiredRoles ?? [],
      memberCount: Number(memberCount[0]?.count ?? 0), createdAt: p.createdAt,
    };
  }));
  res.json(enriched);
});

export default router;
