import { describe, expect, it } from "vitest";
import {
  DEMO_CLUBS,
  DEMO_CLUB_EVENTS,
  DEMO_COLLEGES,
  DEMO_EVENTS,
  DEMO_PROJECTS,
  buildStudents,
  demoClerkId,
  demoEmail,
  portfolioFor,
  socialsFor,
} from "./data";

describe("demo dataset", () => {
  it("has 25 unique fictional students with demo identities", () => {
    const students = buildStudents();
    expect(students).toHaveLength(25);
    expect(new Set(students.map((s) => s.email)).size).toBe(25);
    expect(new Set(students.map((s) => s.clerkId)).size).toBe(25);
    for (const s of students) {
      expect(s.email).toBe(demoEmail(s.index));
      expect(s.email.endsWith("@demo.clubhouse.app")).toBe(true);
      expect(s.clerkId).toBe(demoClerkId(s.index));
      expect(s.age).toBeGreaterThanOrEqual(17);
      expect(s.age).toBeLessThanOrEqual(24);
      expect(s.semester).toBeGreaterThanOrEqual(1);
      expect(s.semester).toBeLessThanOrEqual(8);
      expect(DEMO_COLLEGES.map((c) => c.name)).toContain(s.college);
      expect(s.interests.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("spreads students across colleges and branches", () => {
    const students = buildStudents();
    const colleges = new Set(students.map((s) => s.college));
    expect(colleges.size).toBeGreaterThanOrEqual(10);
    const courses = new Set(students.map((s) => s.course));
    expect(courses.size).toBeGreaterThanOrEqual(8);
  });

  it("builds portfolio and socials deterministically", () => {
    const [a] = buildStudents();
    expect(portfolioFor(a)).toHaveLength(2);
    expect(portfolioFor(a)[0].url).toContain("github.com");
    expect(socialsFor(a).github).toContain("github.com");
    // Deterministic: same input, same output.
    expect(portfolioFor(a)).toEqual(portfolioFor({ ...a }));
  });

  it("has 13 real-name colleges with locations", () => {
    expect(DEMO_COLLEGES).toHaveLength(13);
    for (const c of DEMO_COLLEGES) {
      expect(c.location).toMatch(/Bengaluru/);
      expect(c.website.startsWith("https://")).toBe(true);
    }
  });

  it("has 16 [Demo] projects with mixed states and applications", () => {
    expect(DEMO_PROJECTS).toHaveLength(16);
    const statuses = new Set(DEMO_PROJECTS.map((p) => p.status));
    expect(statuses.has("active")).toBe(true);
    expect(statuses.has("planning")).toBe(true);
    const open = DEMO_PROJECTS.filter((p) => p.openForApplications);
    expect(open.length).toBeGreaterThanOrEqual(6);
    const appStatuses = new Set(DEMO_PROJECTS.flatMap((p) => p.applications.map(([, s]) => s)));
    expect(appStatuses.has("pending")).toBe(true);
    expect(appStatuses.has("accepted")).toBe(true);
    expect(appStatuses.has("rejected")).toBe(true);
    for (const p of DEMO_PROJECTS) {
      expect(p.title.startsWith("[Demo]")).toBe(true);
      expect(p.memberIndexes).toContain(p.ownerIndex);
    }
  });

  it("has 12 [Demo] clubs and 20 typed events (6H/8W/6S)", () => {
    expect(DEMO_CLUBS).toHaveLength(12);
    for (const c of DEMO_CLUBS) expect(c.name.startsWith("[Demo]")).toBe(true);
    expect(DEMO_EVENTS).toHaveLength(20);
    const byType = (t: string) => DEMO_EVENTS.filter((e) => e.type === t).length;
    expect(byType("hackathon")).toBe(6);
    expect(byType("workshop")).toBe(8);
    expect(byType("seminar")).toBe(6);
    for (const e of DEMO_EVENTS) {
      expect(e.title.startsWith("[Demo]")).toBe(true);
      expect(e.startInDays).toBeGreaterThan(0);
    }
    expect(DEMO_CLUB_EVENTS.length).toBeGreaterThanOrEqual(10);
  });

  it("references only valid student indexes", () => {
    const valid = new Set(buildStudents().map((s) => s.index));
    for (const p of DEMO_PROJECTS) {
      expect(valid.has(p.ownerIndex)).toBe(true);
      for (const m of p.memberIndexes) expect(valid.has(m)).toBe(true);
      for (const [a] of p.applications) expect(valid.has(a)).toBe(true);
    }
    for (const c of DEMO_CLUBS) expect(valid.has(c.ownerIndex)).toBe(true);
    for (const e of DEMO_EVENTS) {
      expect(valid.has(e.creatorIndex)).toBe(true);
      for (const r of e.registrantIndexes) expect(valid.has(r)).toBe(true);
    }
  });
});
