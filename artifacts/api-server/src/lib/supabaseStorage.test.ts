import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("PORT", "8080");
vi.stubEnv("CLERK_PUBLISHABLE_KEY", "pk_test_x");
vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
const { resetConfigForTests } = await import("./config");
const { isSupabaseConfigured } = await import("./supabaseStorage");
const { objectNameFromPath } = await import("./supabaseStorage");

beforeEach(() => {
  resetConfigForTests();
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
  vi.stubEnv("PORT", "8080");
  vi.stubEnv("CLERK_PUBLISHABLE_KEY", "pk_test_x");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "clubhouse-uploads");
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfigForTests();
});

describe("supabase storage config", () => {
  it("is unconfigured without url + key", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is configured with url + service key", () => {
    vi.stubEnv("SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("extracts /sb/ paths and falls back for legacy /gcs/ paths", () => {
    expect(objectNameFromPath("/sb/public/u1/x.png")).toBe("public/u1/x.png");
    expect(objectNameFromPath("/gcs/public/u1/x.png")).toBe("public/u1/x.png");
    expect(objectNameFromPath("/objects/x")).toBeNull();
    expect(objectNameFromPath(null)).toBeNull();
  });
});
