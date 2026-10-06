# College Roles & Permissions

## Principle

Identity (`college_members.member_type`: STUDENT / TEACHER / STAFF / TRUSTEE /
COLLEGE_HEAD) is **separate** from capability (grants on `college_roles`).
Permissions define what, scopes define where, priority defines who can
manage whom. All decisions are server-side (`collegeRbac.ts`); UI gating
is cosmetic.

## Model

- `college_roles` — DB-driven, per college: name, memberType, priority,
  isSystem, description. Custom priorities capped at 999; 1000 is reserved
  for College Head supremacy.
- `college_role_permissions` — keys from the versioned catalog in
  `collegeRbac.ts` (`PERMISSION_CATALOG`, 24 keys across college / project /
  club / event / member scopes).
- `college_role_assignments` — who holds what, where, granted by whom.
- `college_settings` — `allowStudentCreate` (default true), `openJoin`
  (default true), enforced on create/join paths.
- `college_members.member_type` + `member_status`
  (VERIFIED / PENDING / REJECTED / SUSPENDED). Verified by default for
  STUDENT; other claims go PENDING until a Head verifies (REJECTED falls
  back to STUDENT). Only platform administration grants COLLEGE_HEAD.

## Defaults (deliberately limited)

STUDENT 100 · STAFF 600 · TEACHER 700 · TRUSTEE 900 (view-oriented, no ops)
· COLLEGE_HEAD 1000 (full college scope) · Coordinators 650.
System templates seed automatically on college approval (+ one-off backfill
already applied); the registrant becomes the first College Head.
Pre-existing colleges without members are governed by platform admins only.

## Hierarchy safety

A role manages only **strictly lower** priorities; platform admins bypass.
Enforced on: role create/edit/delete, assignment, unassignment (last Head
protected — 409), identity verification. Legacy `member/moderator/admin`
column maps to rungs 100/600/900 for comparisons; existing coarse gates
are unchanged.

## Scoping

Resources resolve college scope via their `collegeId` when present;
platform-wide (`null`) resources keep creator/admin rules. Coordinators act
only inside their own college. Resource roles (Lead, Co-Lead, …) live in
membership `role` fields and stay subordinate to college authority.

## Workflows enforced today

Join approval (moderator/head/platform-admin), member-type
request → verify/reject/suspend, role lifecycle with audit, settings gates
on create/join. Not yet: per-action configurable approver matrices beyond
these knobs (documented extension point, not faked).
