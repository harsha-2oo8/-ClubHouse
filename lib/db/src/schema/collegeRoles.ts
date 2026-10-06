import { pgTable, text, integer, timestamp, boolean, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collegesTable } from "./colleges";

export const MEMBER_TYPES = ["STUDENT", "TEACHER", "STAFF", "TRUSTEE", "COLLEGE_HEAD"] as const;
export const MEMBER_STATUSES = ["VERIFIED", "PENDING", "REJECTED", "SUSPENDED"] as const;

/**
 * College-scoped roles (DB-driven hierarchy).
 * - `memberType` classifies the role; `priority` orders authority.
 * - `isSystem` marks built-in templates (still editable except name/type).
 * - Identity (member_type on memberships) is separate from these grants.
 */
export const collegeRolesTable = pgTable("college_roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  memberType: text("member_type").notNull().default("STUDENT"),
  priority: integer("priority").notNull().default(100),
  isSystem: boolean("is_system").notNull().default(false),
  description: text("description"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("college_roles_college_name_unique").on(t.collegeId, t.name),
  index("college_roles_college_idx").on(t.collegeId),
]);

/** Permission keys granted to a role. Keys come from the versioned catalog in policy.ts. */
export const collegeRolePermissionsTable = pgTable("college_role_permissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roleId: integer("role_id").notNull().references(() => collegeRolesTable.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(),
}, (t) => [
  unique("college_role_perm_unique").on(t.roleId, t.permission),
  index("college_role_perm_role_idx").on(t.roleId),
]);

/** Assignment of a college-scoped role to a user. */
export const collegeRoleAssignmentsTable = pgTable("college_role_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => collegeRolesTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id").notNull(),
  assignedBy: text("assigned_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("college_role_assign_unique").on(t.roleId, t.clerkId),
  index("college_role_assign_college_idx").on(t.collegeId),
  index("college_role_assign_clerk_idx").on(t.clerkId),
]);

/** Per-college governance knobs. Additive — new keys default safely. */
export const collegeSettingsTable = pgTable("college_settings", {
  collegeId: integer("college_id").primaryKey().references(() => collegesTable.id, { onDelete: "cascade" }),
  allowStudentCreate: boolean("allow_student_create").notNull().default(true),
  openJoin: boolean("open_join").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCollegeRoleSchema = createInsertSchema(collegeRolesTable).omit({ createdAt: true });
export type InsertCollegeRole = z.infer<typeof insertCollegeRoleSchema>;
export type CollegeRole = typeof collegeRolesTable.$inferSelect;
export type CollegeRoleAssignment = typeof collegeRoleAssignmentsTable.$inferSelect;
