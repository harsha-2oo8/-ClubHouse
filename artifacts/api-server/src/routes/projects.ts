import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, projectsTable, projectMembersTable, projectApplicationsTable, projectMessagesTable, projectEventsTable, usersTable, collegesTable, notificationsTable } from "@workspace/db";
import { eq, and, ilike, sql, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getUserInfo(clerkId: string) {
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return users[0] ?? null;
}

async function formatProject(p: typeof projectsTable.$inferSelect) {
  const owner = await getUserInfo(p.ownerId);
  let collegeName: string | null = null;
  if (p.collegeId) {
    const college = await db.select().from(collegesTable).where(eq(collegesTable.id, p.collegeId)).limit(1);
    collegeName = college[0]?.name ?? null;
  }
  const memberCount = await db.select({ count: sql<number>`count(*)` }).from(projectMembersTable).where(eq(projectMembersTable.projectId, p.id));
  return {
    id: p.id, title: p.title, description: p.description, techStack: p.techStack,
    status: p.status, visibility: p.visibility, ownerId: p.ownerId, ownerName: owner?.name ?? "",
    collegeId: p.collegeId ?? null, collegeName,
    isJoint: p.isJoint, partnerColleges: p.partnerColleges ?? [],
    openForApplications: p.openForApplications, requiredRoles: p.requiredRoles ?? [],
    memberCount: Number(memberCount[0]?.count ?? 0), createdAt: p.createdAt,
  };
}

// List public projects
router.get("/", async (req: Request, res: Response) => {
  const { search, status, open } = req.query;
  let projects = await db.select().from(projectsTable).where(eq(projectsTable.visibility, "public"));
  if (search) {
    projects = projects.filter(p => p.title.toLowerCase().includes(String(search).toLowerCase()));
  }
  if (status) {
    projects = projects.filter(p => p.status === status);
  }
  if (open === "true") {
    projects = projects.filter(p => p.openForApplications);
  }
  const formatted = await Promise.all(projects.map(formatProject));
  res.json(formatted);
});

// Create project
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { title, description, techStack, visibility, collegeId, isJoint, openForApplications, requiredRoles } = req.body;
  if (!title || !visibility) {
    res.status(400).json({ error: "title and visibility are required" });
    return;
  }

  const roles = (requiredRoles ?? []).map((r: { role: string; description?: string }, i: number) => ({
    id: i + 1, role: r.role, description: r.description ?? null,
  }));

  const [project] = await db.insert(projectsTable).values({
    title, description, techStack, visibility,
    collegeId: collegeId ?? null,
    ownerId: userId!,
    isJoint: isJoint ?? false,
    openForApplications: openForApplications ?? false,
    requiredRoles: roles,
    status: "planning",
  }).returning();

  // Add owner as member
  await db.insert(projectMembersTable).values({
    projectId: project.id, clerkId: userId!, role: "owner",
  });

  res.status(201).json(await formatProject(project));
});

// Get project
router.get("/:projectId", async (req: Request, res: Response) => {
  const id = parseInt(req.params.projectId);
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!projects.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(await formatProject(projects[0]));
});

// Update project
router.patch("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!projects.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (projects[0].ownerId !== userId) {
    const user = await getUserInfo(userId!);
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
  }
  const { title, description, techStack, status, visibility, openForApplications, requiredRoles } = req.body;
  const updates: Partial<typeof projectsTable.$inferInsert> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (techStack !== undefined) updates.techStack = techStack;
  if (status !== undefined) updates.status = status;
  if (visibility !== undefined) updates.visibility = visibility;
  if (openForApplications !== undefined) updates.openForApplications = openForApplications;
  if (requiredRoles !== undefined) {
    updates.requiredRoles = requiredRoles.map((r: { role: string; description?: string }, i: number) => ({
      id: i + 1, role: r.role, description: r.description ?? null,
    }));
  }
  const [updated] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
  res.json(await formatProject(updated));
});

// Delete project
router.delete("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!projects.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (projects[0].ownerId !== userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

// Get members
router.get("/:projectId/members", async (req: Request, res: Response) => {
  const id = parseInt(req.params.projectId);
  const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, id));
  const enriched = await Promise.all(members.map(async (m) => {
    const u = await getUserInfo(m.clerkId);
    return {
      clerkId: m.clerkId, name: u?.name ?? "", avatarUrl: u?.avatarUrl ?? null,
      role: m.role, joinedAt: m.joinedAt,
    };
  }));
  res.json(enriched);
});

// Apply to project
router.post("/:projectId/apply", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const { appliedRole, message } = req.body;

  const existing = await db.select().from(projectApplicationsTable)
    .where(and(eq(projectApplicationsTable.projectId, id), eq(projectApplicationsTable.clerkId, userId!))).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Already applied" });
    return;
  }

  const [app] = await db.insert(projectApplicationsTable).values({
    projectId: id, clerkId: userId!, appliedRole, message, status: "pending",
  }).returning();

  const project = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (project.length) {
    const u = await getUserInfo(userId!);
    await db.insert(notificationsTable).values({
      clerkId: project[0].ownerId,
      type: "project_application",
      message: `${u?.name ?? "Someone"} applied to join your project "${project[0].title}"`,
      linkUrl: `/projects/${id}`,
      read: false,
    });
  }

  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: app.id, projectId: app.projectId, userId: app.clerkId,
    userName: u?.name ?? "", userEmail: u?.email ?? "",
    appliedRole: app.appliedRole, message: app.message, status: app.status, createdAt: app.createdAt,
  });
});

