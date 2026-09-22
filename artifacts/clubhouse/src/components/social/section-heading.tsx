import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

interface SectionHeadingProps {
  kicker: string;
  kickerClass?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}

/** Editorial section header: small caps kicker + display title + optional link. */
export function SectionHeading({ kicker, kickerClass, title, subtitle, actionLabel, actionHref }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <p className={`text-xs font-bold uppercase tracking-[0.18em] mb-1.5 ${kickerClass ?? "text-ch-violet"}`}>
          {kicker}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0" data-testid={`link-section-${actionHref}`}>
            {actionLabel} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}
    </div>
  );
}
