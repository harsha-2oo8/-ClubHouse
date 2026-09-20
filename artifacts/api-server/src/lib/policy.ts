import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  collegeMembersTable,
  clubsTable,
  clubEventsTable,
  clubManagementEventsTable,
  projectsTable,
  projectMembersTable,
  projectEventsTable,
} from "@workspace/db";

export type Role = string;

async function getUserRole(clerkId: string): Promise<string | null> {
  const rows = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function isAdmin(clerkId: string): Promise<boolean> {
  return (await getUserRole(clerkId)) === "admin";
}

export async function getCollegeRole(
  collegeId: number,
  clerkId: string,
): Promise<string | null> {
  const rows = await db
    .select({ role: collegeMembersTable.role })
    .from(collegeMembersTable)
    .where(
      and(
        eq(collegeMembersTable.collegeId, collegeId),
        eq(collegeMembersTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function isCollegeMember(
  collegeId: number,
  clerkId: string,
): Promise<boolean> {
  return (await getCollegeRole(collegeId, clerkId)) !== null;
}

export async function isCollegeModerator(
  collegeId: number,
  clerkId: string,
): Promise<boolean> {
  const role = await getCollegeRole(collegeId, clerkId);
  return role === "moderator" || role === "admin" || (await isAdmin(clerkId));
}

export async function getProjectRole(
  projectId: number,
  clerkId: string,
): Promise<string | null> {
  const rows = await db
    .select({ role: projectMembersTable.role })
    .from(projectMembersTable)
    .where(
      and(
        eq(projectMembersTable.projectId, projectId),
        eq(projectMembersTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function isProjectMember(
  projectId: number,
  clerkId: string,
): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  return (await getProjectRole(projectId, clerkId)) !== null;
}

export async function isProjectOwner(
  projectId: number,
  clerkId: string,
): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  const rows = await db
    .select({ ownerId: projectsTable.ownerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!rows.length) return false;
  if (rows[0].ownerId === clerkId) return true;
  return (await getProjectRole(projectId, clerkId)) === "owner";
}

export async function isClubOwner(
  clubId: number,
  clerkId: string,
): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  const rows = await db
    .select({ createdBy: clubsTable.createdBy })
    .from(clubsTable)
    .where(eq(clubsTable.id, clubId))
    .limit(1);
  return !!rows.length && rows[0].createdBy === clerkId;
}

// --- Domain policy helpers (pure where possible) ---

export async function canEditProject(
  clerkId: string,
  projectId: number,
): Promise<boolean> {
  return isProjectOwner(projectId, clerkId);
}

export async function canManageClub(
  clerkId: string,
  clubId: number,
): Promise<boolean> {
  return isClubOwner(clubId, clerkId);
}

export async function canModerateCollege(
  clerkId: string,
  collegeId: number,
): Promise<boolean> {
  return isCollegeModerator(collegeId, clerkId);
}

export async function canManageEvent(
  clerkId: string,
  collegeId: number | null | undefined,
): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  if (collegeId == null) return false;
  return isCollegeModerator(collegeId, clerkId);
}

// --- Creator / delete policy -----------------------------------------------
// Rule: only the creator (ownerId/createdBy) or a platform admin may delete.
// Moderators NEVER gain delete rights over other people's resources.

/** Pure ownership check: does this clerkId own a resource created by ownerId? */
export function isCreator(clerkId: string, ownerId: string | null | undefined): boolean {
  return !!ownerId && ownerId === clerkId;
}

async function fetchOwner(
  table: "project" | "club" | "clubEvent" | "clubManagementEvent" | "projectEvent",
  id: number,
): Promise<string | null> {
  if (table === "project") {
    const rows = await db.select({ ownerId: projectsTable.ownerId }).from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
    return rows[0]?.ownerId ?? null;
  }
  if (table === "club") {
    const rows = await db.select({ createdBy: clubsTable.createdBy }).from(clubsTable).where(eq(clubsTable.id, id)).limit(1);
    return rows[0]?.createdBy ?? null;
  }
  if (table === "clubEvent") {
    const rows = await db.select({ createdBy: clubEventsTable.createdBy }).from(clubEventsTable).where(eq(clubEventsTable.id, id)).limit(1);
    return rows[0]?.createdBy ?? null;
  }
  if (table === "clubManagementEvent") {
    const rows = await db.select({ createdBy: clubManagementEventsTable.createdBy }).from(clubManagementEventsTable).where(eq(clubManagementEventsTable.id, id)).limit(1);
    return rows[0]?.createdBy ?? null;
  }
  const rows = await db.select({ createdBy: projectEventsTable.createdBy }).from(projectEventsTable).where(eq(projectEventsTable.id, id)).limit(1);
  return rows[0]?.createdBy ?? null;
}

/** Creator of the project, or platform admin override. */
export async function canDeleteProject(clerkId: string, projectId: number): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  return isCreator(clerkId, await fetchOwner("project", projectId));
}

/** Creator of the club, or platform admin override. */
export async function canDeleteClub(clerkId: string, clubId: number): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  return isCreator(clerkId, await fetchOwner("club", clubId));
}

/** Creator/host of the global event, or platform admin override. */
export async function canDeleteEvent(clerkId: string, eventId: number): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  return isCreator(clerkId, await fetchOwner("clubEvent", eventId));
}

/** Club owner, event creator, or platform admin. Verifies the event belongs to the club. */
export async function canDeleteClubManagementEvent(
  clerkId: string,
  clubId: number,
  eventId: number,
): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  if (await isClubOwner(clubId, clerkId)) return true;
  const rows = await db
    .select({ clubId: clubManagementEventsTable.clubId, createdBy: clubManagementEventsTable.createdBy })
    .from(clubManagementEventsTable)
    .where(eq(clubManagementEventsTable.id, eventId))
    .limit(1);
  if (!rows.length || rows[0].clubId !== clubId) return false;
  return isCreator(clerkId, rows[0].createdBy);
}

/** Project owner, event creator, or platform admin. Verifies the event belongs to the project. */
export async function canDeleteProjectEvent(
  clerkId: string,
  projectId: number,
  eventId: number,
): Promise<boolean> {
  if (await isAdmin(clerkId)) return true;
  if (await isProjectOwner(projectId, clerkId)) return true;
  const rows = await db
    .select({ projectId: projectEventsTable.projectId, createdBy: projectEventsTable.createdBy })
    .from(projectEventsTable)
    .where(eq(projectEventsTable.id, eventId))
    .limit(1);
  if (!rows.length || rows[0].projectId !== projectId) return false;
  return isCreator(clerkId, rows[0].createdBy);
}

// --- Express middleware factories ---

function authed(req: Request): string | null {
  const { userId } = getAuth(req);
  return userId ?? null;
}

/** 403 unless caller is a member of the project (or admin). Expects :projectId. */
export function requireProjectMember(param = "projectId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = authed(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const raw = (req.params as Record<string, unknown>)[param];
    const id = Number.parseInt(
      Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""),
      10,
    );
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    if (!(await isProjectMember(id, userId))) {
      res.status(403).json({ error: "Project membership required" });
      return;
    }
    next();
  };
}

/** 403 unless caller owns the project (or admin). Expects :projectId. */
export function requireProjectOwner(param = "projectId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = authed(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const raw = (req.params as Record<string, unknown>)[param];
    const id = Number.parseInt(
      Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""),
      10,
    );
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    if (!(await isProjectOwner(id, userId))) {
      res.status(403).json({ error: "Project owner access required" });
      return;
    }
    next();
  };
}

/** 403 unless caller moderates the college (or admin). Expects :collegeId. */
export function requireCollegeModerator(param = "collegeId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = authed(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const raw = (req.params as Record<string, unknown>)[param];
    const id = Number.parseInt(
      Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""),
      10,
    );
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid college id" });
      return;
    }
    if (!(await isCollegeModerator(id, userId))) {
      res.status(403).json({ error: "College moderator access required" });
      return;
    }
    next();
  };
}

/** 403 unless caller owns the club (or admin). Expects :clubId. */
export function requireClubOwner(param = "clubId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = authed(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const raw = (req.params as Record<string, unknown>)[param];
    const id = Number.parseInt(
      Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""),
      10,
    );
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid club id" });
      return;
    }
    if (!(await isClubOwner(id, userId))) {
      res.status(403).json({ error: "Club owner access required" });
      return;
    }
    next();
  };
}
