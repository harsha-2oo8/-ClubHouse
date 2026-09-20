import { Router, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getParam, getLimit } from "../lib/params";
import { shouldBootstrapAdmin } from "../lib/adminBootstrap";
import { searchLimit, strictWriteLimit } from "../lib/rateLimit";

const router = Router();

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
    showPortfolio: u.showPortfolio ?? true,
    showSocials: u.showSocials ?? true,
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

router.get("/search", requireAuth, searchLimit(), async (req: Request, res: Response) => {
  const query = String(req.query.q ?? "").trim();
  if (query.length < 2) {
    res.json([]);
    return;
  }

  const users = await db.select().from(usersTable)
    .where(or(ilike(usersTable.name, `%${query}%`), ilike(usersTable.email, `%${query}%`)))
    .limit(getLimit(req, 8, 50));
  res.json(users.map(formatUser));
});

router.patch("/me", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { name, age, course, semester, college, pronouns, bio, avatarUrl, portfolioProjects, socials, showPortfolio, showSocials } = req.body;

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
  // Privacy flags: strict booleans only. Role/owner fields are never assignable here.
  if (showPortfolio !== undefined) {
    if (typeof showPortfolio !== "boolean") {
      res.status(400).json({ error: "showPortfolio must be a boolean" });
      return;
    }
    updates.showPortfolio = showPortfolio;
  }
  if (showSocials !== undefined) {
    if (typeof showSocials !== "boolean") {
      res.status(400).json({ error: "showSocials must be a boolean" });
      return;
    }
    updates.showSocials = showSocials;
  }

  if (!existing.length) {
    // Create profile
    if (!name || age === undefined || !course || semester === undefined || !college || !pronouns) {
      res.status(400).json({ error: "name, age, course, semester, college, and pronouns are required" });
      return;
    }
    const clerkUser = await clerkClient.users.getUser(userId!);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    // Env-based bootstrap: only grants admin at first profile creation, never on updates.
    const isAdmin = shouldBootstrapAdmin({ email, clerkId: userId! });

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
  const userId = getParam(req, "userId");
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Public profile: email is private; portfolio/socials honor privacy flags.
  const { email: _privateEmail, ...publicProfile } = formatUser(users[0]);
  if (!users[0].showPortfolio) publicProfile.portfolioProjects = [];
  if (!users[0].showSocials) publicProfile.socials = {};
  res.json(publicProfile);
});

export default router;
