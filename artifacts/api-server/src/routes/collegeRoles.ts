import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  collegesTable,
  collegeMembersTable,
  collegeRolesTable,
  collegeRolePermissionsTable,
  collegeRoleAssignmentsTable,
  collegeSettingsTable,
  usersTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getParam } from "../lib/params";
import { strictWriteLimit } from "../lib/rateLimit";
import { recordAuditLog } from "../lib/audit";
import { isAdmin } from "../lib/policy";
import {
  CATALOG_KEYS,
  PERMISSION_CATALOG,
  SYSTEM_TEMPLATES,
  TYPE_PRIORITY,
  canManageByPriority,
  getMemberMaxPriority,
  getMemberRoles,
  hasCollegePermission,
  seedSystemRoles,
} from "../lib/collegeRbac";

const router = Router();
const MEMBER_TYPES = ["STUDENT", "TEACHER", "STAFF", "TRUSTEE", "COLLEGE_HEAD"];

/** College Head (manage_roles) or platform admin. Responds 403 otherwise. */
async function requireHead(req: Request, res: Response, collegeId: number): Promise<string | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (!(await hasCollegePermission(userId, collegeId, "college.manage_roles"))) {
    res.status(403).json({ error: "College Head access required" });
    return null;
  }
  return userId;
}

async function requireMember(req: Request, res: Response, collegeId: number): Promise<string | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const rows = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, userId)))
    .limit(1);
  if (!rows.length && !(await isAdmin(userId))) {
    res.status(403).json({ error: "College membership required" });
    return null;
  }
  return userId;
}

// Permission catalog + built-in templates (static metadata, authed).
router.get("/colleges/:collegeId/roles-catalog", requireAuth, async (_req: Request, res: Response) => {
  res.json({ permissions: PERMISSION_CATALOG, templates: SYSTEM_TEMPLATES });
});

// List roles with permission keys + member counts (members + platform admin).
router.get("/colleges/:collegeId/roles", requireAuth, async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const userId = await requireMember(req, res, collegeId);
  if (!userId) return;
  const roles = await db.select().from(collegeRolesTable).where(eq(collegeRolesTable.collegeId, collegeId));
  const enriched = await Promise.all(roles.map(async (r) => {
    const perms = await db.select().from(collegeRolePermissionsTable).where(eq(collegeRolePermissionsTable.roleId, r.id));
    const assignments = await db.select().from(collegeRoleAssignmentsTable).where(eq(collegeRoleAssignmentsTable.roleId, r.id));
    return {
      id: r.id, collegeId: r.collegeId, name: r.name, memberType: r.memberType,
      priority: r.priority, isSystem: r.isSystem, description: r.description,
      permissions: perms.map((p) => p.permission), memberCount: assignments.length,
      createdAt: r.createdAt,
    };
  }));
  res.json(enriched.sort((a, b) => b.priority - a.priority));
});

// Create a custom role (head only; priority capped below College Head supremacy).
router.post("/colleges/:collegeId/roles", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const { name, memberType, priority, description, permissions } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
    res.status(400).json({ error: "name must be 2–60 characters" });
    return;
  }
  if (!MEMBER_TYPES.includes(memberType)) {
    res.status(400).json({ error: "memberType must be one of STUDENT, TEACHER, STAFF, TRUSTEE, COLLEGE_HEAD" });
    return;
  }
  const prio = Number(priority ?? 100);
  if (!Number.isInteger(prio) || prio < 1 || prio > 999) {
    res.status(400).json({ error: "priority must be an integer 1–999 (1000 is reserved for College Head)" });
    return;
  }
  const actorMax = await getMemberMaxPriority(collegeId, userId);
  const platformAdmin = await isAdmin(userId);
  if (!canManageByPriority(actorMax, prio, platformAdmin)) {
    res.status(403).json({ error: "You cannot create a role at or above your own authority." });
    return;
  }
  const perms: string[] = Array.isArray(permissions) ? permissions.filter((p: unknown) => typeof p === "string" && CATALOG_KEYS.has(p)) : [];
  try {
    const [role] = await db.insert(collegeRolesTable).values({
      collegeId, name: name.trim(), memberType, priority: prio,
      isSystem: false, description: typeof description === "string" ? description : null, createdBy: userId,
    }).returning();
    if (perms.length) {
      await db.insert(collegeRolePermissionsTable)
        .values(perms.map((permission) => ({ roleId: role.id, permission })))
        .onConflictDoNothing();
    }
    await recordAuditLog(req, { action: "ROLE_CREATED", entityType: "college_role", entityId: role.id, after: role, metadata: { collegeId } });
    res.status(201).json(role);
  } catch {
    res.status(409).json({ error: "A role with this name already exists in the college." });
  }
});

