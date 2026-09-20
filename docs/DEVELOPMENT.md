# Development

## Prereqs

Node.js 24, pnpm 10, PostgreSQL 16, Clerk keys. Copy `.env.example` to `.env` and fill values (never commit `.env`).

## Commands

- `pnpm install` — install all workspaces (on Windows use `pnpm install --ignore-scripts`; the root `preinstall` uses `sh`).
- `pnpm --filter @workspace/api-server run dev` — API on 8080.
- `pnpm --filter @workspace/clubhouse run dev` — Vite dev server (no required env; `BASE_PATH` env overrides the base path, default `/`).
- `pnpm --filter @workspace/clubhouse run build` — outputs to `artifacts/clubhouse/dist` (wired in `vercel.json`).
- `pnpm run typecheck` — libs + all artifacts/scripts (must be green).
- `pnpm run build` — typecheck + build everything.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query hooks + Zod from `openapi.yaml` (run after every spec change; CI fails on drift).
- `pnpm --filter @workspace/db run push` — push Drizzle schema (dev only; additive changes preferred).
- `pnpm --filter @workspace/api-server run test` — Vitest unit tests.

## Change workflows

- API: `openapi.yaml` → codegen → backend → frontend → tests. Never hand-edit `lib/api-client-react/src/generated` or `lib/api-zod/src/generated`.
- DB: schema → push → backend → API → frontend → tests. IDs use `generatedAlwaysAsIdentity()` — never include `id` in insert `.omit({})`.
- Permissions: `policy.ts` → middleware → route → UI → tests.

## Deployment config in repo

- `vercel.json` — frontend build (`pnpm --filter @workspace/clubhouse run build` → `artifacts/clubhouse/dist`) + SPA fallback rewrite. Set `VITE_API_URL` (Render API origin, no trailing slash) and `VITE_CLERK_PUBLISHABLE_KEY` in Vercel env.
- `render.yaml` — API blueprint (build/start, `/api/healthz`, Node 24). Fill `DATABASE_URL`, `CLERK_*`, `ADMIN_EMAILS` in Render dashboard.
- `railway.json` — legacy Railway API config (kept for reference).
- The web client points at the API via `VITE_API_URL` (`setBaseUrl` in `main.tsx`); same-origin `/api` also works wherever frontend and API share a host.

## Gotchas

- Express 5 types `req.params` as `string | string[]` — use `getParam()`/`getIntParam()` from `src/lib/params.ts`.
- Clerk `routerPush`/`routerReplace` must strip the Vite base path (see `App.tsx`).
- Never define a local SVG with the same name as an imported Lucide icon (Babel duplicate declaration).
- `users.college` is display-only denormalized text; authorization uses `college_members`.
