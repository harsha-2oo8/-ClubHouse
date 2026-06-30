# ClubHouse — Multi-College Student Collaboration Platform

A platform where college students register, join their college club, collaborate on projects with real-time chat and calendar, attend hackathons/workshops, and get moderated by role-based admins.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/clubhouse run dev` — run the frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, wouter routing, TanStack Query, shadcn/ui, Tailwind v4, next-themes
- API: Express 5 + Clerk auth middleware
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (ClerkProvider in frontend, clerkMiddleware in backend)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → `lib/api-client-react/src/generated/api.ts`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — source of truth for all DB tables
- `lib/api-spec/openapi.yaml` — source of truth for API contract (generates hooks + Zod)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not hand-edit)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/clubhouse/src/pages/` — all frontend pages
- `artifacts/clubhouse/src/components/layout.tsx` — app sidebar + mobile nav
- `artifacts/clubhouse/src/index.css` — HSL design tokens (indigo primary `245 80% 58%`)

## Architecture decisions

- **Clerk for auth**: Frontend uses `publishableKeyFromHost` to support both dev and prod Clerk keys automatically. Backend uses `@clerk/express` `clerkMiddleware` + `requireAuth` middleware.
- **Contract-first API**: OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas. No hand-written fetch calls in the frontend.
- **`generatedAlwaysAsIdentity()` IDs**: Auto-excluded from Drizzle insert schemas — never include `id` in `.omit({})` or you get "Unrecognized key" errors.
- **Admin hardcode**: `harshavardhankalvir2808@gmail.com` receives `role: "admin"` on first profile creation (in `users.ts` route).
- **No OTP**: Password reset is handled entirely by Clerk's built-in email/password flow — no custom OTP logic.

## Product

- **Onboarding (2-step)**: name, age, course, semester, college, pronouns → bio, portfolio projects, social links
- **Dashboard**: stats (projects, events, notifications), quick actions, activity feed
- **Discover Projects**: browse/search/filter projects; apply to join open ones; create new
- **Discover Colleges**: browse colleges; request to join; register new colleges (admin approval)
- **Discover Events**: hackathons, workshops, seminars; register inline or via external link
- **College page**: overview, members list, projects, meetings (moderator/admin can schedule)
- **Project page**: description, members, chat (members only), meeting calendar (members only)
- **Profile**: avatar, bio, portfolio, social links (editable by self)
- **Notifications**: grouped by date, mark-read, mark-all-read
- **Admin panel**: approve/reject college registrations, approve/reject moderator applications, platform stats

## User preferences

- Admin email: harshavardhankalvir2808@gmail.com (always gets role: "admin")
- No OTP for forgot password — email/password only via Clerk
- Primary brand color: indigo `--primary: 245 80% 58%`

## Gotchas

- `generatedAlwaysAsIdentity()` ID columns must NOT be in `.omit({})` — Drizzle excludes them automatically
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec before editing frontend pages
- Do not import Lucide icons AND define a local SVG function with the same name in the same file — causes Babel "Duplicate declaration" errors
- Clerk `routerPush`/`routerReplace` callbacks must strip the base path prefix before calling wouter's `setLocation`
- API server listens on port 8080 (not 5000 — value comes from the `PORT` env var set by the workflow)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for Clerk wiring reference
