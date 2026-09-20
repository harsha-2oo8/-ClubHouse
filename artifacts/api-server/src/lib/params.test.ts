import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getParam, getIntParam, getLimit } from "./params";

function req(params: Record<string, unknown> = {}, query: Record<string, unknown> = {}): Request {
  return { params, query } as unknown as Request;
}

describe("getParam", () => {
  it("returns plain string params", () => {
    expect(getParam(req({ id: "12" }), "id")).toBe("12");
  });

  it("takes the first value of array params (Express 5)", () => {
    expect(getParam(req({ id: ["7", "8"] }), "id")).toBe("7");
  });

  it("returns empty string for missing params", () => {
    expect(getParam(req({}), "id")).toBe("");
  });
});

describe("getIntParam", () => {
  it("parses integers and rejects garbage", () => {
    expect(getIntParam(req({ id: "42" }), "id")).toBe(42);
    expect(getIntParam(req({}), "id")).toBeNull();
    expect(getIntParam(req({ id: "abc" }), "id")).toBeNull();
  });
});

describe("getLimit", () => {
  it("defaults when absent or invalid", () => {
    expect(getLimit(req())).toBe(50);
    expect(getLimit(req({}, { limit: "abc" }))).toBe(50);
  });

  it("clamps to [1, max]", () => {
    expect(getLimit(req({}, { limit: "5" }))).toBe(5);
    expect(getLimit(req({}, { limit: "0" }))).toBe(1);
    expect(getLimit(req({}, { limit: "9999" }))).toBe(100);
    expect(getLimit(req({}, { limit: "3" }), 8, 50)).toBe(3);
    expect(getLimit(req({}, { limit: "9999" }), 8, 50)).toBe(50);
  });
});
