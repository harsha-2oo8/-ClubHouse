import { describe, expect, it, vi } from "vitest";

vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("PORT", "8080");
vi.stubEnv("CLERK_PUBLISHABLE_KEY", "pk_test_x");
vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");

const {
  CATALOG_KEYS,
  DEFAULT_TYPE_PERMISSIONS,
  SYSTEM_TEMPLATES,
  canManageByPriority,
  legacyPriorityFor,
  maxPriorityOf,
} = await import("./collegeRbac");

describe("hierarchy", () => {
  it("maxPriorityOf handles empty and values", () => {
    expect(maxPriorityOf([])).toBe(0);
    expect(maxPriorityOf([100, 650, 600])).toBe(650);
  });

  it("strictly-lower management with platform-admin bypass", () => {
    expect(canManageByPriority(1000, 900, false)).toBe(true);
    expect(canManageByPriority(650, 650, false)).toBe(false); // peers cannot manage peers
    expect(canManageByPriority(600, 700, false)).toBe(false); // staff cannot touch teacher
    expect(canManageByPriority(100, 100, false)).toBe(false);
    expect(canManageByPriority(100, 900, true)).toBe(true); // platform override
  });

  it("legacy roles map to sensible comparison rungs", () => {
    expect(legacyPriorityFor("member")).toBe(100);
    expect(legacyPriorityFor("moderator")).toBe(600);
    expect(legacyPriorityFor("admin")).toBe(900);
    expect(legacyPriorityFor(undefined)).toBe(100);
  });
});

describe("permission model", () => {
  it("catalog keys are unique and templates only use catalog keys", () => {
    const keys = SYSTEM_TEMPLATES.flatMap((t) => t.permissions);
    for (const k of keys) expect(CATALOG_KEYS.has(k)).toBe(true);
    expect(SYSTEM_TEMPLATES.map((t) => t.name)).toContain("College Head");
    expect(SYSTEM_TEMPLATES.map((t) => t.name)).toContain("Projects Coordinator");
  });

  it("students cannot manage roles; heads can do college governance", () => {
    expect(DEFAULT_TYPE_PERMISSIONS.STUDENT).not.toContain("college.manage_roles");
    expect(DEFAULT_TYPE_PERMISSIONS.STUDENT).not.toContain("college.verify_types");
    expect(DEFAULT_TYPE_PERMISSIONS.COLLEGE_HEAD).toContain("college.manage_roles");
    expect(DEFAULT_TYPE_PERMISSIONS.COLLEGE_HEAD).toContain("college.verify_types");
    expect(DEFAULT_TYPE_PERMISSIONS.TRUSTEE).not.toContain("college.manage_roles");
    expect(DEFAULT_TYPE_PERMISSIONS.TRUSTEE).toContain("college.view_stats");
  });

  it("coordinator templates stay below College Head supremacy", () => {
    for (const t of SYSTEM_TEMPLATES) {
      if (t.name !== "College Head") expect(t.priority).toBeLessThan(1000);
    }
  });
});
