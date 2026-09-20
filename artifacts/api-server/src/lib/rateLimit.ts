import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  /** Extra key scope, e.g. route name. Defaults to req.path. */
  keyPrefix?: string;
};

/**
 * Minimal in-memory fixed-window rate limiter (per user, fallback per IP).
 * Suitable for single-instance dev/small prod. For multi-instance scale,
 * replace with a shared store (Redis) without changing call sites.
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix } = options;
  return (req: Request, res: Response, next: NextFunction) => {
    const { userId } = getAuth(req);
    const who = userId ?? req.ip ?? "anon";
    const scope = keyPrefix ?? req.path;
    const key = `${scope}:${who}`;
    const now = Date.now();
    const hit = buckets.get(key);
    if (!hit || hit.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    hit.count += 1;
    if (hit.count > max) {
      const retryAfter = Math.ceil((hit.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many requests, please slow down." });
      return;
    }
    next();
  };
}

/** Sensible defaults for write-heavy endpoints. */
export const strictWriteLimit = () =>
  rateLimit({ windowMs: 60_000, max: 20 });

export const searchLimit = () => rateLimit({ windowMs: 60_000, max: 60 });
