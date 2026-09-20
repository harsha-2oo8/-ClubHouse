import type { Request } from "express";

/** Express 5 types req.params values as string | string[]. Normalize to a single string. */
export function getParam(req: Request, name: string): string {
  const raw: unknown = (req.params as Record<string, unknown>)[name];
  if (Array.isArray(raw)) return String(raw[0] ?? "");
  return String(raw ?? "");
}

/** Parse an integer route param; returns null when missing/invalid. */
export function getIntParam(req: Request, name: string): number | null {
  const id = Number.parseInt(getParam(req, name), 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Parse an optional `?limit=` query param with clamping.
 * Keeps list responses backward compatible (still plain arrays).
 */
export function getLimit(
  req: Request,
  def = 50,
  max = 100,
): number {
  const raw = req.query.limit;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const n = typeof str === "string" ? Number.parseInt(str, 10) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, 1), max);
}
