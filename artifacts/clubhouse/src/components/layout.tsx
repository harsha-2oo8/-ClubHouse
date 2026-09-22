import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/react";
import { useTheme } from "next-themes";
import {
  Bell,
  Compass,
  FolderKanban,
  GraduationCap,
  CalendarDays,
  House,
  LayoutGrid,
  Moon,
  Sun,
  UserRound,
  Zap,
} from "lucide-react";
import { useGetUnreadNotificationCount, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";
import { AccountMenu } from "@/components/account-menu";
import { CreateMenu } from "@/components/create-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const links = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/discover", label: "Projects", icon: FolderKanban, match: (p: string) => p === "/discover" || p.startsWith("/projects") },
  { href: "/discover/events", label: "Events", icon: CalendarDays },
  { href: "/clubs", label: "Clubs", icon: LayoutGrid },
  { href: "/discover/colleges", label: "Colleges", icon: GraduationCap },
];

function useUnread(): number {
  const { isSignedIn } = useAuth();
  const { data } = useGetUnreadNotificationCount({
    query: { queryKey: getGetUnreadNotificationCountQueryKey(), enabled: Boolean(isSignedIn) },
  });
  return (data as { count?: number })?.count ?? 0;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/">
      <span className="flex cursor-pointer items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-violet-cyan text-white shadow-md">
          <Zap className="h-4 w-4" strokeWidth={2.5} />
        </span>
        {!compact && (
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Club<span className="text-gradient-violet-cyan">House</span>
          </span>
        )}
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      data-testid="button-theme-toggle"
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function BellButton({ dot = false }: { dot?: boolean }) {
  const unread = useUnread();
  return (
    <Link href="/notifications">
      <span
        data-testid="nav-notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            key={unread}
            className={cn(
              "animate-pop absolute flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              dot ? "-right-0.5 -top-0.5 bg-ch-coral" : "-right-1 -top-1 bg-ch-coral",
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </span>
    </Link>
  );
}

export function AppLayout({ children, userRole }: { children: React.ReactNode; userRole?: string }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string, match?: (p: string) => boolean) =>
    match ? match(location) : location === href || (href !== "/" && location.startsWith(href));

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop floating pill nav ─────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 hidden justify-center px-4 pt-4 md:flex">
        <motion.nav
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          data-testid="nav-desktop"
          className={cn(
            "flex w-full max-w-5xl items-center gap-1 rounded-2xl border bg-background/75 px-3 shadow-lg shadow-black/5 backdrop-blur-xl transition-all",
            scrolled ? "py-1.5" : "py-2.5",
          )}
        >
          <Logo />
          <div className="mx-2 h-6 w-px bg-border" />
          <div className="flex flex-1 items-center gap-0.5">
            {links.map((l) => {
              const active = isActive(l.href, l.match);
              return (
                <Link key={l.label} href={l.href}>
                  <span
                    data-testid={`nav-${l.label.toLowerCase()}`}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-full bg-primary/10"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <l.icon className={cn("relative h-4 w-4", active && "text-primary")} />
                    <span className="relative">{l.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <BellButton />
            <CreateMenu />
            <AccountMenu userRole={userRole} />
          </div>
        </motion.nav>
      </header>

      {/* ── Mobile top bar ────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <BellButton dot />
          <AccountMenu userRole={userRole} />
        </div>
      </header>

      {/* ── Mobile bottom tab bar with springing Create ───────────── */}
      <nav
        data-testid="nav-mobile-bottom"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl md:hidden"
      >
        <div className="relative mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5">
          {[
            { href: "/dashboard", label: "Home", icon: House },
            { href: "/discover", label: "Discover", icon: Compass },
          ].map((l) => (
            <Link key={l.href} href={l.href}>
              <span
                data-testid={`nav-mobile-${l.label.toLowerCase()}`}
                className={cn(
                  "flex min-h-[3.25rem] min-w-[4rem] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
                  isActive(l.href) ? "text-primary" : "text-muted-foreground",
                )}
              >
                <l.icon className="h-5 w-5" />
                {l.label}
              </span>
            </Link>
          ))}
          <span className="-mt-7">
            <CreateMenu variant="fab" />
          </span>
          {[
            { href: "/notifications", label: "Activity", icon: Bell },
            { href: "/profile/me", label: "Profile", icon: UserRound },
          ].map((l) => (
            <Link key={l.href} href={l.href}>
              <span
                data-testid={`nav-mobile-${l.label.toLowerCase()}`}
                className={cn(
                  "relative flex min-h-[3.25rem] min-w-[4rem] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
                  isActive(l.href) ? "text-primary" : "text-muted-foreground",
                )}
              >
                <l.icon className="h-5 w-5" />
                {l.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Content ───────────────────────────────────────────────── */}
      <main className="mx-auto w-full px-4 pb-32 pt-20 md:max-w-6xl md:px-6 md:pb-16 md:pt-28">
        {children}
      </main>
    </div>
  );
}
