import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, UsersRound } from "lucide-react";
import { cardHover } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ClubCardProps {
  club: Record<string, unknown>;
}

const gradients = [
  "bg-gradient-violet-cyan",
  "bg-gradient-pink-violet",
];

/** Community club card: gradient identity block, stats, join affordance. */
export function ClubCard({ club }: ClubCardProps) {
  const id = String(club.id);
  const grad = gradients[Number(id) % gradients.length];
  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover">
      <Link href={`/clubs/${id}`}>
        <article
          data-testid={`card-club-${id}`}
          className="group h-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:glow-violet"
        >
          <div className={cn("relative flex h-24 items-end p-4", grad)}>
            <div className="motif-dots pointer-events-none absolute inset-0 opacity-40" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 font-display text-xl font-bold text-gray-900 shadow">
              {String(club.name ?? "C").slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-base font-bold leading-snug text-foreground line-clamp-1">
                {String(club.name)}
              </h3>
              <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground line-clamp-2">{String(club.description ?? "")}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <UsersRound className="h-3.5 w-3.5" /> {Number(club.memberCount ?? 0)}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> {Number(club.eventCount ?? 0)} events
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
