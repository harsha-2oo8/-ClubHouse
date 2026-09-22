import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CalendarDays, Compass, GraduationCap, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/discover", label: "Projects", icon: Compass },
  { href: "/discover/events", label: "Events", icon: CalendarDays },
  { href: "/clubs", label: "Clubs", icon: UsersRound },
  { href: "/discover/colleges", label: "Colleges", icon: GraduationCap },
];

/** Unified Discover tab bar with sliding active indicator. */
export function DiscoverTabs() {
  const [location] = useLocation();
  return (
    <div
      data-testid="discover-tabs"
      className="scroll-slim -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {tabs.map((t) => {
        const active =
          location === t.href || (t.href === "/discover" && location === "/discover");
        return (
          <Link key={t.href} href={t.href}>
            <span
              data-testid={`tab-${t.label.toLowerCase()}`}
              className={cn(
                "relative flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="discover-tab"
                  className="absolute inset-0 rounded-full bg-primary/10 ring-1 ring-primary/25"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <t.icon className={cn("relative h-4 w-4", active && "text-primary")} />
              <span className="relative">{t.label}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
