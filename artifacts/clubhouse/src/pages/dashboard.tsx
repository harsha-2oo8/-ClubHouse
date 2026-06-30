import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { LayoutDashboard, TrendingUp, Users, Calendar, Bell, ArrowRight, Folder } from "lucide-react";
import {
  useGetMyProfile, getGetMyProfileQueryKey,
  useGetDashboardStats, getGetDashboardStatsQueryKey,
  useGetDashboardActivity, getGetDashboardActivityQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

function StatCard({ label, value, icon: Icon, href, color }: { label: string; value: number | string; icon: React.ElementType; href?: string; color: string }) {
  const content = (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function Dashboard() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() }
  });

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({
    query: { queryKey: getGetDashboardActivityQueryKey() }
  });

  useEffect(() => {
    if (isSignedIn === false) setLocation("/sign-in");
  }, [isSignedIn, setLocation]);

  useEffect(() => {
    if (profile === null || (profile as Record<string, unknown>)?.error === "Profile not found. Please complete onboarding.") {
      setLocation("/onboarding");
    }
  }, [profile, setLocation]);

  const typedProfile = profile as { name?: string; role?: string } | null | undefined;
  const typedStats = stats as {
    myProjectsCount?: number; myCollegeId?: number; myCollegeName?: string;
    unreadNotifications?: number; upcomingMeetings?: number;
    openProjectsCount?: number; upcomingEvents?: number;
  } | null | undefined;
  const typedActivity = activity as Array<{ id: number; type: string; message: string; linkUrl?: string; createdAt: string }> | null | undefined;

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Greeting */}
        <div className="mb-8">
          {profileLoading ? (
            <Skeleton className="h-9 w-64 mb-2" />
          ) : (
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-greeting">
              Welcome back, {typedProfile?.name?.split(" ")[0] ?? user?.firstName ?? "there"}
            </h1>
          )}
          {typedStats?.myCollegeName ? (
            <p className="text-muted-foreground mt-1">
              Member of{" "}
              <Link href={`/colleges/${typedStats.myCollegeId}`} className="text-primary hover:underline font-medium">
                {typedStats.myCollegeName}
              </Link>
            </p>
          ) : (
            <p className="text-muted-foreground mt-1">
              Not in a college yet?{" "}
              <Link href="/discover/colleges" className="text-primary hover:underline">
                Find your college
              </Link>
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
          ) : (
            <>
              <StatCard
                label="My Projects"
                value={typedStats?.myProjectsCount ?? 0}
                icon={Folder}
                href="/discover"
                color="bg-primary/10 text-primary"
              />
              <StatCard
                label="Open Projects"
                value={typedStats?.openProjectsCount ?? 0}
                icon={TrendingUp}
                href="/discover"
                color="bg-green-500/10 text-green-600"
              />
              <StatCard
                label="Upcoming Events"
                value={typedStats?.upcomingEvents ?? 0}
                icon={Calendar}
                href="/discover/events"
                color="bg-blue-500/10 text-blue-600"
              />
              <StatCard
                label="Notifications"
                value={typedStats?.unreadNotifications ?? 0}
                icon={Bell}
                href="/notifications"
                color="bg-orange-500/10 text-orange-600"
              />
            </>
          )}
        </div>

        {/* Quick actions + Activity */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick actions */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Browse open projects", href: "/discover", icon: TrendingUp },
                  { label: "Find colleges", href: "/discover/colleges", icon: Users },
                  { label: "Upcoming events", href: "/discover/events", icon: Calendar },
                  { label: "My profile", href: "/profile/me", icon: LayoutDashboard },
                ].map((action) => (
                  <Link key={action.href} href={action.href}>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                      data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <action.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{action.label}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Activity feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm" className="text-xs" data-testid="link-all-notifications">
                    View all
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 mb-4">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))
                ) : !typedActivity?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No activity yet. Start exploring!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {typedActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`activity-${item.id}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{item.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {item.linkUrl && (
                          <Link href={item.linkUrl}>
                            <Button variant="ghost" size="sm" className="text-xs flex-shrink-0" data-testid={`link-activity-${item.id}`}>
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
