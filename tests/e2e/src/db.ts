import pg from "pg";

/** Read-only verification helper. NEVER writes outside cleanup.ts. */
export function pool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for E2E verification/cleanup.");
  return new pg.Pool({ connectionString: url });
}

export async function count(table: string, where = "", params: unknown[] = []): Promise<number> {
  const p = pool();
  try {
    const r = await p.query(`SELECT COUNT(*)::int AS n FROM ${table} ${where}`, params as unknown[]);
    return r.rows[0].n as number;
  } finally {
    await p.end();
  }
}
