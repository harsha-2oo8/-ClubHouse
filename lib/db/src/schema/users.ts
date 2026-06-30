import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  clerkId: text("clerk_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  age: integer("age").notNull(),
  course: text("course").notNull(),
  semester: integer("semester").notNull(),
  college: text("college").notNull(),
  pronouns: text("pronouns").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  portfolioProjects: jsonb("portfolio_projects").$type<Array<{title: string; url: string; description?: string}>>().default([]),
  socials: jsonb("socials").$type<{linkedin?: string; github?: string; instagram?: string; facebook?: string; reddit?: string; whatsapp?: string}>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true, role: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
