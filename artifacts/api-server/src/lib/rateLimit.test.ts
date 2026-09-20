import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";

// getAuth() throws outside clerkMiddleware — mock Clerk auth (signed out).
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: null }),
}));

// rateLimit.ts pulls in @workspace/db via config chain — stub DATABASE_URL first.
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("PORT", "8080");
vi.stubEnv("CLERK_PUBLISHABLE_KEY", "pk_test_x");
vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
const { rateLimit, resetRateLimitForTests } = await import("./rateLimit");
const { resetConfigForTests } = await import("./config");

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    setHeader(k: string, v: string) {
      res.headers[k] = v;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

beforeEach(() => {
  resetRateLimitForTests();
  resetConfigForTests();
});

afterEach(() => {
  resetConfigForTests();
});

describe("rateLimit", () => {
  it("allows traffic under the cap", () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2 });
    let nexts = 0;
    const next = () => {
      nexts += 1;
    };
    const req = { ip: "9.9.9.9", path: "/x" } as unknown as Request;
    mw(req, mockRes() as unknown as Response, next);
    mw(req, mockRes() as unknown as Response, next);
    expect(nexts).toBe(2);
  });

  it("returns 429 with Retry-After past the cap", () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn();
    const req = { ip: "9.9.9.8", path: "/y" } as unknown as Request;
    mw(req, mockRes() as unknown as Response, next);
    const res = mockRes();
    mw(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBeDefined();
    expect(res.body).toEqual({ error: "Too many requests, please slow down." });
  });
});
