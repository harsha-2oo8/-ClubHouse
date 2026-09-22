# Vibrant Social UI Audit — ClubHouse frontend (2026-09-20, pre-redesign)

## Current state (code truth)

- **Routes**: `/`, `/sign-in`, `/sign-up`, `/onboarding`, `/dashboard`,
  `/discover`, `/discover/colleges`, `/discover/events`, `/clubs*`,
  `/colleges/:id`, `/projects/:id`, `/profile/*`, `/notifications`,
  `/admin`, `/my`, `/settings`, `/help`. All functional; keep working.
- **Navigation**: fixed left sidebar (desktop) + top bar + drawer (mobile) +
  bottom 5-tab bar. Generic SaaS pattern — replaced this session.
- **Visual system**: single indigo (`245 80% 58%`) + neutral shadcn tokens,
  Inter, `0.625rem` radius, `hover-elevate` overlays. No display type,
  no accent palette, no motifs, no gradients.
- **Motion**: framer-motion installed but ~unused (one chat scrollIntoView).
  No page transitions, no staggering, no micro-interactions beyond CSS hover.
  `tw-animate-css` present (accordion/keyframe utilities only).
- **Landing**: static marketing hero (to be replaced with network canvas).
- **Dashboard**: 4 stat cards + quick actions + activity + matches — solid
  information, generic presentation.
- **Discover**: three separate pages (projects / colleges / events) with
  uniform card grids — no tabs, no featured treatment.
- **Cards**: uniform bordered rectangles everywhere (violates "don't
  over-card": directory, events, clubs all identical rhythm).
- **Dark mode**: token-complete (deep background), but accents stay muted.
- **A11y/motion safety**: no `prefers-reduced-motion` handling anywhere.
- **Dev residue**: zero dev banners/mock data in shipped app; Replit plugins
  only in mockup-sandbox (not shipped); `@replit` comments cosmetic.

## Flagged-term sweep

`development mode/dev mode`: only from Clerk itself (test keys — operational
fix, not code). `Replit/localhost/mock/placeholder/TODO/FIXME/debug`: none
in shipped UI code (placeholders are form hints). No test credentials.

## What changes this session (and what does not)

CHANGE: tokens + display type + accent palette + dark tuning; motion
system + reduced-motion; top pill nav + create-centered mobile nav;
landing hero canvas + live sections; dashboard feed hierarchy; unified
Discover with tabs/pills/featured cards; new Project/Event/Club/College/
Student card system; account menu additions; toasts/scrollbars/focus polish;
DESIGN_SYSTEM.md + MOTION_SYSTEM.md.

PRESERVED: every route, hook, mutation, policy gate, dialog flow, admin,
onboarding, settings/help, chat, forms. Detail pages (project/college/
profile/club/admin) keep structure, inherit new tokens; full per-page
motion rewrites deferred (documented limitation).
