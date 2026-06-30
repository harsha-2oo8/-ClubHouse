import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  clerkId: text("clerk_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const projectApplicationsTable = pgTable("project_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  clerkId: text("clerk_id").notNull(),
  appliedRole: text("applied_role"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectMessagesTable = pgTable("project_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  clerkId: text("clerk_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectEventsTable = pgTable("project_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  meetLink: text("meet_link"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
