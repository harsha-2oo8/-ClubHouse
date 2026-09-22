import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EmptyStateProps {
  headline: string;
  subline: string;
  actionLabel?: string;
  actionHref?: string;
  testId?: string;
}

/** Branded empty state: motif backdrop, display headline, single CTA. */
export function EmptyState({ headline, subline, actionLabel, actionHref, testId }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center"
      data-testid={testId}
    >
      <div className="motif-dots mask-fade-b pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-violet-cyan text-white shadow-lg">
          <Compass className="h-6 w-6" />
        </div>
        <p className="font-display text-xl font-bold text-foreground">{headline}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{subline}</p>
        {actionLabel && actionHref && (
          <Link href={actionHref}>
            <Button className="mt-5 gap-2" data-testid={`${testId}-action`}>
              {actionLabel}
            </Button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
