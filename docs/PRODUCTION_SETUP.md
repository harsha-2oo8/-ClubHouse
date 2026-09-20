# Production Setup — Vercel + Render + Supabase + Clerk + GCS

Deploy order matters: **Supabase → Render → Vercel → Clerk → verify**.
`VITE_*` values bake into the frontend bundle — set them before deploying,
and redeploy after changing them.

## 1. Supabase (PostgreSQL 16)

1. Create project → save the database password → region near your users.
2. Settings → Database → copy the **Session pooler** URI (port 5432).
   The direct `db.*` host is **IPv6-only** and unreachable from Render —
   always use the pooler in `DATABASE_URL`.
3. Create tables (from repo root, Windows PowerShell):
   `$env:DATABASE_URL='<pooler-uri>'; pnpm db:migrate; Remove-Variable DATABASE_URL`
   (`db:migrate` applies committed `lib/db/drizzle/*.sql`. For local schema
   iteration use `pnpm --filter @workspace/db run push`.)
4. Table Editor should show 19 tables (18 + `reports`).

## 2. Render (API)

Use the repo `render.yaml` Blueprint (Node 24, health check `/api/healthz`),
or configure a Web Service manually:
- Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- Start: `pnpm --filter @workspace/api-server run start` (`PORT` is provided)
- Env: `DATABASE_URL` (pooler), `CLERK_PUBLISHABLE_KEY` (`pk_live_…`),
  `CLERK_SECRET_KEY` (`sk_live_…`), `ADMIN_EMAILS` (temporary, §ADMIN_SETUP),
  `CORS_ORIGINS=https://<your-app>.vercel.app`, `NODE_ENV=production`,
  `LOG_LEVEL=info`, plus `GCS_*` (see STORAGE.md).
- Verify: `/api/healthz` → `{"status":"ok"}`, `/api/readyz` → ok (DB link).

Free tier sleeps after ~15 min idle (first call ~60 s). No `PORT` override.

## 3. Vercel (frontend)

Import the repo; `vercel.json` already sets build
(`pnpm --filter @workspace/clubhouse run build`) and output
(`artifacts/clubhouse/dist`) plus the SPA fallback rewrite.
Set Production env: `VITE_API_URL=https://<api>.onrender.com` (no trailing
slash), `VITE_CLERK_PUBLISHABLE_KEY=pk_live_…`. Deploy.

## 4. Clerk (production instance — REQUIRED for "development mode" fix)

Code cannot create this; do it in Clerk Dashboard:
1. Switch the application to (or create) a **production instance**.
2. Copy `pk_live_…` → Vercel `VITE_CLERK_PUBLISHABLE_KEY` (+ redeploy).
3. Copy `pk_live_…` + `sk_live_…` → Render `CLERK_PUBLISHABLE_KEY` /
   `CLERK_SECRET_KEY` (+ redeploy). Never put `sk_` in `VITE_*`.
4. Add the Vercel domain to allowed origins + sign-in/sign-up redirect URLs.
5. Open the site → profile menu must NOT show "development mode".
   If it still does, the app is still reading a `pk_test_` key — check env.

## 5. GCS uploads

See STORAGE.md. Without `GCS_*`, uploads return 503 (clear message);
everything else works.

## Rollback

Vercel/Render: redeploy the previous successful deployment (one click).
Database: migrations are additive; restore Supabase from its daily backup
for anything destructive (nothing in this app deletes DB rows except
creator/admin deletes, which are audit-logged).
