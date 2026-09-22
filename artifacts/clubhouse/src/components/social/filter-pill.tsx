import { motion } from "framer-motion";
import { buttonPress } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
  accentClass?: string;
}

/** Animated filter pill — layout-animated active background. */
export function FilterPill({ active, onClick, children, testId, accentClass }: FilterPillProps) {
  return (
    <motion.button
      variants={buttonPress}
      initial="rest"
      whileTap="press"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "relative rounded-full px-4 py-2 text-sm font-medium transition-colors flex-shrink-0 min-h-[2.5rem]",
        active ? "text-white" : "text-muted-foreground bg-muted/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId={undefined}
          className={cn("absolute inset-0 rounded-full bg-gradient-violet-cyan", accentClass)}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
