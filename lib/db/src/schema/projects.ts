import { index, pgTable, text, integer, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collegesTable } from "./colleges";

export const projectsTable = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description"),
  techStack: text("tech_stack"),
  status: text("status").notNull().default("planning"),
  visibility: text("visibility").notNull().default("public"),
  ownerId: text("owner_id").notNull(),
  collegeId: integer("college_id").references(() => collegesTable.id),
  isJoint: boolean("is_joint").notNull().default(false),
  partnerColleges: jsonb("partner_colleges").$type<string[]>().default([]),
  openForApplications: boolean("open_for_applications").notNull().default(false),
  requiredRoles: jsonb("required_roles").$type<Array<{id: number; role: string; description?: string}>>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectMembersTable = pgTable("project_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [
  unique("project_members_project_clerk_unique").on(t.projectId, t.clerkId),
  index("project_members_project_idx").on(t.projectId),
  index("project_members_clerk_idx").on(t.clerkId),
]);

export const projectApplicationsTable = pgTable("project_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id").notNull(),
  appliedRole: text("applied_role"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("project_applications_project_clerk_status_unique").on(t.projectId, t.clerkId, t.status),
  index("project_applications_project_idx").on(t.projectId),
]);

export const projectMessagesTable = pgTable("project_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("project_messages_project_created_idx").on(t.projectId, t.createdAt),
  index("project_messages_project_id_idx").on(t.projectId, t.id),
]);

export const projectEventsTable = pgTable("project_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  meetLink: text("meet_link"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("project_events_project_idx").on(t.projectId),
  index("project_events_scheduled_idx").on(t.projectId, t.scheduledAt),
]);

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
