import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  collegeMembersTable,
  collegeRolesTable,
  collegeRolePermissionsTable,
  collegeRoleAssignmentsTable,
  collegeSettingsTable,
} from "@workspace/db";
import { isAdmin } from "./policy";

/**
 * College governance engine: identity (member_type) is separate from
 * capability (role grants). Permission keys are a versioned catalog;
 * assignments live in the DB. Hierarchy is numeric priority — a role may
 * only manage strictly lower priorities (platform admins bypass).
 */

export interface PermissionDef {
  key: string;
  scope: "college" | "project" | "club" | "event" | "member";
  label: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: "college.view", scope: "college", label: "View college", description: "See college pages and directories" },
  { key: "college.view_stats", scope: "college", label: "View statistics", description: "Member counts, activity summaries" },
  { key: "college.view_activity", scope: "college", label: "View activity", description: "College activity feeds and reports" },
  { key: "college.manage_settings", scope: "college", label: "Manage settings", description: "Governance knobs and policies" },
  { key: "college.manage_members", scope: "college", label: "Manage members", description: "Approve joins, change member roles" },
  { key: "college.manage_roles", scope: "college", label: "Manage roles", description: "Create, edit, delete and assign roles" },
  { key: "college.verify_types", scope: "college", label: "Verify identities", description: "Verify teacher/staff/trustee claims" },
  { key: "project.view", scope: "project", label: "View projects", description: "Browse college projects" },
  { key: "project.create", scope: "project", label: "Create projects", description: "Start new projects in the college" },
  { key: "project.edit_assigned", scope: "project", label: "Edit assigned projects", description: "Edit projects explicitly assigned" },
  { key: "project.manage_applications", scope: "project", label: "Manage applications", description: "Review project applications" },
  { key: "project.approve", scope: "project", label: "Approve projects", description: "Approve project-level resources" },
  { key: "project.mentor", scope: "project", label: "Mentor projects", description: "Marked as an available mentor" },
  { key: "club.view", scope: "club", label: "View clubs", description: "Browse college clubs" },
  { key: "club.create", scope: "club", label: "Create clubs", description: "Start new clubs in the college" },
  { key: "club.manage_assigned", scope: "club", label: "Manage assigned clubs", description: "Manage explicitly assigned clubs" },
  { key: "event.view", scope: "event", label: "View events", description: "Browse college events" },
  { key: "event.create", scope: "event", label: "Create events", description: "Host workshops, seminars, hackathons" },
  { key: "event.manage_assigned", scope: "event", label: "Manage assigned events", description: "Edit assigned events" },
  { key: "event.manage_registrations", scope: "event", label: "Manage registrations", description: "See and manage attendees" },
  { key: "event.approve", scope: "event", label: "Approve events", description: "Approve event-level resources" },
  { key: "member.view_students", scope: "member", label: "View students", description: "See student directory entries" },
  { key: "meeting.create", scope: "event", label: "Schedule meetings", description: "Create college meetings" },
  { key: "report.view", scope: "college", label: "View reports", description: "See moderation reports for the college" },
];

export const CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));

/** Suggested hierarchy priorities (templates; College Heads may change them). */
export const TYPE_PRIORITY: Record<string, number> = {
  STUDENT: 100,
  STAFF: 600,
  TEACHER: 700,
  TRUSTEE: 900,
  COLLEGE_HEAD: 1000,
};

/** Deliberately limited defaults per identity category. */
export const DEFAULT_TYPE_PERMISSIONS: Record<string, string[]> = {
  STUDENT: ["college.view", "project.view", "project.create", "club.view", "club.create", "event.view", "event.create"],
  STAFF: ["college.view", "project.view", "club.view", "club.manage_assigned", "event.view", "event.create", "event.manage_assigned", "event.manage_registrations", "meeting.create", "member.view_students"],
  TEACHER: ["college.view", "project.view", "project.create", "project.mentor", "club.view", "event.view", "event.create", "meeting.create", "member.view_students"],
  TRUSTEE: ["college.view", "college.view_stats", "college.view_activity", "project.view", "club.view", "event.view", "report.view", "member.view_students"],
  COLLEGE_HEAD: ["college.view", "college.view_stats", "college.view_activity", "college.manage_settings", "college.manage_members", "college.manage_roles", "college.verify_types", "project.view", "project.create", "project.approve", "club.view", "club.create", "event.view", "event.create", "event.approve", "member.view_students", "meeting.create", "report.view"],
};

