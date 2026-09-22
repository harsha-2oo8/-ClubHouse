import { motion } from "framer-motion";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cardHover } from "@/lib/motion";

interface StudentCardProps {
  student: Record<string, unknown>;
}

/** Builder identity card: avatar-forward, interest chips. */
export function StudentCard({ student }: StudentCardProps) {
  const id = String(student.clerkId ?? student.id ?? "");
  const interests = Array.isArray(student.interests)
    ? (student.interests as unknown[]).map(String).slice(0, 3)
    : [];
  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover">
      <Link href={id ? `/profile/${id}` : "/discover"}>
        <article
          data-testid={`card-student-${id}`}
          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:glow-violet"
        >
          <Avatar className="h-11 w-11 flex-shrink-0">
            <AvatarImage src={String(student.avatarUrl ?? "")} />
            <AvatarFallback className="bg-primary/10 font-display font-bold text-primary">
              {String(student.name ?? "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-sm font-bold text-foreground">
              {String(student.name ?? "Student")}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {String(student.course ?? "")}{student.college ? ` · ${String(student.college)}` : ""}
            </p>
            {interests.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {interests.map((t) => (
                  <span key={t} className="rounded-full bg-ch-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-ch-cyan">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
