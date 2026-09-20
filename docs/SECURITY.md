# Security

## Authentication

Clerk only. Frontend `@clerk/react` (`VITE_CLERK_PUBLISHABLE_KEY`), backend `@clerk/express` `clerkMiddleware` (`CLERK_PUBLISHABLE_KEY`). No custom passwords/OTP. Private storage and all mutating routes require a valid session (401 otherwise).

## Admin bootstrap (env-only, first-boot)

No hardcoded admin identity exists in business logic. Set `ADMIN_EMAILS` and/or `ADMIN_CLERK_IDS` (comma-separated) for initial deployment. A matching user receives `role: "admin"` **only at first profile creation** (`PATCH /users/me` create path via `shouldBootstrapAdmin`). Later role changes come exclusively from the DB `users.role` column. Leave the vars empty afterwards. See `.env.example`.

## Authorization (server-side)

`src/lib/policy.ts` is the single place for access rules: `isAdmin`, `isCollegeMember/Moderator`, `isProjectMember/Owner`, `isClubOwner`, `canEditProject/canManageClub/canModerateCollege/canManageEvent`, plus middleware `requireProjectMember/Owner`, `requireCollegeModerator`, `requireClubOwner`. Frontend role-gating is UX only. Ownership/membership is always re-checked from the DB; client-supplied roles are never trusted.

## Storage

- `POST /storage/uploads/request-url` requires auth and is rate-limited; returns a 900s presigned PUT.
- `GET /storage/public-objects/*` is intentionally public; `..` rejected.
- `GET /storage/objects/*` requires auth, rejects `..`, and enforces object ACL metadata (403 on denial).

## Abuse controls

In-memory fixed-window rate limits (20 writes/min default, 60 searches/min) on users, colleges, projects, clubs, events, storage and admin write routes; 429 + `Retry-After` on excess. For multi-instance production, swap `src/lib/rateLimit.ts` for a shared store.

## Auditing & logging

Privileged admin actions (college/moderator approvals) write to `admin_audit_logs` with before/after snapshots; secret-like metadata keys are scrubbed. Pino redacts `authorization`/`cookie`/`set-cookie`. Health: `/api/healthz` (liveness), `/api/readyz` (DB readiness).

## Known limits (not yet done)

No SSE realtime yet (chat is REST), no cursor pagination envelopes (bounded `limit` only), no admin audit UI (table + recording exist), no email/push notifications (in-app service seam exists).
