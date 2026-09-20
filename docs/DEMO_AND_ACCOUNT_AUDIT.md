# Demo & Account Audit — ClubHouse (2026-09-20, pre-work)

## 1. Clerk / account surface (code truth)

| Area | State |
|---|---|
| Sign up/in | Clerk hosted components (`/sign-in`, `/sign-up`), email+password, no OTP. OK. |
| Profile menu | Custom `ProfileMenu` wrapping Clerk `UserButton` (Profile/Notifications/Manage links). No app-level account center. |
| Logout | **No app-level Sign Out exists.** Only inside Clerk's UserButton popover. No session cleanup, no query-cache clear, no redirect control. |
| Password reset/change/sessions | **No UI.** Clerk's `UserProfile` (passwords, sessions, MFA) is never opened (`openUserProfile` unused). Forgotten-password happens on Clerk's own sign-in page only. |
| Privacy controls | Email hidden from public profiles (API+UI, last session). **No user-facing toggles** for portfolio/socials; no settings page. |
| Appearance | Light/dark toggle only; **no System option**. |
| `openUserProfile` / `signOut` / session APIs | Unused anywhere. |
| "Development mode" badge | Still Clerk dev instance (`pk_test_`). Code is clean (warnings added last session); the fix remains rotating to `pk_live_`/`sk_live_` + domains (Clerk Dashboard action). |

## 2. Demo/seed capability

**None exists.** No seed scripts, no `seed:*` commands, no demo users, no fixtures. DB rows today are real user-created content only. Supabase has 19 tables (18 + reports); `reports` migration unapplied in prod (needs `pnpm db:migrate`).

## 3. Content inventory (live potential, all empty in prod today)

Projects/clubs/events/hackathons/etc. all render from live queries with
loading/empty states — seeding will populate them without code changes.
No sorting by popularity exists (do NOT invent it); lists are chronological.

## 4. Deletes/RBAC/admin (already done, verified)

`canDelete*` server policies, DELETE routes + OpenAPI + dialogs, admin
override + audit, reports + audit UI, `pnpm admin:verify`. Not rebuilt here.

## 5. Plan (this session)

1. Account Center: `AccountMenu` (desktop dropdown + mobile sheet) with the
   specified structure; Clerk `signOut` + query purge + redirect; Account &
   Security via Clerk `openUserProfile()` (passwords/sessions/MFA hosted);
   Appearance Light/Dark/System; Privacy section; Help/Report entries.
2. Privacy flags: `showPortfolio`/`showSocials` on users (+ migration 0002),
   PATCH whitelist, public-profile enforcement, profile edit UI, settings page.
3. Seed: `scripts/src/seed/{data.ts, run.ts, reset.ts}` + `seed:demo` /
   `seed:demo:reset` commands; 25 fictional students, 13 real-name Bengaluru
   colleges (listings only, no endorsement implied), 16 `[Demo]` projects,
   12 `[Demo]` clubs, 20 global events (6H/8W/6S), club events, memberships,
   applications (mixed states), notifications. Idempotent (natural-key
   upserts). Optional `--with-clerk` creation via Backend API + env password
   (documented, never committed).
4. Docs: DEMO_ACCOUNTS, DEMO_DATA, ACCOUNT_SETTINGS (+ ADMIN_SETUP touch,
   PRODUCTION_CHECKLIST).
5. Features if budget: bookmarks (small), matching-lite (medium).
6. Tests: seed builders, privacy enforcement shape, bookmark toggle logic.
7. Verify: typecheck, tests, codegen, builds, push. Smoke run stays manual
   (needs browsers + live keys).
