import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CalendarPlus, FolderPlus, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { buttonPress } from "@/lib/motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const options = [
  {
    label: "Create Project",
    desc: "Start a team, define roles",
    icon: FolderPlus,
    href: "/discover?create=1",
    testId: "create-project",
  },
  {
    label: "Create Club",
    desc: "Gather your community",
    icon: UsersRound,
    href: "/clubs/register",
    testId: "create-club",
  },
  {
    label: "Create Event",
    desc: "Hackathon, workshop, talk",
    icon: CalendarPlus,
    href: "/discover/events?create=1",
    testId: "create-event",
  },
];

/**
 * Unified Create interaction: floating + action (desktop dropdown,
 * mobile sheet). Creation forms open where they live; the menu deep-links
 * straight into each composer.
 */
export function CreateMenu({ variant = "bar" }: { variant?: "bar" | "fab" }) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const go = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  const trigger = variant === "fab" ? (
    <motion.button
      variants={buttonPress}
      initial="rest"
      whileTap="press"
      aria-label="Create"
      data-testid="button-create-fab"
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl",
        "bg-gradient-violet-cyan glow-violet",
      )}
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </motion.button>
  ) : (
    <Button
      className="gap-1.5 rounded-full bg-gradient-violet-cyan text-white shadow-md hover:opacity-95"
      data-testid="button-create-bar"
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} /> Create
    </Button>
  );

  const list = (
    <div className="space-y-1 p-1">
      {options.map((o) => (
        <button
          key={o.href}
          onClick={() => go(o.href)}
          data-testid={`menu-${o.testId}`}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <o.icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left font-display">Create something</SheetTitle>
          </SheetHeader>
          <div className="mt-3">{list}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2" data-testid="menu-create">
        {list}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
