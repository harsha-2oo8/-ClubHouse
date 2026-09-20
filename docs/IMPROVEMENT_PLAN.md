# ClubHouse — Improvement Plan (Baseline Audit)

Date: 2026-09-20
Scope: Phases 0–20. Status: Phases 0–4, 6–9 (part), 13–16 (part) implemented and verified. Realtime SSE, cursor envelopes, audit UI, matching deferred — see §7.

## 1. Current architecture

- pnpm workspaces (Node 24, TS 5.9, React 19.1, Vite 7, Express 5, PG16 + Drizzle, Clerk, Orval + Zod + TanStack Query, Tailwind v4 + shadcn).
- `artifacts/api-server` (Express, `/api`, port 8080) + `artifacts/clubhouse` (Vite SPA, dev 21903) + `artifacts/mockup-sandbox`.
- `lib/db/src/schema` = persistence truth (7 files, 17 tables). `lib/api-spec/openapi.yaml` (1871 lines, ~47 paths/64 ops) = HTTP truth → `lib/api-client-react` + `lib/api-zod` (never hand-edit).
- Auth: `@clerk/react` + `@clerk/express` + `/api/__clerk` proxy. `requireAuth/requireProfile/requireAdmin` in `middlewares/auth.ts`.
- Storage: GCS via Replit sidecar, presigned PUT 900s, public + private paths, ACL helpers mostly stubbed.
- No tests (`*.test.*`/`*.spec.*` = 0). No `.env*` files. `Clubhouse_Full_Documentation.pdf` untracked at root.

## 2. Baseline verification (2026-09-20)

- `pnpm install`: OK (593 pkgs; `preinstall` sh-script fails on Windows — pre-existing, non-blocking).
- `pnpm run typecheck`: FAILS in `@workspace/api-server` only. Frontend + scripts pass.
  - ~40x `req.params.X: string | string[]` not narrowed (Express 5 types) in `admin/colleges/events/notifications/projects/users` routes.
  - `users.ts:80` bad `clerkClient.default` import shape.
  - `objectStorage.ts:270` `response.json()` is `unknown` → `signed_url` access.
- `pnpm run build`: not yet green (blocked by typecheck).
- OpenAPI codegen sync: not verified yet (orval available).
- Git: clean except untracked PDF; 8 commits, latest "Published your App".

## 3. Detected issues

1. Hardcoded admin `harshavardhankalvir2808@gmail.com` in `routes/users.ts` (grants admin on every matching signup — must be env bootstrap only).
2. Duplicated/inline authz: role/ownership checks scattered across colleges/projects/clubs/events; no `requireCollegeModerator/ProjectMember/...` helpers; UI hiding ≠ authz; IDOR risk.
3. DB integrity: no unique constraints (college_members, project_members, project_applications, event_registrations, join_requests); no indexes on hot FKs (`college_id`, `project_id`, `clerk_id`, messages `(project_id, created_at/id)`); `users.college` TEXT duplicates `college_members`; `club_members` has only free-form `name` (no `clerkId`); `required_roles`/`partner_colleges` JSONB undocumented vs normalized tables.
4. Storage: `GET /storage/objects/*` serves private objects with NO auth (ACL block commented out); upload-URL minting has no size/type/rate checks; `filePath` join allows `..` traversal risk; content-type not validated.
5. Pagination: all list endpoints unbounded (`GET /projects`, `/colleges`, `/users/search`, notifications, members, applications, messages has `limit/before` only on one route). No cursor envelope.
6. Chat: no polling interval found in frontend (single fetch, manual refetch on send) — effectively no realtime; needs REST history + SSE/WS with auth + fallback.
7. Notifications: raw `db.insert` duplicated in admin/colleges/projects routes; no service layer; no email/push seam.
8. No rate limiting anywhere (search, messages, applications, uploads, admin).
9. No admin audit log table/UI.
10. No tests, no CI, no `.env.example`, no startup env validation beyond `DATABASE_URL`/keys throwing.
11. Observability: pino-http without request-ids; `/healthz` liveness only (no DB readiness); redaction minimal.
12. Frontend: `project.tsx` ~27k largest page (header/overview/members/roles/chat/calendar/applications/invite all inline); mobile drawer only, no bottom nav/FAB; `admin.tsx` unbounded lists.
13. Search: `ilike %q%` + in-memory filter in admin users; no trigram/GIN, no tech/role/college/status facets.
14. Typecheck debt (see §2) blocks CI.

## 4. Planned changes (ordered)

