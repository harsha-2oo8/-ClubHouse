import { describe, expect, it, afterEach } from "vitest";
import {
  parseAdminList,
  shouldBootstrapAdmin,
} from "./adminBootstrap";

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_CLERK_IDS;
});

describe("parseAdminList", () => {
  it("returns [] for missing/blank input", () => {
    expect(parseAdminList(undefined)).toEqual([]);
    expect(parseAdminList("")).toEqual([]);
    expect(parseAdminList("  , ")).toEqual([]);
  });

  it("splits, trims and lowercases entries", () => {
    expect(parseAdminList("Admin@Example.com, user_123 ")).toEqual([
      "admin@example.com",
      "user_123",
    ]);
  });
});

describe("shouldBootstrapAdmin", () => {
  it("matches configured admin emails case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com";
    expect(
      shouldBootstrapAdmin({ email: "admin@example.com", clerkId: "user_x" }),
    ).toBe(true);
    expect(
      shouldBootstrapAdmin({ email: "someone-else@example.com", clerkId: "user_x" }),
    ).toBe(false);
  });

  it("matches configured admin clerk ids", () => {
    process.env.ADMIN_CLERK_IDS = "user_admin_1";
    expect(
      shouldBootstrapAdmin({ email: "a@b.c", clerkId: "USER_ADMIN_1" }),
    ).toBe(true);
    expect(
      shouldBootstrapAdmin({ email: "a@b.c", clerkId: "user_other" }),
    ).toBe(false);
  });

  it("grants nothing when no bootstrap env is set", () => {
    expect(
      shouldBootstrapAdmin({ email: "anyone@example.com", clerkId: "user_1" }),
    ).toBe(false);
  });
});
