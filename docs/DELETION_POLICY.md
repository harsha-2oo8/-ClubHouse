# Resource Deletion Policy

## Strategy: hard delete + cascades + audit trail (no soft delete)

Rationale: ClubHouse resources are small, user-owned, and discovery must
reflect deletion immediately. Every destructive route writes an
`admin_audit_logs` row with a `before` snapshot, so admins keep a trail
even though rows are gone. Soft-delete (`deleted_at`) was rejected: it
would leak into every discovery query and the API contract for little
benefit at this scale. Revisit if legal retention requires it.

## Rules (all enforced server-side; UI gating is cosmetic)

| Resource | Who can delete | Cascade removes | Notified |
|---|---|---|---|
| Project | creator (`ownerId`) or platform admin | members, applications, messages, events (FK cascade + explicit) | surviving members (`project_deleted`) |
| Club | creator (`createdBy`) or platform admin | team list, management events; GCS logo/brochure (best-effort) | — (members may be non-users) |
| Global event | creator (`createdBy`) or platform admin | registrations (cascade) | registrants (`event_cancelled`) |
| Club event | club owner, event creator, or admin | nothing (leaf row); GCS banner (best-effort) | — |
| Project event | project owner, event creator, or admin | nothing (leaf row) | — |

Moderators NEVER delete other people's resources. College moderators manage
memberships/meetings only — no delete rights outside their own creations.

## UX requirements (implemented via `DeleteConfirm`)

- Never one click: AlertDialog always.
- Projects/clubs (dangerous): must type `DELETE`; consequences listed
  (messages, memberships, applications, events / team, events, assets).
- Events/meetings: plain confirm with consequences.
- Storage cleanup is best-effort and never fails the resource delete.

## What is NOT deleted

Notifications referencing deleted resources remain (they are the user's
inbox history; links may 404 — acceptable and documented here).
Reports referencing deleted targets remain open for moderator context.
`users` rows are never deleted by the app.
