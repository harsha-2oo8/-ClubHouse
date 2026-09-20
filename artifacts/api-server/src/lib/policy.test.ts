import { describe, expect, it, vi } from "vitest";

// policy.ts pulls in @workspace/db (throws without DATABASE_URL), so stub first.
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
const { isCreator } = await import("./policy");

describe("isCreator", () => {
  it("matches identical ids only", () => {
    expect(isCreator("user_1", "user_1")).toBe(true);
    expect(isCreator("user_1", "user_2")).toBe(false);
    expect(isCreator("user_1", null)).toBe(false);
    expect(isCreator("user_1", undefined)).toBe(false);
    expect(isCreator("user_1", "")).toBe(false);
  });
});
