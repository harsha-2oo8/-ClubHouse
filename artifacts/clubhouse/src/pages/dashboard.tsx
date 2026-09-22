import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Bell, CalendarDays, Check, FolderKanban, Sparkles, TrendingUp, Users } from "lucide-react";
import {
  useGetMyProfile, getGetMyProfileQueryKey,
  useGetDashboardStats, getGetDashboardStatsQueryKey,
  useGetDashboardActivity, getGetDashboardActivityQueryKey,
  useListProjects, getListProjectsQueryKey,
  useListEvents, getListEventsQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/social/section-heading";
import { Reveal, Stagger } from "@/components/reveal";
import { recommendProjects } from "@/lib/matching";
import type { MatchableProject } from "@/lib/matching";
import { formatDistanceToNow } from "date-fns";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { isSignedIn, userId } = useAuth();
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
  const { data: projects } = useListProjects(undefined, {
    query: { queryKey: getListProjectsQueryKey(), enabled: !!isSignedIn },
  });
  const { data: events } = useListEvents(undefined, {
    query: { queryKey: getListEventsQueryKey(), enabled: !!isSignedIn },
  });

  useEffect(() => {
    if (isSignedIn === false) setLocation("/sign-in");
  }, [isSignedIn, setLocation]);

  useEffect(() => {
    if (profile === null || (profile as unknown as Record<string, unknown>)?.error === "Profile not found. Please complete onboarding.") {
      setLocation("/onboarding");
    }
  }, [profile, setLocation]);

  const typedProfile = profile as { name?: string; role?: string; bio?: string; course?: string; college?: string } | null | undefined;
  const typedStats = stats as {
    myProjectsCount?: number; myCollegeId?: number; myCollegeName?: string;
    unreadNotifications?: number; upcomingMeetings?: number;
    openProjectsCount?: number; upcomingEvents?: number;
  } | null | undefined;
  const typedActivity = activity as Array<{ id: number; type: string; message: string; linkUrl?: string; createdAt: string }> | null | undefined;

  const allProjects = ((projects as unknown as MatchableProject[]) ?? []);
  const myProjects = allProjects.filter((p) => p.ownerId === userId);
  const upcomingEvents = ((events as unknown as Array<Record<string, unknown>>) ?? [])
    .filter((e) => new Date(String(e.startDate)).getTime() > Date.now() - 86400000)
    .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime())
    .slice(0, 3);
  const matches = recommendProjects(
    allProjects,
    { bio: typedProfile?.bio, course: typedProfile?.course, college: typedProfile?.college },
    userId ?? null,
  );

  const firstName = typedProfile?.name?.split(" ")[0] ?? user?.firstName ?? "there";

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="mx-auto max-w-6xl">
        {/* Greeting */}
        <div className="mb-7">
          {profileLoading ? (
            <Skeleton className="h-10 w-72" />
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              data-testid="text-dashboard-greeting"
            >
              {greeting()}, {firstName}
            </motion.h1>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {typedStats?.myCollegeName ? (
              <>Here&apos;s what&apos;s happening around <Link href={`/colleges/${typedStats.myCollegeId}`} className="font-medium text-primary hover:underline">{typedStats.myCollegeName}</Link></>
            ) : (
              <>Not in a college yet? <Link href="/discover/colleges" className="font-medium text-primary hover:underline">Find your college</Link></>
            )}
          </p>
        </div>

        {/* Pulse strip — real numbers only */}
        <Stagger className="mb-8 flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {[
            { label: "My projects", value: typedStats?.myProjectsCount ?? 0, href: "/my", icon: FolderKanban, cls: "text-ch-violet" },
            { label: "Open projects", value: typedStats?.openProjectsCount ?? 0, href: "/discover", icon: TrendingUp, cls: "text-ch-lime" },
            { label: "Upcoming events", value: typedStats?.upcomingEvents ?? 0, href: "/discover/events", icon: CalendarDays, cls: "text-ch-cyan" },
            { label: "Unread", value: typedStats?.unreadNotifications ?? 0, href: "/notifications", icon: Bell, cls: "text-ch-coral" },
          ].map((s) => (
            <Reveal asStaggerItem key={s.label}>
              <Link href={s.href}>
                <div className="flex min-w-[10.5rem] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5" data-testid={`card-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <s.icon className={`h-5 w-5 ${s.cls}`} />
                  <div>
                    <p className="font-display text-xl font-bold leading-none text-foreground">
                      {statsLoading ? "–" : s.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </Stagger>

        {/* YOUR WORLD */}
        <Reveal>
          <SectionHeading kicker="Your world" title="Happening around you" />
        </Reveal>
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upcoming</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {upcomingEvents.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nothing scheduled — check events.</p>
                )}
                {upcomingEvents.map((e) => (
                  <div key={String(e.id)} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60">
                    <div className="flex w-11 flex-shrink-0 flex-col items-center rounded-lg bg-muted py-1">
                      <span className="font-display text-base font-bold leading-none">{new Date(String(e.startDate)).getDate()}</span>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {new Date(String(e.startDate)).toLocaleString(undefined, { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{String(e.title)}</p>
                      <p className="text-xs capitalize text-muted-foreground">{String(e.type)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Reveal>
          <Reveal>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">My active projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {myProjects.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No projects yet. <Link href="/discover?create=1" className="font-medium text-primary hover:underline">Start one</Link>
                  </p>
                )}
                {myProjects.slice(0, 4).map((p) => (
                  <Link key={String(p.id)} href={`/projects/${p.id}`}>
                    <div className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60">
                      <span className="h-9 w-1.5 flex-shrink-0 rounded-full bg-gradient-violet-cyan" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{String(p.title)}</p>
                        <p className="text-xs text-muted-foreground">
                          {Array.isArray(p.requiredRoles) && p.requiredRoles.length > 0
                            ? `${p.requiredRoles.length} open role${p.requiredRoles.length > 1 ? "s" : ""}`
                            : String(p.status ?? "").replace("_", " ")}
                        </p>
                      </div>
                      <Users className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </div>

        {/* YOU MIGHT LIKE */}
        {matches.length > 0 && (
          <div className="mt-8">
            <Reveal>
              <SectionHeading kicker="You might like" kickerClass="text-ch-pink" title="Matched to you" actionLabel="All projects" actionHref="/discover" />
            </Reveal>
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <Reveal asStaggerItem key={String(m.project.id)}>
                  <Link href={`/projects/${m.project.id}`}>
                    <div className="h-full cursor-pointer rounded-2xl border border-border bg-card p-4 transition-shadow hover:glow-violet" data-testid={`match-${m.project.id}`}>
                      <p className="font-display text-sm font-bold">{String(m.project.title)}</p>
                      <ul className="mt-2 space-y-1">
                        {m.reasons.slice(0, 2).map((r) => (
                          <li key={r} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Check className="mt-px h-3.5 w-3.5 flex-shrink-0 text-green-600" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </Stagger>
          </div>
        )}

        {/* ACTIVITY */}
        <div className="mt-8">
          <Reveal>
            <SectionHeading kicker="Activity" title="Latest updates" actionLabel="View all" actionHref="/notifications" />
          </Reveal>
          <Card>
            <CardContent className="pt-4">
              {activityLoading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : !typedActivity?.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Quiet for now — activity lands here.</p>
              ) : (
                <div className="space-y-1">
                  {typedActivity.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60" data-testid={`activity-${item.id}`}>
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bell className="h-4 w-4 text-primary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{item.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {Boolean(item.linkUrl) && (
                        <Link href={String(item.linkUrl)}>
                          <Button variant="ghost" size="sm" className="flex-shrink-0 text-xs" data-testid={`link-activity-${item.id}`}>
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
    </AppLayout>
  );
}
