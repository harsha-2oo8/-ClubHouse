import { describe, expect, it, vi } from "vitest";

// audit.ts pulls in @workspace/db (throws without DATABASE_URL), so stub first.
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
const { scrubMetadata } = await import("./audit");

describe("scrubMetadata", () => {
  it("returns null for missing metadata", () => {
    expect(scrubMetadata(undefined)).toBeNull();
  });

  it("drops secret-like keys and keeps the rest", () => {
    expect(
      scrubMetadata({
        reason: "spam",
        password: "x",
        apiKey: "y",
        sessionToken: "z",
        clerkSecret: "w",
        title: "My club",
      }),
    ).toEqual({ reason: "spam", title: "My club" });
  });
});
