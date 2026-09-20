import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { getConfig, resetConfigForTests, isTestClerkKey } from "./config";

const BASE_ENV = {
  PORT: "8080",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  CLERK_PUBLISHABLE_KEY: "pk_live_xxx",
  CLERK_SECRET_KEY: "sk_live_xxx",
} as const;

beforeEach(() => {
  resetConfigForTests();
  for (const [k, v] of Object.entries(BASE_ENV)) vi.stubEnv(k, v);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CORS_ORIGINS", "");
  vi.stubEnv("ADMIN_EMAILS", "");
  vi.stubEnv("ADMIN_CLERK_IDS", "");
  vi.stubEnv("GCS_PROJECT_ID", "");
  vi.stubEnv("GCS_BUCKET_NAME", "");
  vi.stubEnv("GCS_CLIENT_EMAIL", "");
  vi.stubEnv("GCS_PRIVATE_KEY", "");
  vi.stubEnv("RATE_LIMIT_WINDOW_MS", "");
  vi.stubEnv("RATE_LIMIT_WRITE_MAX", "");
  vi.stubEnv("RATE_LIMIT_SEARCH_MAX", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfigForTests();
});

describe("getConfig", () => {
  it("loads required values and applies defaults", () => {
    const c = getConfig();
    expect(c.port).toBe(8080);
    expect(c.databaseUrl).toContain("localhost");
    expect(c.corsOrigins).toBeNull();
    expect(c.logLevel).toBe("info");
    expect(c.rateLimit).toEqual({ windowMs: 60_000, writeMax: 20, searchMax: 60 });
    expect(c.gcs.projectId).toBe("");
  });

  it("parses CORS allowlists and strips trailing slashes", () => {
    vi.stubEnv("CORS_ORIGINS", "https://app.example.com/, https://admin.example.com");
    expect(getConfig().corsOrigins).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("parses admin allowlists case-insensitively", () => {
    vi.stubEnv("ADMIN_EMAILS", "Admin@Example.com");
    vi.stubEnv("ADMIN_CLERK_IDS", "User_1");
    const c = getConfig();
    expect(c.adminEmails).toEqual(["admin@example.com"]);
    expect(c.adminClerkIds).toEqual(["user_1"]);
  });

  it("throws helpfully when REQUIRED vars are missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => getConfig()).toThrow(/DATABASE_URL/);
  });

  it("rejects invalid PORT and rate limits", () => {
    vi.stubEnv("PORT", "abc");
    expect(() => getConfig()).toThrow(/PORT/);
    resetConfigForTests();
    vi.stubEnv("PORT", "8080");
    vi.stubEnv("RATE_LIMIT_WRITE_MAX", "0");
    expect(() => getConfig()).toThrow(/RATE_LIMIT_WRITE_MAX/);
  });

  it("converts literal \\n in the GCS private key", () => {
    vi.stubEnv("GCS_PRIVATE_KEY", "line1\\nline2");
    expect(getConfig().gcs.privateKey).toBe("line1\nline2");
  });
});

describe("isTestClerkKey", () => {
  it("detects test keys", () => {
    expect(isTestClerkKey("pk_test_abc")).toBe(true);
    expect(isTestClerkKey("sk_test_abc")).toBe(true);
    expect(isTestClerkKey("pk_live_abc")).toBe(false);
    expect(isTestClerkKey("sk_live_abc")).toBe(false);
  });
});
