# FINAL PRODUCTION AUDIT — ClubHouse (2026-09-20)

Repo: `D:\OpencodeProjs\Clubhouse\Web-Mobile-Fit` @ main (post improvement program).
Prod: Vercel SPA + Render API (`clubhouse-api-yxsm`) + Supabase PG (ap-northeast-2, Session pooler). 18 tables live.

## 1. Flagged-term sweep (evidence)

| Term | Finding |
|---|---|
| `localhost` / `127.0.0.1` | Only in: Replit GCS sidecar (`objectStorage.ts:1106`, PROD ISSUE), mockup-sandbox plugin (not shipped). No localhost URLs in clubhouse app or API routes. |
| `Replit` | Sidecar creds + error text (must go), cartographer/dev-banner only in mockup-sandbox (not shipped) + one comment in clerkProxyMiddleware. shadcn `// @replit` comments are cosmetic. |
| `TODO/FIXME/console.log/alert(` | Zero in shipped code (one commented example in use-upload.ts). |
| `mock/dummy/fake/sample` | Zero live data; all `placeholder=` are form hint text (legitimate). |
| Hardcoded admin | **None** — grep clean. Bootstrap is env-only. |
| `pk_test/sk_test/pk_live` | **None in source** — keys come from env.rot |
| `import.meta.env` (web) | `VITE_CLERK_PUBLISHABLE_KEY` (required), `VITE_CLERK_PROXY_URL` (optional), `VITE_API_URL` (required), `BASE_URL` (Vite built-in). No secret leaks. |
| `process.env` (API) | DATABASE_URL, CLERK_*, ADMIN_*, PUBLIC/PRIVATE_OBJECT_*, PORT, NODE_ENV, LOG_LEVEL. No GCS_* yet (to add). |
| `if DEV` / `NODE_ENV !== production` | logger pretty-print (fine), clerkProxy prod-only (fine). No dev UI gates. |

## 2. "Development mode" badge — ROOT CAUSE (confirmed)

The badge is rendered by Clerk's `<UserButton />` (layout.tsx:90,150) because the configured Clerk instance is a **development instance (`pk_test_…`)**. There is **no** dev banner, mock branding, or Replit UI in our code causing it. Fix = switch Clerk to a **production instance (`pk_live_`/`sk_live_`)** in Clerk Dashboard and rotate Vercel + Render env (user action — cannot be done from code). Code-side: add startup warnings when test keys are used with production builds, keep appearance config.

## 3. DELETE endpoint audit (code truth)

| Endpoint | Status |
|---|---|
| DELETE /projects/:projectId | EXISTS — owner-only, **no admin override, no audit** → fix |
| DELETE /clubs/:clubId | EXISTS (via creator-only getManagedClub) — **no admin override, no audit** → fix |
| DELETE /clubs/:clubId/events/:eventId | EXISTS — creator-only → add admin override + audit |
| DELETE /events/:eventId | **MISSING** → add (creator-or-admin) + OpenAPI |
| PATCH /events/:eventId | **MISSING** → add (creator-or-admin) + OpenAPI |
| DELETE /projects/:projectId/events/:eventId | **MISSING** → add (owner-or-admin) + OpenAPI |
| UI delete buttons | Only icon buttons in club admin (no confirm) → add AlertDialog + typed confirm |

## 4. Storage (code truth)

`objectStorage.ts` mints presigned URLs via Replit sidecar (`http://127.0.0.1:1106`) — **dead on Render**. Private serve requires auth+ACL (good) but no visibility model. Fix: `gcsStorage.ts` on service-account creds (GCS_* env), visibility PUBLIC/PRIVATE (+COLLEGE/PROJECT/CLUB mapping), object deletion on resource delete, path traversal guards (already present, keep). Live verification BLOCKED until user supplies a GCS key.

## 5. CORS / headers / errors (code truth)

- `cors({credentials:true, origin:true})` — reflects any origin. Must become `CORS_ORIGINS` allowlist in production (+localhost only in dev).
- No helmet. Add minimal helmet (CSP off by default to avoid breaking Clerk; enable other headers).
- Errors are `{error: string}` ad-hoc. Keep shape (frontend depends on it) — do NOT churn to `{error:{code,message}}` (would break 20+ call sites); document instead.
- pino-http has req.id already; ensure request-id header passthrough + userId in logs where cheap.

## 6. Docs vs code gaps

- DEVELOPMENT.md PORT/BASE_PATH line — fixed last session. `dist/public` → `dist` — fixed.
- Missing docs: PRODUCTION_SETUP, ADMIN_SETUP, DELETION_POLICY, STORAGE, SMOKE_TEST (to create); SECURITY.md needs prod-keys + CORS + headers refresh.
- replit.md is a Replit runbook — leave (harmless, not shipped).

## 7. What is already production-ready (do not touch)

RBAC core, rate limits, pagination limits, audit table+recording, Bearer bridge, /healthz+/readyz, constraints/indexes, codegen sync, CI, tests baseline, notifications core, search core, onboarding/profile flows.

## 8. Execution plan (this session)

1. Audit doc (this file). 2. Dev-mode code cleanup + key warnings + UserButton polish. 3. `api/src/lib/config.ts` + web `src/lib/config.ts` + `.env.example` refresh. 4. CORS allowlist + helmet + request-id. 5. `scripts/admin-verify` (verify, not create). 6. `canDelete*` in policy.ts; fix 3 deletes; add 3 endpoints; OpenAPI+codegen. 7. Delete UX dialogs + typed confirm. 8. Deletion policy (hard delete + cascades exist; audit all deletes; notify project members/event registrants). 9. `gcsStorage.ts` + GCS_* env + storage route swap (verify blocked). 10. Reports table/API/admin UI. 11. Admin audit UI + dashboard counts. 12. Creator dashboard page + mobile bottom nav + profile menu. 13. Notifications/search/privacy micro-gaps only if cheap. 14. Policy unit tests + validation tests. 15. All 7 docs. 16. Full verify + honest report (COMPLETED/PARTIAL/BLOCKED/NOT IMPLEMENTED).

Out of scope this session (documented, not attempted): SSE realtime, matching/AI features, DM, QR check-in, certificates, Elasticsearch/Redis.
