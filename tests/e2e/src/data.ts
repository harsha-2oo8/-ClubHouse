/**
 * Isolated E2E identities. Everything the suite creates carries an E2E_
 * prefix so cleanup can never touch demo/prod content.
 */
export const E2E = {
  collegeAlpha: "E2E College Alpha",
  collegeBeta: "E2E College Beta",
  projectAlpha: "E2E Project Alpha",
  projectBeta: "E2E Project Beta",
  clubAlpha: "E2E Club Alpha",
  clubBeta: "E2E Club Beta",
  hackathonAlpha: "E2E Hackathon Alpha",
  workshopAlpha: "E2E Workshop Alpha",
  seminarAlpha: "E2E Seminar Alpha",
} as const;

/** Demo accounts mapped to E2E roles (see docs/E2E_TEST_ACCOUNTS.md). */
export const ROLES = {
  studentA: "student01@demo.clubhouse.app", // Aarav — project/club/event creator
  studentB: "student02@demo.clubhouse.app", // Diya — applicant, joiner, registrant
  studentC: "student03@demo.clubhouse.app", // Arjun — invitee, second member
  moderator: "student13@demo.clubhouse.app", // Karthik — promoted in-flow
  adminEmail: "harshavardhankalvir2808@gmail.com", // platform admin (own account)
} as const;

export function demoPassword(): string {
  const v = process.env.DEMO_USER_PASSWORD;
  // Only needed for negative/edge cases that type a password; journeys use tickets.
  return v ?? "";
}
