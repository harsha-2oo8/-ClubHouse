import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp, staggerItem, staggerParent } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  /** Extra delay in seconds (stagger manually when needed). */
  delay?: number;
  className?: string;
  /** Set for grid children animated by a parent Stagger. */
  asStaggerItem?: boolean;
}

/**
 * Scroll-triggered reveal (IntersectionObserver via framer-motion viewport).
 * Fires once, respects OS reduced-motion (jump to final state).
 */
export function Reveal({ children, delay = 0, className, asStaggerItem = false }: RevealProps) {
  const reduce = useReducedMotion();
  const variants: Variants = asStaggerItem ? staggerItem : fadeUp;
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
}

/** Container that staggers any <Reveal asStaggerItem> children on mount. */
export function Stagger({ children, className }: StaggerProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  );
}
