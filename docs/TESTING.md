# Testing

## Stack

Vitest (`@workspace/api-server`, `pnpm --filter @workspace/api-server run test`). No DB/Clerk needed: DB-backed modules are stubbed (`DATABASE_URL` dummy) and Clerk auth is mocked.

## Coverage (28 tests, all passing)

- `params.test.ts` (6) — Express 5 param/query helpers, limit clamping.
- `adminBootstrap.test.ts` (5) — allowlist parsing/matching, deny-by-default.
- `config.test.ts` (7) — REQUIRED validation, CORS parsing, admin lists, GCS `\n` handling, test-key detection.
- `rateLimit.test.ts` (2) — under-cap passes, 429 + `Retry-After` shape.
- `audit.test.ts` (2) — secret scrubbing of audit metadata.
- `policy.test.ts` (1) — pure ownership predicate.
- `gcsStorage.test.ts` (5) — filename sanitize, object naming, traversal rejection, read matrix, path extraction.

## Priority matrix (next)

1. Unauthorized user cannot modify protected resources.
2. College member cannot perform moderator actions; moderator cannot act on another college.
3. Project non-member cannot read/send chat; non-owner cannot delete project.
4. Non-owner cannot modify club; regular user cannot call admin endpoints.
5. Duplicate membership/registration/application rejected (unique constraints).
6. Private storage denied to unauthorized users.
7. Notifications emitted for approvals/invites/registrations.

Items 1–4 need Supertest + test DB + Clerk stubbing; item 5 is partially enforced at the DB layer (unique indexes added, app-level 409s exist for join flows).
