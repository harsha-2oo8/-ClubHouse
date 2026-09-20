# Demo Data

Seeded with `pnpm seed:demo` (idempotent — safe to re-run). Builders live
in `scripts/src/seed/data.ts` and are unit-tested (counts, distributions,
referential integrity of indexes).

## What gets seeded

| Content | Count | Notes |
|---|---|---|
| Colleges | 13 | Real Bengaluru institutions (BMS, BNMIT, CMRIT, …). **Listings only** — no endorsement, partnership or official status implied. Never invent college contact info. |
| Students | 25 | Fictional names + `@demo.clubhouse.app`; CSE/ISE/ECE/EEE/Mech/AI&ML/AI&DS/DS/Cyber/IT across semesters 1–8; bios, interests, portfolios, socials. |
| Projects | 16 | `[Demo]`-prefixed; mixed planning/active/completed; 8+ open with required roles; believable teams. |
| Applications | ~24 | Mixed pending/accepted/rejected (accepted ones also gain membership, mirroring the API). |
| Clubs | 12 | `[Demo]`-prefixed, with team members linked to demo students where names match. |
| Club events | 12 | Weekly-style sessions, future dates relative to seed run. |
| Global events | 20 | 6 hackathons, 8 workshops, 6 seminars; future dates; registrations attached. Seminar speakers are explicitly fictional demo speakers. |
| Moderator applications | 3 pending | For the admin queue. |
| Join requests | 2 pending | For the moderator/admin queue. |
| Notifications | 6 sample | Invite/approval/meeting types with correct deep links. |
| Reports | 1 open | So the admin Reports tab is demonstrable. |

## Conventions

- `[Demo]` title prefix on all seeded projects/clubs/events — never mistaken for official announcements.
- Dates are relative (`startInDays`) so content stays upcoming.
- `pnpm db:migrate` must have run first (reports table, privacy flags).
- Production safety: seed never updates non-demo rows; same-name colleges left untouched.
