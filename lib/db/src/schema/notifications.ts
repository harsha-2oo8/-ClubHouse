import { index, pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clerkId: text("clerk_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  linkUrl: text("link_url"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("notifications_clerk_created_idx").on(t.clerkId, t.createdAt),
  index("notifications_clerk_read_idx").on(t.clerkId, t.read),
]);

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before").$type<unknown>(),
  after: jsonb("after").$type<unknown>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("admin_audit_logs_admin_idx").on(t.adminId),
  index("admin_audit_logs_entity_idx").on(t.entityType, t.entityId),
  index("admin_audit_logs_created_idx").on(t.createdAt),
]);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
