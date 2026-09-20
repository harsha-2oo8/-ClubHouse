/**
 * Production Google Cloud Storage service (service-account credentials).
 *
 * Replaces the Replit sidecar flow for every non-Replit deployment.
 * Credentials come ONLY from server env (GCS_* via centralized config) —
 * never from the client, never from VITE_* vars.
 *
 * Object model:
 *   <bucket>/<prefix>/<object>
 *   prefix "public/"  → served openly (avatars, logos, brochures, banners)
 *   prefix "private/" → served only to the uploader or a platform admin
 *
 * uploader clerkId is embedded in the object name
 * (`private/<clerkId>/<uuid>-<safeName>`), so ownership is derivable from
 * the path itself — no extra mapping table, no trust in client input
 * (the server builds the final name; the client-supplied filename is only
 * sanitized decoration).
 */

import { randomUUID } from "crypto";
import { Storage, type File } from "@google-cloud/storage";
import { getConfig } from "./config";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export type ObjectVisibility = "public" | "private";

let client: Storage | null = null;

export function isGcsConfigured(): boolean {
  const g = getConfig().gcs;
  return Boolean(g.projectId && g.bucketName && g.clientEmail && g.privateKey);
}

function requireClient(): { storage: Storage; bucket: string } {
  const g = getConfig().gcs;
  if (!g.projectId || !g.bucketName || !g.clientEmail || !g.privateKey) {
    throw new Error(
      "GCS_UPLOAD_NOT_CONFIGURED: set GCS_PROJECT_ID, GCS_BUCKET_NAME, " +
        "GCS_CLIENT_EMAIL and GCS_PRIVATE_KEY to enable file uploads.",
    );
  }
  if (!client) {
    client = new Storage({
      projectId: g.projectId,
      credentials: {
        client_email: g.clientEmail,
        // normalizePrivateKey() already converted literal \n sequences.
        private_key: g.privateKey,
      },
    });
  }
  return { storage: client, bucket: g.bucketName };
}

/** Strip directories, control chars and unsafe symbols from a filename. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "");
  return (cleaned || "file").slice(0, 120);
}

export function validateUploadInput(input: {
  name: string;
  size: number;
  contentType: string;
}): void {
  if (!input.name || input.name.length > 255) {
    throw new Error("Invalid file name.");
  }
  if (!Number.isInteger(input.size) || input.size < 1 || input.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File must be between 1 byte and ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
    throw new Error("Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF.");
  }
}

export function buildObjectName(opts: {
  visibility: ObjectVisibility;
  uploaderId: string;
  fileName: string;
}): string {
  const safe = sanitizeFileName(opts.fileName);
  return `${opts.visibility}/${opts.uploaderId}/${randomUUID()}-${safe}`;
}

/** Reject traversal and malformed paths before touching the bucket. */
export function normalizeObjectName(raw: string): string {
  const cleaned = raw.replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..") || cleaned.includes("\\") || cleaned.startsWith("/")) {
    throw new Error("Invalid object path.");
  }
  const [prefix] = cleaned.split("/");
  if (prefix !== "public" && prefix !== "private") {
    throw new Error("Invalid object path.");
  }
  return cleaned;
}

function visibilityOf(objectName: string): ObjectVisibility {
  return objectName.startsWith("public/") ? "public" : "private";
}

/**
 * Who may read this object? Public objects: anyone. Private objects:
 * the uploader (second path segment) or a platform admin.
 */
export function canReadObject(objectName: string, callerId: string | null, isAdmin: boolean): boolean {
  if (visibilityOf(objectName) === "public") return true;
  if (!callerId) return false;
  if (isAdmin) return true;
  const owner = objectName.split("/")[1];
  return owner === callerId;
}

export async function createSignedUploadUrl(opts: {
  objectName: string;
  contentType: string;
}): Promise<string> {
  const { storage, bucket } = requireClient();
  const [url] = await storage.bucket(bucket).file(opts.objectName).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: opts.contentType,
  });
  return url;
}

export async function objectExists(objectName: string): Promise<boolean> {
  const { storage, bucket } = requireClient();
  const [exists] = await storage.bucket(bucket).file(objectName).exists();
  return exists;
}

export async function downloadObject(objectName: string): Promise<{ buffer: Buffer; contentType: string }> {
  const { storage, bucket } = requireClient();
  const file: File = storage.bucket(bucket).file(objectName);
  const [exists] = await file.exists();
  if (!exists) {
    const err = new Error("Object not found");
    (err as { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return { buffer, contentType: (metadata.contentType as string) || "application/octet-stream" };
}

/** Best-effort delete — callers must never fail a resource delete over storage. */
export async function deleteObject(objectName: string): Promise<void> {
  const { storage, bucket } = requireClient();
  await storage.bucket(bucket).file(objectName).delete({ ignoreNotFound: true });
}

/** Extract a GCS object name from a stored objectPath ("/gcs/<name>"). */
export function objectNameFromPath(objectPath: string | null | undefined): string | null {
  if (!objectPath || !objectPath.startsWith("/gcs/")) return null;
  try {
    return normalizeObjectName(objectPath.slice("/gcs/".length));
  } catch {
    return null;
  }
}
