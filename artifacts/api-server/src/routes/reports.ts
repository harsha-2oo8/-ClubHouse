import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, reportsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getParam, getLimit } from "../lib/params";
import { strictWriteLimit } from "../lib/rateLimit";
import { recordAuditLog } from "../lib/audit";

const router = Router();

const TARGET_TYPES = new Set(["project", "club", "event", "profile"]);
const RESOLVABLE = new Set(["resolved", "dismissed"]);

// Submit a report (any signed-in user). No self-resolution possible:
// resolution is admin-only. Duplicate open reports are rejected (409).
router.post("/", requireAuth, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const { targetType, targetId, reason, description } = req.body ?? {};
  if (!TARGET_TYPES.has(targetType)) {
    res.status(400).json({ error: 'targetType must be one of: project, club, event, profile' });
    return;
  }
  if (typeof targetId !== "string" || !targetId.trim() || targetId.length > 120) {
    res.status(400).json({ error: "targetId is required (max 120 chars)" });
    return;
  }
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.length > 200) {
    res.status(400).json({ error: "reason must be 3–200 characters" });
    return;
  }
  if (description !== undefined && description !== null &&
      (typeof description !== "string" || description.length > 2000)) {
    res.status(400).json({ error: "description must be at most 2000 characters" });
    return;
  }
  const existing = await db.select().from(reportsTable).where(and(
    eq(reportsTable.reporterId, userId!),
    eq(reportsTable.targetType, targetType),
    eq(reportsTable.targetId, targetId.trim()),
    eq(reportsTable.status, "open"),
  )).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "You have already reported this item." });
    return;
  }
  const [report] = await db.insert(reportsTable).values({
    reporterId: userId!,
    targetType,
    targetId: targetId.trim(),
    reason: reason.trim(),
    description: description?.trim() || null,
    status: "open",
  }).returning();
  res.status(201).json(report);
});

// List reports (admin). Filter by status; newest first.
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : "open";
  const limit = getLimit(req, 50, 100);
  const rows = await db.select().from(reportsTable)
    .where(eq(reportsTable.status, status))
    .orderBy(desc(reportsTable.createdAt))
    .limit(limit);
  res.json(rows);
});

// Resolve / dismiss a report (admin only — reporters can never self-resolve).
router.patch("/:reportId", requireAdmin, strictWriteLimit(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const id = parseInt(getParam(req, "reportId"));
  const { status } = req.body ?? {};
  if (!RESOLVABLE.has(status)) {
    res.status(400).json({ error: 'status must be "resolved" or "dismissed"' });
    return;
  }
  const before = await db.select().from(reportsTable).where(eq(reportsTable.id, id)).limit(1);
  if (!before.length) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const [updated] = await db.update(reportsTable).set({
    status, resolvedAt: new Date(), resolvedBy: userId!,
  }).where(eq(reportsTable.id, id)).returning();
  await recordAuditLog(req, {
    action: status === "resolved" ? "ADMIN_RESOLVED_REPORT" : "ADMIN_DISMISSED_REPORT",
    entityType: "report",
    entityId: id,
    before: before[0],
    after: updated,
  });
  res.json(updated);
});

export default router;
