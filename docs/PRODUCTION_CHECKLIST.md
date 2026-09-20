# Production Checklist (pre-launch / post-deploy)

## Environment
- [ ] Supabase Session pooler URI in `DATABASE_URL` (never direct `db.*`)
- [ ] `CLERK_PUBLISHABLE_KEY=pk_live_…` (API) and
      `VITE_CLERK_PUBLISHABLE_KEY=pk_live_…` (Vercel) — same instance
- [ ] `CLERK_SECRET_KEY=sk_live_…` on Render only
- [ ] `CORS_ORIGINS=https://<vercel-app>` on Render
- [ ] `VITE_API_URL=https://<api>.onrender.com` on Vercel (then redeploy)
- [ ] `GCS_*` set if uploads are needed (else uploads 503 cleanly)
- [ ] `ADMIN_EMAILS` removed after first admin exists
- [ ] No `.env` committed; no secrets in chat/logs beyond rotation plan

## Data & code
- [ ] `pnpm db:migrate` applied (reports table, privacy flags)
- [ ] `pnpm run typecheck` green · tests pass · codegen in sync · builds pass
- [ ] `pnpm admin:verify` all PASS
- [ ] Demo content reviewed (`[Demo]` prefixes, no real people, no endorsement)

## Behavior (see SMOKE_TEST.md for the full run)
- [ ] No "development mode" in profile menu
- [ ] Logout purges data and redirects
- [ ] Creator deletes (project/club/event) with confirmations; 403s for others
- [ ] Reports resolve/dismiss; audit log records approvals + deletes
- [ ] Private storage denied without session; public assets load
- [ ] Mobile bottom nav + dialogs usable at 360 px
