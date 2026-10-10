/**
 * Supabase Storage backend (service_role key, server-side only).
 *
 * Preferred over GCS when the project already runs on Supabase: no extra
 * accounts, files visible in the Supabase dashboard, free-tier includes ~1GB.
 *
 * Same object model as gcsStorage.ts — `<visibility>/<uploader>/<uuid>-<name>`,
 * `public/*` openly readable, `private/*` restricted to uploader or admin —
 * so the two backends are interchangeable per deployment. Stored objectPaths
 * use the `/sb/<objectName>` prefix.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./config";
import {
  buildObjectName,
  canReadObject,
  normalizeObjectName,
  objectNameFromPath as gcsObjectNameFromPath,
  sanitizeFileName,
  validateUploadInput,
  type ObjectVisibility,
} from "./gcsStorage";

export {
  buildObjectName,
  canReadObject,
  normalizeObjectName,
  sanitizeFileName,
  validateUploadInput,
};
export type { ObjectVisibility };

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const s = getConfig().supabase;
  return Boolean(s.url && s.serviceRoleKey && s.bucket);
}

function requireClient(): { client: SupabaseClient; bucket: string } {
  const s = getConfig().supabase;
  if (!s.url || !s.serviceRoleKey || !s.bucket) {
    throw new Error(
      "SUPABASE_UPLOAD_NOT_CONFIGURED: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable file uploads.",
    );
  }
  if (!client) {
    client = createClient(s.url, s.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return { client, bucket: s.bucket };
}

function fail(message: string, statusCode = 500): never {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = statusCode;
  throw err;
}

export async function createSignedUploadUrl(opts: {
  objectName: string;
  contentType: string;
}): Promise<string> {
  const { client: sb, bucket } = requireClient();
  const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(opts.objectName, {
    upsert: false,
  });
  if (error || !data?.signedUrl) fail(`Failed to mint upload URL: ${error?.message ?? "unknown"}`);
  return (data as { signedUrl: string }).signedUrl;
}

export async function objectExists(objectName: string): Promise<boolean> {
  const { client: sb, bucket } = requireClient();
  const dir = objectName.split("/").slice(0, -1).join("/");
  const name = objectName.split("/").pop() ?? "";
  const { data, error } = await sb.storage.from(bucket).list(dir || undefined, { search: name });
  if (error) return false;
  return (data ?? []).some((f) => f.name === name);
}

export async function downloadObject(objectName: string): Promise<{ buffer: Buffer; contentType: string }> {
  const { client: sb, bucket } = requireClient();
  const { data, error } = await sb.storage.from(bucket).download(objectName);
  if (error || !data) {
    const missing = error?.message?.toLowerCase().includes("not found") || error?.message?.toLowerCase().includes("does not exist");
    fail(missing ? "Object not found" : `Download failed: ${error?.message ?? "unknown"}`, missing ? 404 : 500);
  }
  const buffer = Buffer.from(await (data as Blob).arrayBuffer());
  return { buffer, contentType: (data as Blob).type || "application/octet-stream" };
}

/** Best-effort delete — callers must never fail a resource delete over storage. */
export async function deleteObject(objectName: string): Promise<void> {
  const { client: sb, bucket } = requireClient();
  const { error } = await sb.storage.from(bucket).remove([objectName]);
  if (error && !error.message.toLowerCase().includes("not found")) throw error;
}

/** Extract a Supabase object name from a stored objectPath ("/sb/<name>"). */
export function objectNameFromPath(objectPath: string | null | undefined): string | null {
  if (!objectPath || !objectPath.startsWith("/sb/")) {
    return gcsObjectNameFromPath(objectPath);
  }
  try {
    return normalizeObjectName(objectPath.slice("/sb/".length));
  } catch {
    return null;
  }
}
