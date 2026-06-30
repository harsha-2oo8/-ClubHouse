import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useUser, UserButton } from "@clerk/react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Compass, GraduationCap, Calendar, Bell,
  User, Shield, Menu, X, Sun, Moon, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetUnreadNotificationCount } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/discover/colleges", label: "Colleges", icon: GraduationCap },
  { href: "/discover/events", label: "Events", icon: Calendar },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile/me", label: "My Profile", icon: User },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const { data: count } = useGetUnreadNotificationCount({
    query: { enabled: item.href === "/notifications" }
  });
  const unreadCount = item.href === "/notifications" ? (count as { count?: number })?.count ?? 0 : 0;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/, "-")}`}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <item.icon className="h-4 w-4 flex-shrink-0" />
      <span>{item.label}</span>
      {unreadCount > 0 && (
        <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs min-w-[1.25rem] flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Link>
  );
}

export function AppLayout({ children, userRole }: { children: React.ReactNode; userRole?: string }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user } = useUser();

  const visibleItems = navItems.filter(item => !item.adminOnly || userRole === "admin");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed inset-y-0 z-30">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">CH</span>
          </div>
          <span className="font-bold text-sidebar-foreground text-lg tracking-tight">ClubHouse</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map(item => (
            <NavLink
              key={item.href}
              item={item}
              active={location === item.href || (item.href !== "/" && location.startsWith(item.href) && item.href.length > 1)}
            />
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border flex items-center gap-2">
          <UserButton afterSignOutUrl="/" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.fullName ?? "User"}</p>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar border-b border-sidebar-border flex items-center px-4 py-3 gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">CH</span>
          </div>
          <span className="font-bold text-sidebar-foreground">ClubHouse</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          data-testid="button-mobile-menu"
          className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-sidebar flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">CH</span>
              </div>
              <span className="font-bold text-sidebar-foreground text-lg">ClubHouse</span>
              <button
                className="ml-auto p-1 rounded-lg hover:bg-sidebar-accent"
                onClick={() => setMobileOpen(false)}
                data-testid="button-close-menu"
              >
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {visibleItems.map(item => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={location === item.href}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
            <div className="p-3 border-t border-sidebar-border flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.fullName ?? "User"}</p>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:pl-64 pt-[3.5rem] md:pt-0">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