// Get applications
router.get("/:projectId/applications", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!projects.length || projects[0].ownerId !== userId) {
    const user = await getUserInfo(userId!);
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
  }
  const apps = await db.select().from(projectApplicationsTable).where(eq(projectApplicationsTable.projectId, id));
  const enriched = await Promise.all(apps.map(async (a) => {
    const u = await getUserInfo(a.clerkId);
    return {
      id: a.id, projectId: a.projectId, userId: a.clerkId,
      userName: u?.name ?? "", userEmail: u?.email ?? "",
      appliedRole: a.appliedRole, message: a.message, status: a.status, createdAt: a.createdAt,
    };
  }));
  res.json(enriched);
});

// Update application
router.patch("/:projectId/applications/:applicationId", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = parseInt(req.params.projectId);
  const applicationId = parseInt(req.params.applicationId);
  const { status } = req.body;

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!projects.length || projects[0].ownerId !== userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const [updated] = await db.update(projectApplicationsTable)
    .set({ status })
    .where(eq(projectApplicationsTable.id, applicationId))
    .returning();

  if (status === "approved") {
    const existing = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.clerkId, updated.clerkId))).limit(1);
    if (!existing.length) {
      await db.insert(projectMembersTable).values({
        projectId, clerkId: updated.clerkId, role: updated.appliedRole ?? "member",
      });
    }
    await db.insert(notificationsTable).values({
      clerkId: updated.clerkId,
      type: "project_application_approved",
      message: `Your application to join "${projects[0].title}" has been approved!`,
      linkUrl: `/projects/${projectId}`,
      read: false,
    });
  }

  const u = await getUserInfo(updated.clerkId);
  res.json({
    id: updated.id, projectId: updated.projectId, userId: updated.clerkId,
    userName: u?.name ?? "", userEmail: u?.email ?? "",
    appliedRole: updated.appliedRole, message: updated.message, status: updated.status, createdAt: updated.createdAt,
  });
});

// Get messages
router.get("/:projectId/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const limit = parseInt(String(req.query.limit ?? "50"));
  const before = req.query.before ? parseInt(String(req.query.before)) : undefined;

  const isMember = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, id), eq(projectMembersTable.clerkId, userId!))).limit(1);
  if (!isMember.length) {
    res.status(403).json({ error: "Must be a project member" });
    return;
  }

  let messages = await db.select().from(projectMessagesTable).where(eq(projectMessagesTable.projectId, id));
  if (before) {
    messages = messages.filter(m => m.id < before);
  }
  messages = messages.slice(-limit);

  const enriched = await Promise.all(messages.map(async (m) => {
    const u = await getUserInfo(m.clerkId);
    return {
      id: m.id, projectId: m.projectId, userId: m.clerkId,
      userName: u?.name ?? "", avatarUrl: u?.avatarUrl ?? null,
      content: m.content, createdAt: m.createdAt,
    };
  }));
  res.json(enriched);
});

// Send message
router.post("/:projectId/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const { content } = req.body;

  const isMember = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, id), eq(projectMembersTable.clerkId, userId!))).limit(1);
  if (!isMember.length) {
    res.status(403).json({ error: "Must be a project member" });
    return;
  }

  const [msg] = await db.insert(projectMessagesTable).values({
    projectId: id, clerkId: userId!, content,
  }).returning();

  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: msg.id, projectId: msg.projectId, userId: msg.clerkId,
    userName: u?.name ?? "", avatarUrl: u?.avatarUrl ?? null,
    content: msg.content, createdAt: msg.createdAt,
  });
});

// Get project events
router.get("/:projectId/events", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const events = await db.select().from(projectEventsTable).where(eq(projectEventsTable.projectId, id));
  const enriched = await Promise.all(events.map(async (e) => {
    const u = await getUserInfo(e.createdBy);
    return {
      id: e.id, projectId: e.projectId, title: e.title, description: e.description,
      meetLink: e.meetLink, scheduledAt: e.scheduledAt, createdByName: u?.name ?? "",
      createdAt: e.createdAt,
    };
  }));
  res.json(enriched);
});

// Create project event
router.post("/:projectId/events", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.projectId);
  const { title, description, meetLink, scheduledAt } = req.body;

  const isMember = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, id), eq(projectMembersTable.clerkId, userId!))).limit(1);
  if (!isMember.length) {
    res.status(403).json({ error: "Must be a project member" });
    return;
  }

  const [event] = await db.insert(projectEventsTable).values({
    projectId: id, title, description, meetLink, scheduledAt: new Date(scheduledAt), createdBy: userId!,
  }).returning();

  // Notify members
  const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, id));
  for (const m of members) {
    if (m.clerkId !== userId) {
      await db.insert(notificationsTable).values({
        clerkId: m.clerkId,
        type: "project_meeting",
        message: `New project meeting scheduled: ${title}`,
        linkUrl: `/projects/${id}`,
        read: false,
      });
    }
  }

  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: event.id, projectId: event.projectId, title: event.title, description: event.description,
    meetLink: event.meetLink, scheduledAt: event.scheduledAt, createdByName: u?.name ?? "",
    createdAt: event.createdAt,
  });
});

export default router;