1. Fix typecheck blockers (param narrowing helper, clerk import, unknown JSON cast) — prerequisite.
2. Phase 1: env-based admin bootstrap (`ADMIN_EMAILS`/`ADMIN_CLERK_IDS`, first-boot only) + `lib/policy.ts` RBAC (`requireCollegeMember/Moderator`, `requireProjectMember/Owner`, `requireClubOwner`, `canEditProject/canManageClub/canModerateCollege/...`) + refactor routes + document.
3. Phase 2: unique constraints + indexes + `club_members.clerk_id` (nullable, backfill-safe) + keep `users.college` as display denorm (document, stop trusting for authz); keep JSONB for roles/partners with validation (no blind normalization).
4. Phase 3: storage ACL (`visibility: public|private|college|project|club`), authenticated private serve, traversal-safe normalization, upload validation + rate limit, keep public path working.
5. Phases 4–8: cursor pagination (`limit/cursor` + `{items,nextCursor,hasMore}` compat), notification service, per-route rate limits, `admin_audit_logs` + UI.
6. Phases 9–15: Vitest + Supertest authz matrix, trigram search + filters, ProjectPage split, mobile bottom-nav, request-ids + `/readyz`, CI with codegen-drift check, `.env.example` + startup validation.
7. Phases 16–17: docs (`ARCHITECTURE/SECURITY/DEVELOPMENT/TESTING`) + transparent matching (no opaque AI).
8. Phases 18–20: security + performance review, full verification.

## 5. Dependencies / risks / migration

- Order matters: RBAC → DB → storage → pagination/tests. OpenAPI changes always precede codegen → backend → frontend.
- Drizzle: project uses `push` (no migrations dir). Prefer additive, nullable/backfill-safe changes; document `pnpm --filter @workspace/db run push`.
- `users.college` removal is breaking → deferred; treat as display-only.
- Normalizing `required_roles`/`partner_colleges` is high-risk → keep JSONB + Zod validation.
- Storage auth enforcement may break existing private links → keep public path, gate private path, document.
- Realtime: SSE first (simpler than WS on Replit autoscale); polling fallback retained.
- No secrets in repo; admin bootstrap env-only.

## 6. Verification strategy

- After each stage: `pnpm run typecheck`, targeted `pnpm run build`, orval codegen + `git diff --exit-code` on generated dirs, new Vitest/Supertest authz tests (10 priority cases in spec), manual flow checklist (17 flows: signup → upload), grep for `harshavardhan...@gmail`, secrets scan, `/healthz` + `/readyz` checks.
- Done = code exists + types pass + tests pass + build passes + codegen synced + no regressions.

## 7. Implementation log (2026-09-20)

Implemented and verified (`pnpm run typecheck` green, 11 Vitest tests pass, orval codegen clean):
- Phase 1: removed hardcoded admin email → `ADMIN_EMAILS`/`ADMIN_CLERK_IDS` first-boot bootstrap (`lib/adminBootstrap.ts`); centralized RBAC (`lib/policy.ts`: member/moderator/owner helpers + middleware); fixed all Express 5 `req.params` type errors via `lib/params.ts`.
- Phase 2: unique constraints (college/project membership, applications scoped by status, event registrations), cascade deletes, indexes on hot FKs + message chronology + notifications; `club_members.clerk_id` nullable link added; `users.college` kept as display-only (documented, not used for authz); `required_roles`/`partner_colleges` JSONB kept with validation (no blind normalization).
- Phase 3: private storage now requires Clerk auth + ACL check, traversal guards on both object routes.
- Phase 4 (part): backward-compatible `?limit=` (clamped) on projects/colleges/events/users-search via OpenAPI + codegen + backend. No envelope change.
- Phase 6 (part): `notificationService` created and adopted in admin flows; other routes still insert directly (migration path documented).
- Phase 7: rate limits on all write routes + search + upload URL issuance (429 + Retry-After).
- Phase 8 (part): `admin_audit_logs` table + `recordAuditLog()` wired into college/moderator approval actions. No admin UI yet.
- Phase 9 (part): Vitest foundation, 11 unit tests green. Supertest authz matrix still open (needs test DB + Clerk stubs).
- Phase 11 (part): fixed pre-existing frontend type errors (Orval v8 hook arity, unknown→ReactNode, event visibility `college_only`); full `getParam` audit of API layer.
- Phase 13 (part): `/api/readyz` DB readiness probe.
- Phase 14: `.github/workflows/ci.yml` (install → typecheck → tests → codegen-drift check → build).
- Phase 15: `.env.example` with REQUIRED/OPTIONAL/PROD-ONLY markings.
- Phase 16: `docs/{ARCHITECTURE,SECURITY,DEVELOPMENT,TESTING}.md` created; this plan updated.
- Deferred (documented, not implemented): SSE realtime chat (Phase 5), cursor pagination envelopes, audit-log UI, trigram search facets (Phase 10), ProjectPage split + mobile bottom-nav (Phases 11–12), request-ids (pino-http default id retained), transparent matching (Phase 17). Phases 18–20 reviews partially covered by this pass; full matrix tests + prod migration run remain.
