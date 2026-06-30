import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// Get notifications
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.clerkId, userId!));
  res.json(notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(n => ({
    id: n.id, userId: n.clerkId, type: n.type, message: n.message,
    linkUrl: n.linkUrl, read: n.read, createdAt: n.createdAt,
  })));
});

// Get unread count
router.get("/unread-count", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.clerkId, userId!), eq(notificationsTable.read, false)));
  res.json({ count: Number(result[0]?.count ?? 0) });
});

// Mark as read
router.patch("/:notificationId/read", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.notificationId);
  const [updated] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.clerkId, userId!)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ id: updated.id, userId: updated.clerkId, type: updated.type, message: updated.message, linkUrl: updated.linkUrl, read: updated.read, createdAt: updated.createdAt });
});

// Mark all read
router.patch("/read-all", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  await db.update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.clerkId, userId!));
  res.json({ success: true });
});

export default router;
