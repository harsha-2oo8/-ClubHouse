import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * User reports for moderation (project, club, event, profile).
 * Message-level reporting is a documented future extension.
 */
export const REPORT_TARGET_TYPES = ["project", "club", "event", "profile"] as const;
export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;

export const reportsTable = pgTable("reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  reporterId: text("reporter_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
