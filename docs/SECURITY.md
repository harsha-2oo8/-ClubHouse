# Security (production)

## Authentication — Clerk only, production instance required

- Web: `@clerk/react` + `VITE_CLERK_PUBLISHABLE_KEY`. API: `@clerk/express`
  `clerkMiddleware` + `CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY`.
- Split-origin auth: cookies never cross Vercel→Render, so the SPA attaches
  `Authorization: Bearer <session JWT>` on every API and upload call
  (`ClerkTokenBridge`); the API verifies it server-side. `sk_` stays
  server-side — never `VITE_`.
- **"Development mode" badge = development Clerk instance.** Fix is
  operational: production instance (`pk_live_`/`sk_live_`), domains added,
  env rotated (see PRODUCTION_SETUP.md §4). The app warns at startup
  (backend log / browser console) when test keys meet production builds.

## Admin

Env-only first-boot bootstrap (`ADMIN_EMAILS`/`ADMIN_CLERK_IDS`, once,
then remove). Afterwards `users.role` is the only truth, enforced by
`requireAdmin` (401 signed-out, 403 student). No hardcoded identities
(grep-verified). Verify with `pnpm admin:verify`.

## Authorization (server-side, `src/lib/policy.ts`)

Ownership re-checked from the DB on every call; client roles/IDs untrusted.
Creator-or-admin deletes (`canDeleteProject/Club/Event/...`); moderators
never delete others' resources; college/event scoping verified by ID match
(club-event ↔ club, project-event ↔ project). Reports resolve admin-only.

## Network

- CORS: explicit `CORS_ORIGINS` allowlist; reflect fallback logs loudly in
  prod; `*` never used with credentialed auth. Localhost allowed only in dev.
- Helmet on (CSP off: `/api/__clerk` proxies Clerk assets — documented
  exception), `X-Request-ID` on every response, pino request logging with
  `authorization`/`cookie`/`set-cookie` redaction. Never logged: secrets,
  tokens, GCS keys, passwords, full profiles.

## Storage

GCS service-account flow (STORAGE.md). Signed PUTs (15 min, authed,
validated, rate-limited). `public/*` open, `private/*` owner-or-admin.
Traversal/enumeration blocked; deletes best-effort on resource removal.

## Abuse & integrity

Rate limits (tunable via `RATE_LIMIT_*`): 20 writes/min, 60 searches/min,
429 + `Retry-After`; single-instance in-memory (Redis seam documented).
Unique constraints block duplicate memberships/registrations/applications;
409s on re-submit. Strict validation on mutations (IDs, enums, dates,
capacity); creator/`createdBy`/roles always server-assigned, never trusted
from the client — self-admin impossible.

## Privacy

Public profile omits email (API + UI). Search (authed) keeps contact info
for invites. Admin user lists stay admin-only. Audit logs scrub secrets.

## Audit & monitoring

`admin_audit_logs` for approvals, role changes, deletes, report
resolutions (+ `/admin/audit` UI). `/api/healthz` (liveness),
`/api/readyz` (DB). CI gates typecheck, tests, codegen drift, build.

## Residual risks (accepted, documented)

No WAF/bot protection; in-memory limiter per instance; no PII encryption
beyond Postgres defaults; session security delegated to Clerk; realtime
chat still polling; backups = Supabase daily (verify restores yourself).
