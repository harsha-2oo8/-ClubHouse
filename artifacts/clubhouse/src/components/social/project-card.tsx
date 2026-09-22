import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowUpRight, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardHover } from "@/lib/motion";
import { MemberStack } from "./member-stack";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Record<string, unknown>;
  members?: Array<Record<string, unknown>>;
  featured?: boolean;
}

const statusAccent: Record<string, string> = {
  active: "bg-ch-lime",
  planning: "bg-ch-amber",
  completed: "bg-ch-cyan",
  on_hold: "bg-ch-coral",
};

/** Alive project card: energy rail, identity, tech, team, open roles. */
export function ProjectCard({ project, members = [], featured = false }: ProjectCardProps) {
  const id = String(project.id);
  const tech = String(project.techStack ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  const roles = Array.isArray(project.requiredRoles)
    ? (project.requiredRoles as Array<{ role?: string }>).slice(0, 3)
    : [];
  const open = Boolean(project.openForApplications);

  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover" className={cn(featured && "sm:col-span-2")}>
      <Link href={`/projects/${id}`}>
        <article
          data-testid={`card-project-${id}`}
          className={cn(
            "group relative h-full overflow-hidden rounded-2xl border bg-card transition-shadow",
            "border-border hover:glow-violet cursor-pointer",
            featured && "border-primary/30",
          )}
        >
          <span className={cn("absolute left-0 top-0 h-full w-1", statusAccent[String(project.status)] ?? "bg-ch-violet")} />
          <div className="p-5 pl-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ch-violet mb-1">
                  {String(project.status ?? "project").replace("_", " ")}
                  {project.collegeName ? ` · ${String(project.collegeName)}` : ""}
                </p>
                <h3 className="font-display text-lg font-bold leading-snug text-foreground line-clamp-2">
                  {String(project.title)}
                </h3>
              </div>
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            {project.description ? (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{String(project.description)}</p>
            ) : null}
            {tech.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tech.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
              <div className="flex items-center gap-2">
                <MemberStack members={members} />
                <span className="text-xs text-muted-foreground">
                  {members.length > 0 ? `${members.length} building` : `${Number(project.memberCount ?? 0)} members`}
                </span>
              </div>
              {open ? (
                <Badge className="gap-1 border-green-500/30 bg-green-500/10 text-green-600 text-[11px]">
                  <Unlock className="h-3 w-3" /> Open
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Closed
                </Badge>
              )}
            </div>
            {open && roles.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ch-amber">Roles</span>
                {roles.map((r, i) => (
                  <span key={i} className="rounded-full border border-dashed border-ch-amber/50 px-2 py-0.5 text-[11px] text-foreground">
                    {String(r.role ?? "")}
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