// Update a role (head only; system name/type/priority locked; must outrank it).
router.patch("/colleges/:collegeId/roles/:roleId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const roleId = parseInt(getParam(req, "roleId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const [role] = await db.select().from(collegeRolesTable)
    .where(and(eq(collegeRolesTable.id, roleId), eq(collegeRolesTable.collegeId, collegeId))).limit(1);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  const actorMax = await getMemberMaxPriority(collegeId, userId);
  if (!canManageByPriority(actorMax, role.priority, await isAdmin(userId))) {
    res.status(403).json({ error: "You cannot modify a role at or above your own authority." });
    return;
  }
  const { description, permissions } = req.body ?? {};
  const updates: Partial<typeof collegeRolesTable.$inferInsert> = {};
  if (!role.isSystem && typeof req.body?.name === "string" && req.body.name.trim().length >= 2) {
    updates.name = req.body.name.trim().slice(0, 60);
  }
  if (typeof description === "string" || description === null) updates.description = description;
  const [updated] = await db.update(collegeRolesTable).set(updates).where(eq(collegeRolesTable.id, roleId)).returning();
  if (Array.isArray(permissions)) {
    const valid = permissions.filter((p: unknown) => typeof p === "string" && CATALOG_KEYS.has(p));
    await db.delete(collegeRolePermissionsTable).where(eq(collegeRolePermissionsTable.roleId, roleId));
    if (valid.length) {
      await db.insert(collegeRolePermissionsTable)
        .values(valid.map((permission: string) => ({ roleId, permission })))
        .onConflictDoNothing();
    }
  }
  await recordAuditLog(req, { action: "ROLE_UPDATED", entityType: "college_role", entityId: roleId, before: role, after: updated, metadata: { collegeId } });
  res.json(updated);
});

// Delete a custom role (head only; system roles protected).
router.delete("/colleges/:collegeId/roles/:roleId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const roleId = parseInt(getParam(req, "roleId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const [role] = await db.select().from(collegeRolesTable)
    .where(and(eq(collegeRolesTable.id, roleId), eq(collegeRolesTable.collegeId, collegeId))).limit(1);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  if (role.isSystem) {
    res.status(403).json({ error: "System roles cannot be deleted." });
    return;
  }
  const actorMax = await getMemberMaxPriority(collegeId, userId);
  if (!canManageByPriority(actorMax, role.priority, await isAdmin(userId))) {
    res.status(403).json({ error: "You cannot delete a role at or above your own authority." });
    return;
  }
  await db.delete(collegeRolesTable).where(eq(collegeRolesTable.id, roleId));
  await recordAuditLog(req, { action: "ROLE_DELETED", entityType: "college_role", entityId: roleId, before: role, metadata: { collegeId } });
  res.status(204).send();
});

// List assignments for a role, enriched (head only).
router.get("/colleges/:collegeId/roles/:roleId/assignments", requireAuth, async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const roleId = parseInt(getParam(req, "roleId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const rows = await db.select().from(collegeRoleAssignmentsTable)
    .where(and(eq(collegeRoleAssignmentsTable.collegeId, collegeId), eq(collegeRoleAssignmentsTable.roleId, roleId)));
  const enriched = await Promise.all(rows.map(async (a) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.clerkId, a.clerkId)).limit(1);
    return { id: a.id, roleId: a.roleId, clerkId: a.clerkId, userName: u?.name ?? "", createdAt: a.createdAt };
  }));
  res.json(enriched);
});

