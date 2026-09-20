import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Apply committed SQL migrations from ./drizzle (journal-driven).
 *
 * Usage (repo root):  pnpm db:migrate
 * Requires DATABASE_URL (Supabase Session pooler URI).
 * Additive-only policy: never hand-edit applied migrations; add new ones.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);
await migrate(db, { migrationsFolder: "./drizzle" });
await pool.end();
console.log("Migrations applied.");
