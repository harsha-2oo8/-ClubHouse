import { getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, adminAuditLogsTable } from "@workspace/db";

export async function recordAuditLog(
  req: Request,
  opts: {
    action: string;
    entityType: string;
    entityId: string | number;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) return;
  // Never persist secrets/tokens even if callers pass them in metadata.
  const scrubbed = opts.metadata
    ? Object.fromEntries(
        Object.entries(opts.metadata).filter(
          ([k]) =>
            !/password|secret|token|session|key/i.test(k),
        ),
      )
    : null;
  await db.insert(adminAuditLogsTable).values({
    adminId: userId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: String(opts.entityId),
    before: (opts.before ?? null) as never,
    after: (opts.after ?? null) as never,
    metadata: scrubbed as never,
  });
}
