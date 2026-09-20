/**
 * Admin bootstrap mechanism (env-only, first-boot).
 *
 * Set ADMIN_EMAILS and/or ADMIN_CLERK_IDS (comma-separated) in the environment.
 * A user whose email or clerkId matches is granted role "admin" ONLY at profile
 * creation time. Existing users are never re-promoted on later requests, and the
 * role of existing admins stays controlled by the DB `users.role` column.
 */
import { getConfig } from "./config";

export function parseAdminList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function getBootstrapAdminEmails(): string[] {
  return getConfig().adminEmails;
}

export function getBootstrapAdminClerkIds(): string[] {
  return getConfig().adminClerkIds;
}

export function shouldBootstrapAdmin(opts: {
  email: string;
  clerkId: string;
}): boolean {
  const email = opts.email.trim().toLowerCase();
  const clerkId = opts.clerkId.trim().toLowerCase();
  if (email && getBootstrapAdminEmails().includes(email)) return true;
  if (clerkId && getBootstrapAdminClerkIds().includes(clerkId)) return true;
  return false;
}