// Assign a role (head only; hierarchy-guarded both ways).
router.post("/colleges/:collegeId/roles/:roleId/assignments", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const roleId = parseInt(getParam(req, "roleId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const { clerkId } = req.body ?? {};
  if (typeof clerkId !== "string" || !clerkId) {
    res.status(400).json({ error: "clerkId is required" });
    return;
  }
  const [role] = await db.select().from(collegeRolesTable)
    .where(and(eq(collegeRolesTable.id, roleId), eq(collegeRolesTable.collegeId, collegeId))).limit(1);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  const [target] = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, clerkId))).limit(1);
  if (!target) {
    res.status(404).json({ error: "Target is not a member of this college" });
    return;
  }
  const actorMax = await getMemberMaxPriority(collegeId, userId);
  const targetMax = await getMemberMaxPriority(collegeId, clerkId);
  const platformAdmin = await isAdmin(userId);
  if (!canManageByPriority(actorMax, role.priority, platformAdmin) ||
      !canManageByPriority(actorMax, targetMax, platformAdmin)) {
    res.status(403).json({ error: "You cannot grant this role to this member (hierarchy)." });
    return;
  }
  const [assignment] = await db.insert(collegeRoleAssignmentsTable)
    .values({ collegeId, roleId, clerkId, assignedBy: userId })
    .onConflictDoNothing()
    .returning();
  await recordAuditLog(req, { action: "ROLE_ASSIGNED", entityType: "college_role", entityId: roleId, after: assignment ?? { clerkId }, metadata: { collegeId } });
  res.status(201).json(assignment ?? { collegeId, roleId, clerkId });
});

// Remove an assignment (head only; hierarchy-guarded; never strand the last head).
router.delete("/colleges/:collegeId/roles/:roleId/assignments/:assignmentId", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const roleId = parseInt(getParam(req, "roleId"));
  const assignmentId = parseInt(getParam(req, "assignmentId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const [assignment] = await db.select().from(collegeRoleAssignmentsTable)
    .where(and(eq(collegeRoleAssignmentsTable.id, assignmentId), eq(collegeRoleAssignmentsTable.collegeId, collegeId), eq(collegeRoleAssignmentsTable.roleId, roleId)))
    .limit(1);
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  const [role] = await db.select().from(collegeRolesTable).where(eq(collegeRolesTable.id, roleId)).limit(1);
  const actorMax = await getMemberMaxPriority(collegeId, userId);
  if (!role || !canManageByPriority(actorMax, role.priority, await isAdmin(userId))) {
    res.status(403).json({ error: "You cannot modify a role at or above your own authority." });
    return;
  }
  if (role.name === "College Head") {
    const heads = await db.select().from(collegeRoleAssignmentsTable).where(eq(collegeRoleAssignmentsTable.roleId, roleId));
    if (heads.length <= 1) {
      res.status(409).json({ error: "A college must keep at least one College Head." });
      return;
    }
  }
  await db.delete(collegeRoleAssignmentsTable).where(eq(collegeRoleAssignmentsTable.id, assignmentId));
  await recordAuditLog(req, { action: "ROLE_UNASSIGNED", entityType: "college_role", entityId: roleId, before: assignment, metadata: { collegeId } });
  res.status(204).send();
});

// Request or set a member type.
// - Self: STUDENT → immediate VERIFIED; TEACHER/STAFF/TRUSTEE → PENDING review;
//   COLLEGE_HEAD self-grant is forbidden (platform admin path instead).
// - Head (manage_roles): sets any type directly as VERIFIED (except creating
//   new College Heads — those stay platform-admin-granted to prevent takeovers).
router.patch("/colleges/:collegeId/members/:userId/type", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const collegeId = parseInt(getParam(req, "collegeId"));
  const targetId = getParam(req, "userId");
  const { memberType } = req.body ?? {};
  if (!MEMBER_TYPES.includes(memberType)) {
    res.status(400).json({ error: "memberType must be one of STUDENT, TEACHER, STAFF, TRUSTEE, COLLEGE_HEAD" });
    return;
  }
  const [target] = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, targetId))).limit(1);
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const self = targetId === userId;
  const head = await hasCollegePermission(userId!, collegeId, "college.manage_roles");
  if (!self && !head) {
    res.status(403).json({ error: "Only the member or a College Head can change member type." });
    return;
  }
  if (memberType === "COLLEGE_HEAD") {
    res.status(403).json({ error: "College Head can only be granted by platform administration." });
    return;
  }
  const nextStatus = head ? "VERIFIED" : memberType === "STUDENT" ? "VERIFIED" : "PENDING";
  const [updated] = await db.update(collegeMembersTable)
    .set({ memberType, memberStatus: nextStatus })
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, targetId)))
    .returning();
  await recordAuditLog(req, {
    action: head ? "MEMBER_TYPE_SET" : "MEMBER_TYPE_REQUESTED",
    entityType: "college_member", entityId: target.id,
    before: { memberType: target.memberType, memberStatus: target.memberStatus },
    after: { memberType, memberStatus: nextStatus }, metadata: { collegeId },
  });
  res.json({ clerkId: targetId, memberType: updated.memberType, memberStatus: updated.memberStatus });
});

