# Demo Accounts (25 fictional students)

All demo people are **fictional**: invented names, `student01…student25`
`@demo.clubhouse.app` emails (a reserved domain that routes nowhere).
Nothing here represents a real person.

## Two modes

**A. Browse-only demo (default, no Clerk involved)**
`pnpm seed:demo` creates database rows with placeholder ids
(`demo_student_01…`). Profiles, projects, clubs and events are browsable;
login as these users is impossible. Zero secrets required.

**B. Full login demo (`--with-clerk`)**
Creates real Clerk users via the Backend API, then links the same DB rows:
```
CLERK_SECRET_KEY=sk_... DEMO_USER_PASSWORD='<12+ chars, unique>' \
DATABASE_URL='<pooler-uri>' pnpm seed:demo --with-clerk
```
- Refuses without both secrets; the password is never committed, logged or
  returned by any endpoint.
- Re-running upgrades placeholder ids to real Clerk ids (no duplicates);
  existing Clerk emails resolve instead of failing.
- After creation: if your instance requires email verification, verify once
  (emailed link or Clerk Dashboard → user → Verified) or logins will fail.
- Rotate `DEMO_USER_PASSWORD` when the demo ends; delete users in Clerk
  Dashboard if they must disappear entirely.

## Reset

`pnpm seed:demo:reset` deletes **only** demo rows (demo users, `[Demo]`
content, seeded colleges without non-demo members). Guards:
`DEMO_RESET_CONFIRM=yes` required; refuses on `NODE_ENV=production`
unless `DEMO_ALLOW_PROD_RESET=yes`. Colleges with real members are kept
and reported.

## Admin + demo

Seeded colleges arrive `approved`; 3 moderator applications + 2 join
requests + 1 open report are pending so `/admin` has work to do. Make a
demo user admin only by promoting `users.role` directly in Supabase —
demo accounts can never self-promote (role is server-assigned).
