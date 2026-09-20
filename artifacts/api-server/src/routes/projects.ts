import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, projectsTable, projectMembersTable, projectApplicationsTable, projectMessagesTable, projectEventsTable, usersTable, collegesTable } from "@workspace/db";
import { eq, and, ilike, sql, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getParam, getLimit } from "../lib/params";
import { strictWriteLimit } from "../lib/rateLimit";
import { canDeleteProject, canDeleteProjectEvent } from "../lib/policy";
import { notificationService } from "../lib/notify";
import { recordAuditLog } from "../lib/audit";

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
  const limit = getLimit(req);
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
  const formatted = await Promise.all(projects.slice(0, limit).map(formatProject));
  res.json(formatted);
});

// Create project
router.post("/", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
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
  const id = parseInt(getParam(req, "projectId"));
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!projects.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(await formatProject(projects[0]));
});

// Update project
router.patch("/:projectId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "projectId"));
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

// Delete project — creator/owner or platform admin. Cascades (FK) remove
// members, applications, messages and events. Members are notified.
router.delete("/:projectId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "projectId"));
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!projects.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!(await canDeleteProject(userId!, id))) {
    res.status(403).json({ error: "Only the project creator or an admin can delete this project." });
    return;
  }
  const before = projects[0];
  const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, id));
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  await recordAuditLog(req, {
    action: userId === before.ownerId ? "CREATOR_DELETED_PROJECT" : "ADMIN_DELETED_PROJECT",
    entityType: "project",
    entityId: id,
    before,
    metadata: { title: before.title },
  });
  for (const m of members) {
    if (m.clerkId !== userId) {
      await notificationService.send(
        m.clerkId,
        "project_deleted",
        `Project "${before.title}" was deleted.`,
        "/discover",
      );
    }
  }
  res.status(204).send();
});

// Get members
router.get("/:projectId/members", async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, "projectId"));
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

// Invite a user directly to the project
router.post("/:projectId/invites", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = parseInt(getParam(req, "projectId"));
  const { targetUserId } = req.body as { targetUserId?: string };

  if (!targetUserId) {
    res.status(400).json({ error: "targetUserId is required" });
    return;
  }
  if (targetUserId === userId) {
    res.status(400).json({ error: "You are already a member of this project" });
    return;
  }

  const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const inviterMembership = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.clerkId, userId!)))
    .limit(1);
  if (!inviterMembership.length || !["owner", "moderator"].includes(inviterMembership[0].role)) {
    res.status(403).json({ error: "Only project owners and moderators can invite people" });
    return;
  }

  const target = await getUserInfo(targetUserId);
  if (!target) {
    res.status(404).json({ error: "User not found. They need to finish onboarding first." });
    return;
  }

  const existing = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.clerkId, targetUserId)))
    .limit(1);
  if (existing.length) {
    res.status(409).json({ error: "That person is already a project member" });
    return;
  }

  await db.insert(projectMembersTable).values({
    projectId,
    clerkId: targetUserId,
    role: "member",
  });
  await notificationService.send(
    targetUserId,
    "project_invite",
    `You were invited to join "${project[0].title}"`,
    `/projects/${projectId}?invite=1`,
  );

  res.status(201).json({
    projectId,
    targetUserId,
    targetUserName: target.name,
    targetUserEmail: target.email,
    status: "accepted",
    createdAt: new Date(),
  });
});

// Apply to project
router.post("/:projectId/apply", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "projectId"));
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
    await notificationService.send(
      project[0].ownerId,
      "project_application",
      `${u?.name ?? "Someone"} applied to join your project "${project[0].title}"`,
      `/projects/${id}`,
    );
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
  const id = parseInt(getParam(req, "projectId"));
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
router.patch("/:projectId/applications/:applicationId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = parseInt(getParam(req, "projectId"));
  const applicationId = parseInt(getParam(req, "applicationId"));
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
    await notificationService.send(
      updated.clerkId,
      "project_application_approved",
      `Your application to join "${projects[0].title}" has been approved!`,
      `/projects/${projectId}`,
    );
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
  const id = parseInt(getParam(req, "projectId"));
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
router.post("/:projectId/messages", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "projectId"));
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
  const id = parseInt(getParam(req, "projectId"));
  const events = await db.select().from(projectEventsTable).where(eq(projectEventsTable.projectId, id));
  const enriched = await Promise.all(events.map(async (e) => {
    const u = await getUserInfo(e.createdBy);
    return {
      id: e.id, projectId: e.projectId, title: e.title, description: e.description,
      meetLink: e.meetLink, scheduledAt: e.scheduledAt, createdByName: u?.name ?? "",
      createdBy: e.createdBy, createdAt: e.createdAt,
    };
  }));
  res.json(enriched);
});

// Create project event
router.post("/:projectId/events", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "projectId"));
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
      await notificationService.send(
        m.clerkId,
        "project_meeting",
        `New project meeting scheduled: ${title}`,
        `/projects/${id}`,
      );
    }
  }

  const u = await getUserInfo(userId!);
  res.status(201).json({
    id: event.id, projectId: event.projectId, title: event.title, description: event.description,
    meetLink: event.meetLink, scheduledAt: event.scheduledAt, createdByName: u?.name ?? "",
    createdAt: event.createdAt,
  });
});

// Delete project event — project owner, event creator, or platform admin.
router.delete("/:projectId/events/:eventId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = parseInt(getParam(req, "projectId"));
  const eventId = parseInt(getParam(req, "eventId"));
  const events = await db.select().from(projectEventsTable)
    .where(and(eq(projectEventsTable.id, eventId), eq(projectEventsTable.projectId, projectId))).limit(1);
  if (!events.length) {
    res.status(404).json({ error: "Project event not found" });
    return;
  }
  if (!(await canDeleteProjectEvent(userId!, projectId, eventId))) {
    res.status(403).json({ error: "Only the project owner, the event creator, or an admin can delete this event." });
    return;
  }
  const before = events[0];
  await db.delete(projectEventsTable).where(eq(projectEventsTable.id, eventId));
  await recordAuditLog(req, {
    action: "CREATOR_DELETED_PROJECT_EVENT",
    entityType: "project_event",
    entityId: eventId,
    before,
    metadata: { projectId },
  });
  res.status(204).send();
});

export default router;
