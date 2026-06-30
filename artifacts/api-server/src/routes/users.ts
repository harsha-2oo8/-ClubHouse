import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_EMAIL = "harshavardhankalvir2808@gmail.com";

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    clerkId: u.clerkId,
    name: u.name,
    email: u.email,
    age: u.age,
    course: u.course,
    semester: u.semester,
    college: u.college,
    pronouns: u.pronouns,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    portfolioProjects: u.portfolioProjects ?? [],
    socials: u.socials ?? {},
    role: u.role,
    createdAt: u.createdAt,
  };
}

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId!)).limit(1);
  if (!users.length) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(formatUser(users[0]));
});

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { name, age, course, semester, college, pronouns, bio, avatarUrl, portfolioProjects, socials } = req.body;

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId!)).limit(1);

  const updates: Partial<typeof usersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = age;
  if (course !== undefined) updates.course = course;
  if (semester !== undefined) updates.semester = semester;
  if (college !== undefined) updates.college = college;
  if (pronouns !== undefined) updates.pronouns = pronouns;
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (portfolioProjects !== undefined) updates.portfolioProjects = portfolioProjects;
  if (socials !== undefined) updates.socials = socials;

  if (!existing.length) {
    // Create profile
    if (!name || age === undefined || !course || semester === undefined || !college || !pronouns) {
      res.status(400).json({ error: "name, age, course, semester, college, and pronouns are required" });
      return;
    }
    const { default: clerkClient } = await import("@clerk/express");
    const clerkUser = await clerkClient.users.getUser(userId!);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const isAdmin = email === ADMIN_EMAIL;

    const [created] = await db.insert(usersTable).values({
      clerkId: userId!,
      name,
      email,
      age,
      course,
      semester,
      college,
      pronouns,
      bio: bio ?? null,
      avatarUrl: clerkUser.imageUrl ?? null,
      role: isAdmin ? "admin" : "user",
      portfolioProjects: portfolioProjects ?? [],
      socials: socials ?? {},
    }).returning();
    res.json(formatUser(created));
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, userId!)).returning();
  res.json(formatUser(updated));
});

router.get("/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(users[0]));
});

export default router;
