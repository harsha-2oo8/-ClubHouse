import { describe, expect, it } from "vitest";
import {
  buildObjectName,
  canReadObject,
  normalizeObjectName,
  objectNameFromPath,
  sanitizeFileName,
} from "./gcsStorage";

describe("sanitizeFileName", () => {
  it("strips directories and unsafe chars", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("my logo @2x!.png")).toBe("my-logo-2x-.png");
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("buildObjectName", () => {
  it("embeds visibility + uploader and sanitizes", () => {
    const name = buildObjectName({ visibility: "private", uploaderId: "user_1", fileName: "a b.png" });
    expect(name.startsWith("private/user_1/")).toBe(true);
    expect(name.endsWith("-a-b.png")).toBe(true);
  });
});

describe("normalizeObjectName", () => {
  it("accepts public/private paths and rejects traversal", () => {
    expect(normalizeObjectName("public/user_1/x.png")).toBe("public/user_1/x.png");
    expect(normalizeObjectName("/private/user_1/x.png")).toBe("private/user_1/x.png");
    expect(() => normalizeObjectName("../secret")).toThrow();
    expect(() => normalizeObjectName("other/x.png")).toThrow();
    expect(() => normalizeObjectName("")).toThrow();
  });
});

describe("canReadObject", () => {
  it("opens public to everyone, restricts private to owner/admin", () => {
    expect(canReadObject("public/u1/x.png", null, false)).toBe(true);
    expect(canReadObject("private/u1/x.png", null, false)).toBe(false);
    expect(canReadObject("private/u1/x.png", "u1", false)).toBe(true);
    expect(canReadObject("private/u1/x.png", "u2", false)).toBe(false);
    expect(canReadObject("private/u1/x.png", "u2", true)).toBe(true);
  });
});

describe("objectNameFromPath", () => {
  it("extracts /gcs/ names and rejects others", () => {
    expect(objectNameFromPath("/gcs/public/u1/x.png")).toBe("public/u1/x.png");
    expect(objectNameFromPath("/objects/abc")).toBeNull();
    expect(objectNameFromPath(null)).toBeNull();
  });
});
