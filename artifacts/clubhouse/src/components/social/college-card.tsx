import { motion } from "framer-motion";
import { Link } from "wouter";
import { GraduationCap, MapPin } from "lucide-react";
import { cardHover } from "@/lib/motion";

interface CollegeCardProps {
  college: Record<string, unknown>;
}

/** Campus hub card: editorial layout, no box-heavy chrome. */
export function CollegeCard({ college }: CollegeCardProps) {
  const id = String(college.id);
  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover">
      <Link href={`/colleges/${id}`}>
        <article
          data-testid={`card-college-${id}`}
          className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:glow-cyan"
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-violet-cyan text-white shadow">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold leading-snug text-foreground line-clamp-1">
              {String(college.name)}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{String(college.location ?? "")}</span>
            </p>
            {(college.memberCount != null || college.projectCount != null) && (
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                {Number(college.memberCount ?? 0)} members · {Number(college.projectCount ?? 0)} projects
              </p>
            )}
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
