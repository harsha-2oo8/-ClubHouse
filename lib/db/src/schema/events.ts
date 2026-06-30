import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collegesTable } from "./colleges";

export const clubEventsTable = pgTable("club_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("other"),
  visibility: text("visibility").notNull().default("public"),
  collegeId: integer("college_id").references(() => collegesTable.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  registrationLink: text("registration_link"),
  maxParticipants: integer("max_participants"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventRegistrationsTable = pgTable("event_registrations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventId: integer("event_id").notNull().references(() => clubEventsTable.id),
  clerkId: text("clerk_id").notNull(),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
});

export const insertClubEventSchema = createInsertSchema(clubEventsTable).omit({ createdAt: true });
export type InsertClubEvent = z.infer<typeof insertClubEventSchema>;
export type ClubEvent = typeof clubEventsTable.$inferSelect;
