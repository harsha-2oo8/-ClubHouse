import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { ArrowRight, CalendarDays, Folder, UsersRound } from "lucide-react";
import {
  useListProjects, getListProjectsQueryKey,
  useListClubs, getListClubsQueryKey,
  useListEvents, getListEventsQueryKey,
  useGetMyProfile, getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Creator/host management area: everything the signed-in user owns in one
 * place — projects, clubs and events — with links to manage each.
 */
export default function MySpace() {
  const { isSignedIn, userId } = useAuth();

  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn },
  });
  const typedProfile = profile as { role?: string } | null | undefined;

  const { data: projects, isLoading: projectsLoading } = useListProjects(undefined, {
    query: { queryKey: getListProjectsQueryKey(), enabled: !!isSignedIn },
  });
  const { data: clubs, isLoading: clubsLoading } = useListClubs({
    query: { queryKey: getListClubsQueryKey(), enabled: !!isSignedIn },
  });
  const { data: events, isLoading: eventsLoading } = useListEvents(undefined, {
    query: { queryKey: getListEventsQueryKey(), enabled: !!isSignedIn },
  });

  const myProjects = ((projects as unknown as Array<Record<string, unknown>>) ?? []).filter(
    (p) => p.ownerId === userId,
  );
  const myClubs = ((clubs as unknown as Array<Record<string, unknown>>) ?? []).filter(
    (c) => c.createdBy === userId,
  );
  const myEvents = ((events as unknown as Array<Record<string, unknown>>) ?? []).filter(
    (e) => e.createdBy === userId,
  );
  const loading = projectsLoading || clubsLoading || eventsLoading;

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">My Space</h1>
        <p className="text-muted-foreground text-sm mt-0.5 mb-6">Projects, clubs and events you created</p>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" /> My Projects ({myProjects.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myProjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                )}
                {myProjects.slice(0, 5).map((p) => (
                  <Link key={String(p.id)} href={`/projects/${p.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:border-primary/40" data-testid={`my-project-${p.id}`}>
                      <span className="text-sm font-medium truncate">{String(p.title)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
                <Link href="/discover">
                  <Button variant="outline" size="sm" className="w-full mt-1" data-testid="button-my-new-project">
                    New project
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-primary" /> My Clubs ({myClubs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myClubs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No clubs yet.</p>
                )}
                {myClubs.slice(0, 5).map((c) => (
                  <Link key={String(c.id)} href={`/clubs/${c.id}/admin`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:border-primary/40" data-testid={`my-club-${c.id}`}>
                      <span className="text-sm font-medium truncate">{String(c.name)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
                <Link href="/clubs/register">
                  <Button variant="outline" size="sm" className="w-full mt-1" data-testid="button-my-new-club">
                    New club
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> My Events ({myEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No events yet.</p>
                )}
                {myEvents.slice(0, 5).map((e) => (
                  <div key={String(e.id)} className="rounded-lg border p-3" data-testid={`my-event-${e.id}`}>
                    <p className="text-sm font-medium truncate">{String(e.title)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{String(e.type)}</p>
                  </div>
                ))}
                <Link href="/discover/events">
                  <Button variant="outline" size="sm" className="w-full mt-1" data-testid="button-my-new-event">
                    New event
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
