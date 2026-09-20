# Architecture

## Monorepo layout

- `artifacts/api-server` — Express 5 JSON API, mounted at `/api`, port 8080.
  - `src/app.ts` — middleware pipeline (pino-http → Clerk proxy → CORS → JSON → clerkMiddleware → router).
  - `src/routes/` — one router per domain: health, users, colleges, clubs, projects, events, notifications, dashboard, admin, storage.
  - `src/lib/` — cross-cutting modules: `logger` (pino), `params` (Express 5 param/query helpers), `adminBootstrap` (env allowlist), `policy` (RBAC), `notify` (notification service), `rateLimit` (in-memory fixed window), `audit` (admin audit log), `objectStorage`/`objectAcl` (GCS).
  - `src/middlewares/` — `auth` (`requireAuth/requireProfile/requireAdmin`), `clerkProxyMiddleware`.
- `artifacts/clubhouse` — React 19 + Vite 7 SPA (`src/pages/*`, `src/components/*`, wouter routing, TanStack Query only via generated hooks).
- `artifacts/mockup-sandbox` — isolated UI experiments, not shipped.
- `lib/db` — Drizzle schema (source of truth for persistence) + `pg` pool. Sync via `pnpm --filter @workspace/db run push` (dev).
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 source of truth for HTTP. Change here first, then `pnpm --filter @workspace/api-spec run codegen`.
- `lib/api-client-react` / `lib/api-zod` — Orval-generated (never hand-edit).
- `lib/object-storage-web` — Uppy uploader components.
- `scripts/` — one-off tooling.

## Request lifecycle

`CORS → Clerk proxy (/api/__clerk) → express.json → clerkMiddleware → /api router → requireAuth/... → policy check → handler → Drizzle`.

## Data model (17 tables + audit)

users → college_members → colleges; projects + project_members/applications/messages/events; clubs + club_members (free-form display + optional `clerkId` link); club_events + event_registrations; notifications; admin_audit_logs. Uniqueness enforced on membership/registration/application tuples; indexes on hot FKs and message chronology.

## Realtime (planned)

Chat history over REST today. Target: REST for history/send + SSE stream per project with Clerk-ticket auth, membership check, polling fallback retained.