// Verify / reject / suspend an identity claim (head only).
router.patch("/colleges/:collegeId/members/:userId/verify", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const targetId = getParam(req, "userId");
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const { status } = req.body ?? {};
  if (!["VERIFIED", "REJECTED", "SUSPENDED"].includes(status)) {
    res.status(400).json({ error: "status must be VERIFIED, REJECTED or SUSPENDED" });
    return;
  }
  const [target] = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, targetId))).limit(1);
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  // Hierarchy: head must outrank the target's authority.
  const actorMax = await getMemberMaxPriority(collegeId, userId);
  const targetMax = await getMemberMaxPriority(collegeId, targetId);
  if (!canManageByPriority(actorMax, targetMax, await isAdmin(userId))) {
    res.status(403).json({ error: "You cannot moderate a member at or above your own authority." });
    return;
  }
  const nextType = status === "REJECTED" ? "STUDENT" : target.memberType;
  const nextStatus = status === "REJECTED" ? "VERIFIED" : status;
  const [updated] = await db.update(collegeMembersTable)
    .set({ memberType: nextType, memberStatus: nextStatus })
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, targetId)))
    .returning();
  await recordAuditLog(req, {
    action: `MEMBER_${status}`, entityType: "college_member", entityId: target.id,
    before: { memberType: target.memberType, memberStatus: target.memberStatus },
    after: { memberType: nextType, memberStatus: nextStatus }, metadata: { collegeId },
  });
  res.json({ clerkId: targetId, memberType: updated.memberType, memberStatus: updated.memberStatus });
});

// College settings (head only).
router.get("/colleges/:collegeId/settings", requireAuth, async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const [row] = await db.select().from(collegeSettingsTable).where(eq(collegeSettingsTable.collegeId, collegeId)).limit(1);
  res.json(row ?? { collegeId, allowStudentCreate: true, openJoin: true, config: {} });
});

router.patch("/colleges/:collegeId/settings", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const { allowStudentCreate, openJoin } = req.body ?? {};
  if (allowStudentCreate !== undefined && typeof allowStudentCreate !== "boolean") {
    res.status(400).json({ error: "allowStudentCreate must be a boolean" });
    return;
  }
  if (openJoin !== undefined && typeof openJoin !== "boolean") {
    res.status(400).json({ error: "openJoin must be a boolean" });
    return;
  }
  const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, collegeId)).limit(1);
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  const before = await db.select().from(collegeSettingsTable).where(eq(collegeSettingsTable.collegeId, collegeId)).limit(1);
  const values = {
    collegeId,
    ...(allowStudentCreate !== undefined ? { allowStudentCreate } : {}),
    ...(openJoin !== undefined ? { openJoin } : {}),
    updatedAt: new Date(),
  };
  const [updated] = before.length
    ? await db.update(collegeSettingsTable).set(values).where(eq(collegeSettingsTable.collegeId, collegeId)).returning()
    : await db.insert(collegeSettingsTable).values(values).returning();
  await recordAuditLog(req, { action: "COLLEGE_SETTINGS_UPDATED", entityType: "college", entityId: collegeId, before: before[0] ?? null, after: updated, metadata: {} });
  res.json(updated);
});

// Ensure system roles exist for a college (head only; also called on approval).
router.post("/colleges/:collegeId/roles/seed", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const collegeId = parseInt(getParam(req, "collegeId"));
  const userId = await requireHead(req, res, collegeId);
  if (!userId) return;
  const roles = await seedSystemRoles(collegeId, userId);
  res.json(roles);
});

export default router;
