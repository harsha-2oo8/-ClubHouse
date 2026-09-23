# E2E Test Accounts

Suite: `tests/e2e` (Playwright, real Edge). journeys sign in via Clerk
**sign-in tickets** minted with `CLERK_SECRET_KEY` (setup ceremony only —
every business action goes through the real UI).

## Role mapping (all pre-existing demo accounts)

| E2E role | Email | Name | Purpose |
|---|---|---|---|
| studentA (creator/owner) | student01@demo.clubhouse.app | Aarav Sharma | Creates E2E colleges/projects/clubs/events; approves as auto-moderator |
| studentB (member) | student02@demo.clubhouse.app | Diya Patel | Joins, applies, registers, chats |
| studentC (invitee) | student03@demo.clubhouse.app | Arjun Reddy | Invited, second member |
| moderator (C promoted) | student13@demo.clubhouse.app | Karthik Menon | Applies → admin approves → moderates E2E Alpha |
| admin | harshavardhankalvir2808@gmail.com | (own account) | Approvals, stats, audit |

Throwaway onboarding user: `e2e_<ts>@demo.clubhouse.app` created via
Clerk API in-test (needs `DEMO_USER_PASSWORD`), deleted afterwards
(Clerk + DB row).

## Required env (runtime only, never committed)

- `E2E_BASE_URL` — Vercel frontend origin
- `E2E_API_URL` — Render API origin
- `CLERK_SECRET_KEY` — ticket minting (setup only)
- `DATABASE_URL` — verification reads + guarded `E2E_*` cleanup
- `DEMO_USER_PASSWORD` — throwaway-user creation only

## Safety

Specs create ONLY `E2E_*`-prefixed rows. Cleanup (`src/cleanup.ts`,
`E2E_CLEANUP_CONFIRM=yes`, refuses prod without `E2E_ALLOW_PROD=yes`)
deletes only those rows; colleges with non-demo members are kept.
