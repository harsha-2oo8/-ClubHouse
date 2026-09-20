import { index, pgTable, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collegesTable } from "./colleges";

export const clubsTable = pgTable("clubs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoPath: text("logo_path"),
  brochurePath: text("brochure_path"),
  brochureName: text("brochure_name"),
  createdBy: text("created_by").notNull(),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clubMembersTable = pgTable("club_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id"),
  name: text("name").notNull(),
  role: text("role").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("club_members_club_idx").on(t.clubId),
  index("club_members_clerk_idx").on(t.clerkId),
]);

export const clubManagementEventsTable = pgTable("club_management_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  description: text("description"),
  bannerPath: text("banner_path"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({ createdAt: true, updatedAt: true });
export const insertClubMemberSchema = createInsertSchema(clubMembersTable).omit({ createdAt: true });
export const insertClubManagementEventSchema = createInsertSchema(clubManagementEventsTable).omit({ createdAt: true, updatedAt: true });

export type InsertClub = z.infer<typeof insertClubSchema>;
export type InsertClubMember = z.infer<typeof insertClubMemberSchema>;
export type InsertClubManagementEvent = z.infer<typeof insertClubManagementEventSchema>;
export type Club = typeof clubsTable.$inferSelect;
export type ClubMember = typeof clubMembersTable.$inferSelect;
export type ClubManagementEvent = typeof clubManagementEventsTable.$inferSelect;