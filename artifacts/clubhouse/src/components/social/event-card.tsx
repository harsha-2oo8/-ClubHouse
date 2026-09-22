import { motion } from "framer-motion";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardHover } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface SocialEventCardProps {
  event: Record<string, unknown>;
  onRegister?: (id: number) => void;
  registered?: boolean;
  footer?: React.ReactNode;
}

const typeStyle: Record<string, { rail: string; chip: string; label: string }> = {
  hackathon: { rail: "bg-ch-coral", chip: "bg-ch-coral/10 text-ch-coral", label: "Hackathon" },
  workshop: { rail: "bg-ch-cyan", chip: "bg-ch-cyan/10 text-ch-cyan", label: "Workshop" },
  seminar: { rail: "bg-ch-violet", chip: "bg-ch-violet/10 text-ch-violet", label: "Seminar" },
  other: { rail: "bg-ch-amber", chip: "bg-ch-amber/10 text-ch-amber", label: "Event" },
};

function daysUntil(start: Date): number {
  return Math.ceil((start.getTime() - Date.now()) / 86400000);
}

/** Vibrant event card: oversized date, category rail, live countdown, register state. */
export function SocialEventCard({ event, onRegister, registered, footer }: SocialEventCardProps) {
  const id = Number(event.id);
  const start = new Date(String(event.startDate));
  const valid = !Number.isNaN(start.getTime());
  const days = valid ? daysUntil(start) : null;
  const style = typeStyle[String(event.type)] ?? typeStyle.other;
  const spotsLeft =
    event.maxParticipants != null && event.maxParticipants !== ""
      ? Number(event.maxParticipants) - Number(event.registrantCount ?? 0)
      : null;

  return (
    <motion.article
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      data-testid={`card-event-${event.id}`}
      className="relative h-full overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:glow-cyan"
    >
      <span className={cn("absolute left-0 top-0 h-full w-1.5", style.rail)} />
      <div className="flex gap-4 p-5 pl-6">
        {valid && (
          <div className="flex w-14 flex-shrink-0 flex-col items-center rounded-xl bg-muted/70 py-2">
            <span className="font-display text-2xl font-bold leading-none text-foreground">
              {start.getDate()}
            </span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {start.toLocaleString(undefined, { month: "short" })}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", style.chip)}>
              {style.label}
            </span>
            {days !== null && days >= 0 && days <= 14 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ch-coral">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
                {days === 0 ? "Today" : `in ${days}d`}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-display text-base font-bold leading-snug text-foreground line-clamp-2">
            {String(event.title)}
          </h3>
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {event.collegeName ? (
              <p className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" /> {String(event.collegeName)}
              </p>
            ) : null}
            {spotsLeft !== null && (
              <p className="flex items-center gap-1.5">
                <Users className="h-3 w-3 flex-shrink-0" />
                {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {event.registrationLink ? (
              <a href={String(event.registrationLink)} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button size="sm" className="w-full" data-testid={`button-external-register-${event.id}`}>
                  Register
                </Button>
              </a>
            ) : onRegister ? (
              <Button
                size="sm"
                className="flex-1"
                variant={registered ? "secondary" : "default"}
                disabled={registered}
                onClick={() => onRegister(id)}
                data-testid={`button-register-event-${event.id}`}
              >
                {registered ? "Registered ✓" : "Register"}
              </Button>
            ) : null}
            {footer}
          </div>
        </div>
      </div>
      {valid && (
        <div className="flex items-center gap-1.5 border-t border-border/70 px-6 py-2 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {start.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>
      )}
    </motion.article>
  );
}
