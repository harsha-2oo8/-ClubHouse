import type { Variants } from "framer-motion";

/**
 * ClubHouse motion system — every animation communicates something.
 *
 * Timing philosophy:
 * - fast interaction:  150–220ms  (press, hover, badge pop)
 * - normal UI:         220–400ms  (cards, dialogs, tabs, lists)
 * - large transitions: 400–700ms  (pages, drawers, heroes)
 * - hero moments:      700–1200ms (landing reveals only)
 *
 * Physics: springy but snappy. All movement is transform/opacity (GPU).
 * Accessibility: wrap the app in <MotionConfig reducedMotion="user"> so
 * the OS prefers-reduced-motion setting disables transforms globally;
 * functional state changes (open/close) still apply instantly.
 */

export const springSnappy = { type: "spring", stiffness: 420, damping: 34 } as const;
export const springBouncy = { type: "spring", stiffness: 260, damping: 22 } as const;
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Full page enter/exit. */
export const pageEnter: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.22, ease: "easeIn" } },
};

/** Standard section reveal. */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
};

/** Small element reveal (badges, meta rows). */
export const fadeScale: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: easeOut } },
};

/** Stagger container — children use `staggerItem`. */
export const staggerParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/** Stagger child (cards in grids/feeds). */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
};

/** List row enter (chat messages, activity, notifications). */
export const listEnter: Variants = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: easeOut } },
};

/** Card hover lift — pair with whileHover="hover". */
export const cardHover: Variants = {
  rest: { y: 0, transition: { duration: 0.2 } },
  hover: { y: -4, transition: springSnappy },
};

/** Button press — pair with whileTap="press". */
export const buttonPress: Variants = {
  rest: { scale: 1 },
  press: { scale: 0.96, transition: { duration: 0.15 } },
};

/** Hero spring entrance. */
export const springIn: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springBouncy },
};

/** Dialog entrance. */
export const modalIn: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.18 } },
};

/** Bottom-sheet entrance (mobile). */
export const drawerIn: Variants = {
  initial: { y: "100%" },
  animate: { y: 0, transition: { duration: 0.38, ease: easeOut } },
  exit: { y: "100%", transition: { duration: 0.26, ease: "easeIn" } },
};

/** Notification/activity pop. */
export const notificationPop: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springSnappy },
};

/** Collapsible sections. */
export const collapse: Variants = {
  open: { height: "auto", opacity: 1, transition: { duration: 0.3, ease: easeOut } },
  closed: { height: 0, opacity: 0, transition: { duration: 0.24, ease: "easeIn" } },
};
