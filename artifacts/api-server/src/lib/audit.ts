import { getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, adminAuditLogsTable } from "@workspace/db";

const SENSITIVE_KEY_PATTERN = /password|secret|token|session|key/i;

/** Drop secret-like keys from audit metadata. Pure — unit tested. */
export function scrubMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  return Object.fromEntries(
    Object.entries(metadata).filter(([k]) => !SENSITIVE_KEY_PATTERN.test(k)),
  );
}

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
  const scrubbed = scrubMetadata(opts.metadata);
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
