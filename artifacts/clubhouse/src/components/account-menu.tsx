import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Bell,
  Check,
  CircleHelp,
  Flag,
  Lock,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Shield,
  ShieldCheck,
  Sun,
  MonitorSmartphone,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { ReportDialog } from "@/components/report-dialog";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  userRole?: string;
}

/**
 * Polished application account center. Avatar/name click opens this menu —
 * never anything labeled "development mode" (that badge comes from Clerk
 * itself when the instance uses test keys; see PRODUCTION_SETUP.md §4).
 *
 * Auth stays 100% Clerk: sign-out via Clerk, password/sessions via Clerk's
 * hosted UserProfile. Desktop = dropdown, mobile = bottom sheet.
 */
export function AccountMenu({ userRole }: AccountMenuProps) {
  const { user } = useUser();
  const { isSignedIn, userId } = useAuth();
  const { signOut, openUserProfile } = useClerk();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (!isSignedIn) return null;

  const displayName = user?.fullName ?? "Student";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const roleLabel = userRole === "admin" ? "Administrator" : "Student";
  const go = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      // Purge all cached server state so no private data lingers, then land.
      queryClient.clear();
      setOpen(false);
      setLocation("/");
      toast({ title: "Signed out" });
    }
  }

  function openSecurity() {
    setOpen(false);
    // Clerk-hosted account management: password change, sessions, MFA.
    // Passwords never touch ClubHouse code or database.
    openUserProfile();
  }

  const themeRow = (value: string, label: string, Icon: typeof Sun) => {
    const active = theme === value;
    return (
      <button
        key={value}
        onClick={() => setTheme(value)}
        data-testid={`account-theme-${value}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{label}</span>
        {active && <Check className="h-4 w-4 text-primary" />}
      </button>
    );
  };

  const header = (
    <div className="flex items-center gap-3 px-2 py-2">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user?.imageUrl ?? ""} />
        <AvatarFallback className="bg-primary/10 text-primary font-bold">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{roleLabel}{email ? ` · ${email}` : ""}</p>
      </div>
    </div>
  );

  const menuButton =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted";

  const items = (
    <>
      <button className={menuButton} onClick={() => go("/profile/me")} data-testid="account-view-profile">
        <UserRound className="h-4 w-4 text-muted-foreground" /> View Profile
      </button>
      <button className={menuButton} onClick={() => go("/profile/me?edit=1")} data-testid="account-edit-profile">
        <Pencil className="h-4 w-4 text-muted-foreground" /> Edit Profile
      </button>
      <button className={menuButton} onClick={openSecurity} data-testid="account-security">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Account &amp; Security
      </button>
      <button className={menuButton} onClick={() => go("/notifications")} data-testid="account-notifications">
        <Bell className="h-4 w-4 text-muted-foreground" /> Notifications
      </button>
      <button className={menuButton} onClick={() => go("/settings#privacy")} data-testid="account-privacy">
        <Lock className="h-4 w-4 text-muted-foreground" /> Privacy
      </button>
      <button className={menuButton} onClick={() => go("/help")} data-testid="account-help">
        <CircleHelp className="h-4 w-4 text-muted-foreground" /> Help &amp; Support
      </button>
      <button
        className={menuButton}
        onClick={() => {
          setOpen(false);
          setReportOpen(true);
        }}
        data-testid="account-report"
      >
        <Flag className="h-4 w-4 text-muted-foreground" /> Report a Problem
      </button>
      {userRole === "admin" && (
        <button className={menuButton} onClick={() => go("/admin")} data-testid="account-admin">
          <Shield className="h-4 w-4 text-muted-foreground" /> Admin Panel
        </button>
      )}
    </>
  );

  const appearance = (
    <div className="px-1 py-1">
      <p className="flex items-center gap-2 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Palette className="h-3.5 w-3.5" /> Appearance
      </p>
      {themeRow("light", "Light", Sun)}
      {themeRow("dark", "Dark", Moon)}
      {themeRow("system", "System", MonitorSmartphone)}
    </div>
  );

  const trigger = (
    <button
      className="rounded-full outline-none transition ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open account menu"
      data-testid="button-account-menu"
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={user?.imageUrl ?? ""} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </button>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left">Account</SheetTitle>
            </SheetHeader>
            <div className="mt-2">
              {header}
              <div className="my-2 h-px bg-border" />
              {items}
              <div className="my-2 h-px bg-border" />
              {appearance}
              <div className="my-2 h-px bg-border" />
              <button
                onClick={() => void handleSignOut()}
                data-testid="account-sign-out"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64" data-testid="menu-account">
            <DropdownMenuLabel asChild>{header}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => go("/profile/me")} data-testid="account-view-profile">
              <UserRound className="h-4 w-4 text-muted-foreground" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go("/profile/me?edit=1")} data-testid="account-edit-profile">
              <Pencil className="h-4 w-4 text-muted-foreground" /> Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openSecurity} data-testid="account-security">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Account &amp; Security
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go("/notifications")} data-testid="account-notifications">
              <Bell className="h-4 w-4 text-muted-foreground" /> Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go("/settings#privacy")} data-testid="account-privacy">
              <Lock className="h-4 w-4 text-muted-foreground" /> Privacy
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go("/help")} data-testid="account-help">
              <CircleHelp className="h-4 w-4 text-muted-foreground" /> Help &amp; Support
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setReportOpen(true);
              }}
              data-testid="account-report"
            >
              <Flag className="h-4 w-4 text-muted-foreground" /> Report a Problem
            </DropdownMenuItem>
            {userRole === "admin" && (
              <DropdownMenuItem onSelect={() => go("/admin")} data-testid="account-admin">
                <Shield className="h-4 w-4 text-muted-foreground" /> Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid="account-appearance">
                <Palette className="h-4 w-4 text-muted-foreground" /> Appearance
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => setTheme("light")} data-testid="account-theme-light">
                  <Sun className="h-4 w-4 text-muted-foreground" /> Light {theme === "light" && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme("dark")} data-testid="account-theme-dark">
                  <Moon className="h-4 w-4 text-muted-foreground" /> Dark {theme === "dark" && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme("system")} data-testid="account-theme-system">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground" /> System {theme === "system" && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleSignOut()}
              data-testid="account-sign-out"
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {userId && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="profile"
          targetId={userId}
          targetLabel="account problem"
        />
      )}
    </>
  );
}
