# Production Smoke Test

Run against the **deployed** Vercel + Render + Supabase stack after every
release. Stop at the first failure; fix, redeploy, restart from the top.
`[A]` = needs a second (student) account + an admin account.

## API (curl)

- `GET /api/healthz` → 200 `{"status":"ok"}`
- `GET /api/readyz` → 200 (DB link)
- `GET /api/admin/stats` (no token) → 401
- `GET /api/projects?limit=200` → clamped to 100 items max

## Web flows

1. Landing loads, no console errors, no "development mode" anywhere.
2. Sign up → onboarding (2 steps) → dashboard with stats.
3. Profile menu: My profile, Notifications, Manage account, Sign out.
4. Discover projects → search/filter → create project → edit → delete
   (typed DELETE) → gone from discovery.
5. Apply to a project [A] → owner approves → member sees chat → send chat.
6. Invite user by search → member added + notified.
7. Discover colleges → join request → moderator/admin approves → member.
8. Register a college → appears after admin approval in `/admin`.
9. Clubs → register (no files) → team add/remove → create event →
   delete event (confirm) → delete club (typed DELETE) → gone.
10. Events → create (all types) → edit → register → delete (registrants
    notified) → gone.
11. Report a project/club/event/profile → resolve + dismiss in `/admin`
    Reports tab.
12. Notifications arrive for: invite, application, approval, join approval,
    meeting, registration, project deletion, event cancellation.
13. `/my` shows owned projects/clubs/events.
14. Mobile (≤768 px): bottom nav works; chat, forms, dialogs usable.
15. `/admin`: stats incl. clubs + open reports; colleges, moderators,
    reports, audit-log tabs; audit entries appear for approvals + deletes.
16. Uploads (only with `GCS_*` configured): logo/brochure/banner upload
    and render; without `GCS_*`: clean 503, no crash.
17. Sign out → protected pages redirect; student token on `/api/admin/*`
    → 403.

## Admin verification

`pnpm admin:verify` — all PASS (see ADMIN_SETUP.md).
