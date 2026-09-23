/** Public-API lookups for E2E entity ids (verification/navigation only). */

function apiURL(): string {
  const v = process.env.E2E_API_URL;
  if (!v) throw new Error("E2E_API_URL is required.");
  return v.replace(/\/+$/, "");
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${apiURL()}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

async function findByTitle(
  kind: "colleges" | "projects" | "clubs" | "events",
  title: string,
): Promise<number> {
  const key = kind === "colleges" ? "search" : kind === "projects" ? "search" : undefined;
  const query = key ? `?${key}=${encodeURIComponent(title)}` : "";
  const rows = (await get<Array<Record<string, unknown>>>(`/api/${kind}${query}`));
  const nameKey = kind === "colleges" || kind === "clubs" ? "name" : "title";
  const hit = rows.find((x) => String(x[nameKey]) === title);
  if (!hit) throw new Error(`E2E entity not found: ${kind} "${title}"`);
  return Number(hit.id);
}

export const findCollegeId = (name: string) => findByTitle("colleges", name);
export const findProjectId = (title: string) => findByTitle("projects", title);
export const findClubId = (name: string) => findByTitle("clubs", name);
export const findEventId = (title: string) => findByTitle("events", title);
