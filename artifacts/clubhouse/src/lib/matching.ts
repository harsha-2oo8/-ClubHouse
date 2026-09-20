/**
 * Transparent project matching (no black boxes).
 *
 * Scores open projects against declared profile text (course + bio +
 * college) using token overlap with the project's tech stack and required
 * roles, plus same-college affinity. Every suggestion carries its reasons,
 * rendered verbatim in the UI ("Matched because: …").
 *
 * Nothing is inferred beyond what the user wrote and what the project
 * declares. No skills are fabricated.
 */

export interface MatchableProject {
  id: unknown;
  title: unknown;
  techStack?: unknown;
  requiredRoles?: unknown;
  collegeName?: unknown;
  openForApplications?: unknown;
  ownerId?: unknown;
}

export interface MatchableProfile {
  course?: unknown;
  bio?: unknown;
  college?: unknown;
}

export interface ProjectMatch {
  project: MatchableProject;
  score: number;
  reasons: string[];
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length >= 3),
  );
}

function roleNames(requiredRoles: unknown): string[] {
  if (!Array.isArray(requiredRoles)) return [];
  return requiredRoles
    .map((r) => (r && typeof r === "object" ? String((r as { role?: unknown }).role ?? "") : ""))
    .filter(Boolean);
}

/** Pure: explain why a project matches a profile (empty = no match). */
export function matchReasons(project: MatchableProject, profile: MatchableProfile): string[] {
  const reasons: string[] = [];
  const haystack = tokens(`${String(profile.course ?? "")} ${String(profile.bio ?? "")}`);

  const tech = String(project.techStack ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const techHits = tech.filter((t) => {
    const parts = t.split(/[^a-z0-9+#]+/).filter((p) => p.length >= 3);
    return parts.some((p) => haystack.has(p));
  });
  if (techHits.length > 0) {
    reasons.push(`Matches your background: ${techHits.slice(0, 3).join(", ")}`);
  }

  const roles = roleNames(project.requiredRoles);
  if (roles.length > 0) {
    reasons.push(`Needs: ${roles.slice(0, 3).join(", ")}`);
  }

  const sameCollege =
    project.collegeName &&
    profile.college &&
    String(project.collegeName).toLowerCase() === String(profile.college).toLowerCase();
  if (sameCollege) {
    reasons.push(`Same college: ${String(project.collegeName)}`);
  }

  return reasons;
}

/** Pure: top-N open projects for a user (excludes their own), with reasons. */
export function recommendProjects(
  projects: MatchableProject[],
  profile: MatchableProfile,
  userId: string | null,
  limit = 3,
): ProjectMatch[] {
  return projects
    .filter((p) => p.openForApplications === true && (!userId || p.ownerId !== userId))
    .map((project) => {
      const reasons = matchReasons(project, profile);
      if (project.openForApplications === true) reasons.push("Accepting applications");
      return { project, score: reasons.length, reasons };
    })
    .filter((m) => m.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
