# ClubHouse Motion System (`src/lib/motion.ts`)

Every animation communicates: navigation, hierarchy, interaction, feedback,
state change, discovery, continuity. Nothing decorative-without-purpose.

## Timing

| Tier | Duration | Use |
|---|---|---|
| Fast interaction | 150–220ms | press, badge pop, tab indicator |
| Normal UI | 220–400ms | cards, dialogs, lists, filters |
| Large transitions | 400–700ms | pages, sheets, hero reveals |
| Hero moments | 700–1200ms | landing headline/canvas only |

Springs: `springSnappy` (420/34, hovers, pops), `springBouncy` (260/22,
hero entrances). Easing: `easeOut [0.22,1,0.36,1]`.

## Variants (named, reusable)

`pageEnter` (route fade/slide + exit) · `fadeUp` (sections) · `fadeScale`
(meta) · `staggerParent`/`staggerItem` (grids/feeds) · `listEnter` (chat,
activity, notifications) · `cardHover`/`buttonPress` (whileHover/whileTap) ·
`springIn` (hero) · `modalIn`/`drawerIn` (dialogs/sheets) · `notificationPop` ·
`collapse` (expandable sections).

## Components

- `<Reveal>` — scroll-triggered once, optional delay; `asStaggerItem` for
  grid children inside `<Stagger>`.
- Route transitions: `AnimatePresence mode="wait"` + `pageEnter` keyed by
  location in `App.tsx`.
- Nav active states: shared `layoutId` pills (desktop pill, Discover tabs).
- CSS utilities: `.animate-pop` (badge), `.animate-draw-check` (success),
  `.live-dot` (real activity only), `.animate-drift-a/b` (decorative blobs).

## Rules (enforced in review)

- Transform/opacity only (GPU); never width/height/top/left.
- No full-screen particle spam; canvas pauses offscreen and caps nodes/DPR.
- Ambient motion limited to hero/decorative zones, never behind text.
- Mobile: opacity/transform/scale only; no big blurs or shadow animation.
- Reduced motion: `<MotionConfig reducedMotion="user">` globally +
  `useReducedMotion` in Reveal/Stagger + CSS kill-switch for decorative
  keyframes. Functional changes still apply instantly.

## Micro-interaction map

Press → scale 0.96 spring-back · Card hover → lift + glow · Tabs → sliding
pill · Filters → gradient morph · Badge count change → pop (key remount) ·
Delete → typed confirm → toast · Register → disabled "Registered ✓" state ·
Join → state flip · Create FAB → spring sheet/dropdown.