export interface RoleTemplate {
  name: string;
  memberType: string;
  priority: number;
  description: string;
  permissions: string[];
}

export const SYSTEM_TEMPLATES: RoleTemplate[] = [
  { name: "College Head", memberType: "COLLEGE_HEAD", priority: 1000, description: "Highest authority inside the college.", permissions: DEFAULT_TYPE_PERMISSIONS.COLLEGE_HEAD },
  { name: "Trustee", memberType: "TRUSTEE", priority: 900, description: "Senior governance; view-oriented by default.", permissions: DEFAULT_TYPE_PERMISSIONS.TRUSTEE },
  { name: "Teacher", memberType: "TEACHER", priority: 700, description: "Academic and mentoring presence.", permissions: DEFAULT_TYPE_PERMISSIONS.TEACHER },
  { name: "Staff", memberType: "STAFF", priority: 600, description: "Operational and support presence.", permissions: DEFAULT_TYPE_PERMISSIONS.STAFF },
  { name: "Student", memberType: "STUDENT", priority: 100, description: "Default participant.", permissions: DEFAULT_TYPE_PERMISSIONS.STUDENT },
  { name: "Projects Coordinator", memberType: "STUDENT", priority: 650, description: "Runs the project pipeline.", permissions: ["college.view", "project.view", "project.create", "project.edit_assigned", "project.manage_applications", "project.approve", "member.view_students"] },
  { name: "Events Coordinator", memberType: "STUDENT", priority: 650, description: "Runs the events calendar.", permissions: ["college.view", "event.view", "event.create", "event.manage_assigned", "event.manage_registrations", "event.approve", "meeting.create", "member.view_students"] },
  { name: "Clubs Coordinator", memberType: "STUDENT", priority: 650, description: "Shepherds clubs and their events.", permissions: ["college.view", "club.view", "club.create", "club.manage_assigned", "event.view", "event.create", "member.view_students"] },
];

/** Legacy coarse role → comparison priority (keeps old gates meaningful). */
export function legacyPriorityFor(role: string | null | undefined): number {
  if (role === "admin") return 900;
  if (role === "moderator") return 600;
  return 100;
}

export function maxPriorityOf(priorities: number[]): number {
  return priorities.length ? Math.max(...priorities) : 0;
}

/**
 * Hierarchy safety: may `actorMax` manage something at `targetMax`?
 * Strictly-lower only, unless platform admin.
 */
export function canManageByPriority(actorMax: number, targetMax: number, isPlatformAdmin: boolean): boolean {
  if (isPlatformAdmin) return true;
  return actorMax > targetMax;
}

/** Highest role priority a user holds in a college (assignments + legacy role). */
export async function getMemberMaxPriority(collegeId: number, clerkId: string): Promise<number> {
  const [member] = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, clerkId)))
    .limit(1);
  if (!member) return 0;
  const assigned = await db.select({ priority: collegeRolesTable.priority })
    .from(collegeRoleAssignmentsTable)
    .innerJoin(collegeRolesTable, eq(collegeRoleAssignmentsTable.roleId, collegeRolesTable.id))
    .where(and(eq(collegeRoleAssignmentsTable.collegeId, collegeId), eq(collegeRoleAssignmentsTable.clerkId, clerkId)));
  return maxPriorityOf([legacyPriorityFor(member.role), ...assigned.map((a) => a.priority)]);
}

