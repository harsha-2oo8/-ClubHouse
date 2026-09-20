# Account Settings

## Account menu (avatar/name click)

Opens the application Account Center — desktop dropdown, mobile bottom
sheet. Never shows environment/debug labels (any "development mode" text
comes from Clerk itself when the instance uses test keys; fix = production
keys per PRODUCTION_SETUP.md §4).

Contents: header (avatar, name, role, own email) · View Profile ·
Edit Profile (deep-links `/profile/me?edit=1`) · Account & Security ·
Notifications · Appearance (Light/Dark/System) · Privacy (→ Settings) ·
Help & Support · Report a Problem · Admin Panel (admins only) · Sign Out.

## Logout

Account menu or Settings → Sign out. Uses Clerk `signOut()`, then purges
the TanStack Query cache (`queryClient.clear()`) so no private data
lingers, redirects to `/`, and toasts confirmation. No custom
cookie/password handling. Works on desktop and mobile.

## Account & Security

Opens Clerk's hosted UserProfile flow (change password, active sessions,
extra verification). Passwords never touch ClubHouse code or database.
Forgotten password: the "Forgot password?" link on the sign-in page
(Clerk secure email link). No custom reset system exists by design.

## Privacy (`/settings#privacy`)

- Email: always private (API strips it from public profiles; UI shows it
  only to yourself).
- Portfolio / social links: toggles backed by `users.showPortfolio` /
  `showSocials`, enforced in `GET /users/:userId` (emptied when off).
- Appearance: Light / Dark / System (next-themes).
- `/settings` also links profile, notifications, help and sign-out.
- `/help` documents product use, password/session help, safety + reporting.
