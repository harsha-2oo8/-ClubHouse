# ClubHouse Design System

Vibrant, social, youthful — never childish. Primary Electric Violet/Indigo;
Cyan secondary; Lime/Coral/Amber/Pink accents in controlled doses.

## Color

| Role | Light | Dark | Usage |
|---|---|---|---|
| Primary violet | `245 80% 58%` | `245 75% 62%` | brand, primary actions, active states |
| `--ch-violet` | `262 84% 60%` | `262 90% 70%` | energy accents, gradients |
| `--ch-cyan` | `190 95% 42%` | `190 95% 58%` | secondary, workshops, info |
| `--ch-lime` | `84 81% 38%` | `84 85% 60%` | success/active, open roles |
| `--ch-coral` | `8 90% 58%` | `8 92% 66%` | hackathons, urgency, destructive-adjacent energy |
| `--ch-amber` | `36 96% 48%` | `36 98% 60%` | planning states, highlights |
| `--ch-pink` | `330 82% 58%` | `330 88% 68%` | community, clubs |
| Neutrals | warm white `40 20% 99%` / soft gray | deep navy-charcoal `240 10% 8%`, layered `11%` surfaces | backgrounds |

Utilities: `.text-ch-*`, `.bg-ch-*`. Gradients (accents only):
`.text-gradient-violet-cyan`, `.text-gradient-pink-violet`,
`.text-gradient-amber-coral`, `.bg-gradient-violet-cyan`,
`.bg-gradient-pink-violet`. Glow rings: `.glow-violet`, `.glow-cyan`
(hover/featured only — never everywhere).

Semantic colors stay standard: success green, warning amber, destructive red,
info cyan.

## Typography

- Display: `Space Grotesk` (`font-display`) — page titles, hero, card titles,
  numbers. Tight tracking, bold weights.
- UI: Inter — body, forms, metadata. Compact metadata stays small (11–12px).
- Hierarchy: kicker (11–12px caps, accent) → display title (24–72px) →
  body (14–16px) → metadata (11–12px).

## Motifs & surfaces

- `motif-dots` / `motif-grid` section backdrops (masked, never behind body
  text). Network canvas on the landing hero only.
- Cards are used where cards make sense; editorial rows, dividers, pill
  filters, timelines and overlapping headers elsewhere. No glass-everywhere:
  glass is reserved for the floating nav + sheets.
- Radius `0.625rem` base, `1rem–1.5rem` for cards/sheets; soft layered
  shadows (see `--shadow-*`); dark mode deepens surfaces, never inverts.

## Buttons / pills / badges

- Primary CTA: gradient violet→cyan, white text, full-round on hero/create.
- `FilterPill`: layout-animated gradient active state.
- Status rails: 4px left rail per status/type (lime planning/active states,
  coral hackathons, cyan workshops, violet seminars) instead of more boxes.

## Iconography & imagery

Lucide throughout; avatars rounded-full with initial fallbacks; no stock
imagery — identity comes from gradient initial blocks and motifs.

## Responsive

Mobile-first: bottom tab bar with springing central Create; sheets not
dropdowns; horizontal snap rows; `min-h-[3rem]`+ touch targets; safe-area
padding. Desktop: floating glass pill nav that compresses on scroll.
