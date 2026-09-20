# Testing

## Stack

Vitest (`@workspace/api-server`, `pnpm --filter @workspace/api-server run test`). No DB/Clerk needed for current unit tests.

## Coverage today (11 tests, all passing)

- `src/lib/params.test.ts` — `getParam` (string + Express 5 array + missing), `getIntParam`, `getLimit` clamping.
- `src/lib/adminBootstrap.test.ts` — allowlist parsing, email/clerkId matching, deny-by-default.

## Priority matrix (next)

1. Unauthorized user cannot modify protected resources.
2. College member cannot perform moderator actions; moderator cannot act on another college.
3. Project non-member cannot read/send chat; non-owner cannot delete project.
4. Non-owner cannot modify club; regular user cannot call admin endpoints.
5. Duplicate membership/registration/application rejected (unique constraints).
6. Private storage denied to unauthorized users.
7. Notifications emitted for approvals/invites/registrations.

Items 1–4 need Supertest + test DB + Clerk stubbing; item 5 is partially enforced at the DB layer (unique indexes added, app-level 409s exist for join flows).
