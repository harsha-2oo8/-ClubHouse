# Admin Setup & Verification (Clerk-based — no custom passwords)

Admins sign in through the **normal Clerk flow**. Authorization comes from
the database `users.role` column, enforced server-side by `requireAdmin`.

## First admin bootstrap (one time)

1. Set `ADMIN_EMAILS=<your-login-email>` on Render (or `ADMIN_CLERK_IDS`).
2. Sign up on the site and complete the 2-step onboarding.
   On profile creation the server grants `role="admin"` **once**.
3. Open `/admin` — the dashboard must load.
4. **Remove `ADMIN_EMAILS`/`ADMIN_CLERK_IDS`** and redeploy. From then on,
   the DB role is the only source of truth; the emailGate never runs again.

There is intentionally no `if (email === "...")` anywhere in the code
(grep-verified). Never add one back.

## Verify

From repo root (needs `DATABASE_URL`, `CLERK_SECRET_KEY`, and
`ADMIN_CLERK_ID` or `ADMIN_EMAIL` in env):

```
pnpm admin:verify
```

It reports (read-only, changes nothing, never prints secrets):
- Clerk user exists
- DB user exists
- DB role is `admin`
- `/api/healthz` + `/api/readyz` reachable
- `/api/admin/stats` returns 401 without a token (gate is mounted)
- With `ADMIN_SESSION_TOKEN` set: admin endpoint returns 200
- With `NORMAL_SESSION_TOKEN` set: admin endpoint returns 403 for students

Exit code is non-zero on any failure. Promoting further admins: an existing
admin changes `users.role` directly in Supabase Table Editor (audited
manually), or extend the admin users endpoint.

## Normal-student guarantees

- `/admin` screen redirects non-admins to `/dashboard`.
- All `/api/admin/*` routes use `requireAdmin` → 401 signed-out, 403 student.
- Moderators get per-college powers only — never platform admin.
