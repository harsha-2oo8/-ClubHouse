import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collegesTable = pgTable("colleges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  location: text("location").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  website: text("website"),
  status: text("status").notNull().default("pending"),
  registeredBy: text("registered_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const collegeMembersTable = pgTable("college_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id),
  clerkId: text("clerk_id").notNull(),
  role: text("role").notNull().default("member"),
  customRole: text("custom_role"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const collegeJoinRequestsTable = pgTable("college_join_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id),
  clerkId: text("clerk_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const moderatorApplicationsTable = pgTable("moderator_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id),
  clerkId: text("clerk_id").notNull(),
  motivation: text("motivation"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collegeMeetingsTable = pgTable("college_meetings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id),
  title: text("title").notNull(),
  description: text("description"),
  meetLink: text("meet_link"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCollegeSchema = createInsertSchema(collegesTable).omit({ createdAt: true, updatedAt: true });
export type InsertCollege = z.infer<typeof insertCollegeSchema>;
export type College = typeof collegesTable.$inferSelect;
export type CollegeMember = typeof collegeMembersTable.$inferSelect;