/** Effective permission check: platform admin, head wildcard, grants, or type defaults. */
export async function hasCollegePermission(clerkId: string, collegeId: number, permission: string): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  const [member] = await db.select().from(collegeMembersTable)
    .where(and(eq(collegeMembersTable.collegeId, collegeId), eq(collegeMembersTable.clerkId, clerkId)))
    .limit(1);
  if (!member) return false;
  if (member.memberStatus === "SUSPENDED") return false;
  const assigned = await db.select({ permission: collegeRolePermissionsTable.permission })
    .from(collegeRoleAssignmentsTable)
    .innerJoin(collegeRolePermissionsTable, eq(collegeRoleAssignmentsTable.roleId, collegeRolePermissionsTable.roleId))
    .where(and(eq(collegeRoleAssignmentsTable.collegeId, collegeId), eq(collegeRoleAssignmentsTable.clerkId, clerkId)));
  const granted = new Set(assigned.map((a) => a.permission));
  if (granted.has(permission)) return true;
  // College Head assignment carries college.* implicitly.
  const head = await db.select({ id: collegeRolesTable.id })
    .from(collegeRoleAssignmentsTable)
    .innerJoin(collegeRolesTable, eq(collegeRoleAssignmentsTable.roleId, collegeRolesTable.id))
    .where(and(
      eq(collegeRoleAssignmentsTable.collegeId, collegeId),
      eq(collegeRoleAssignmentsTable.clerkId, clerkId),
      eq(collegeRolesTable.memberType, "COLLEGE_HEAD"),
    )).limit(1);
  if (head.length && permission.startsWith("college.")) return true;
  const defaults = DEFAULT_TYPE_PERMISSIONS[member.memberType] ?? DEFAULT_TYPE_PERMISSIONS.STUDENT;
  return defaults.includes(permission);
}

/** All roles assigned to a member (for profile display). */
export async function getMemberRoles(collegeId: number, clerkId: string) {
  return db.select({ id: collegeRolesTable.id, name: collegeRolesTable.name, memberType: collegeRolesTable.memberType, priority: collegeRolesTable.priority })
    .from(collegeRoleAssignmentsTable)
    .innerJoin(collegeRolesTable, eq(collegeRoleAssignmentsTable.roleId, collegeRolesTable.id))
    .where(and(eq(collegeRoleAssignmentsTable.collegeId, collegeId), eq(collegeRoleAssignmentsTable.clerkId, clerkId)));
}

/** Seed the 8 system templates for a college (idempotent). Returns role rows. */
export async function seedSystemRoles(collegeId: number, createdBy: string | null) {
  const existing = await db.select({ name: collegeRolesTable.name }).from(collegeRolesTable)
    .where(eq(collegeRolesTable.collegeId, collegeId));
  const have = new Set(existing.map((r) => r.name));
  for (const t of SYSTEM_TEMPLATES) {
    if (have.has(t.name)) continue;
    const [role] = await db.insert(collegeRolesTable).values({
      collegeId, name: t.name, memberType: t.memberType, priority: t.priority,
      isSystem: true, description: t.description, createdBy,
    }).returning();
    const valid = t.permissions.filter((p) => CATALOG_KEYS.has(p));
    if (valid.length) {
      await db.insert(collegeRolePermissionsTable)
        .values(valid.map((permission) => ({ roleId: role.id, permission })))
        .onConflictDoNothing();
    }
  }
  return db.select().from(collegeRolesTable).where(eq(collegeRolesTable.collegeId, collegeId));
}
/** Grant the College Head role to a user (idempotent). */
export async function assignCollegeHead(collegeId: number, clerkId: string, assignedBy: string | null) {
  const [head] = await db.select().from(collegeRolesTable)
    .where(and(eq(collegeRolesTable.collegeId, collegeId), eq(collegeRolesTable.name, "College Head")))
    .limit(1);
  if (!head) return null;
  await db.insert(collegeRoleAssignmentsTable)
    .values({ collegeId, roleId: head.id, clerkId, assignedBy })
    .onConflictDoNothing();
  return head;
}

export async function getCollegeSettings(collegeId: number) {
  const [row] = await db.select().from(collegeSettingsTable)
    .where(eq(collegeSettingsTable.collegeId, collegeId)).limit(1);
  return row ?? null;
}

/**
 * Student-create gate: when a college disables student creation, only
 * callers with the explicit create permission (or platform admins) pass.
 * Colleges without settings behave exactly as before (allowed).
 */
export async function collegeCreateAllowed(
  clerkId: string,
  collegeId: number,
  permission: "project.create" | "club.create" | "event.create",
): Promise<boolean> {
  const settings = await getCollegeSettings(collegeId);
  if (!settings || settings.allowStudentCreate) return true;
  return hasCollegePermission(clerkId, collegeId, permission);
}

/** Join gate: closed colleges reject new join requests (moderators exempt). */
export async function collegeJoinAllowed(clerkId: string, collegeId: number): Promise<boolean> {
  const settings = await getCollegeSettings(collegeId);
  if (!settings || settings.openJoin) return true;
  return hasCollegePermission(clerkId, collegeId, "college.manage_members");
}
