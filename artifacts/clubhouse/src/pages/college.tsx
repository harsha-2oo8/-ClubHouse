import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import {
  GraduationCap, Users, Folder, Calendar, Settings, UserPlus, Video, Clock,
  ArrowLeft, MapPin, BadgeCheck, Pencil, ExternalLink,
} from "lucide-react";
import {
  useGetCollege, getGetCollegeQueryKey,
  useGetCollegeMembers, getGetCollegeMembersQueryKey,
  useGetCollegeProjects, getGetCollegeProjectsQueryKey,
  useGetCollegeMeetings, getGetCollegeMeetingsQueryKey,
  useGetCollegeJoinRequests, getGetCollegeJoinRequestsQueryKey,
  useUpdateCollegeJoinRequest,
  useGetCollegeClubs, getGetCollegeClubsQueryKey,
  useUpdateCollege,
  useJoinCollege, useApplyForModerator,
  useCreateCollegeMeeting,
  useListEvents, getListEventsQueryKey, useRegisterForEvent,
  useGetMyProfile, getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { RolesTab } from "@/components/roles-tab";
import { ClubCard } from "@/components/social/club-card";
import { SocialEventCard } from "@/components/social/event-card";
import { MemberStack } from "@/components/social/member-stack";
import { EmptyState } from "@/components/social/empty-state";
import { Reveal, Stagger } from "@/components/reveal";
import { UploadButton } from "./clubs";
import { appConfig } from "@/lib/config";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const meetingSchema = z.object({
  title: z.string().min(2, "Title required"),
  description: z.string().optional(),
  meetLink: z.string().url().optional().or(z.literal("")),
  scheduledAt: z.string().min(1, "Date required"),
});

type MeetingValues = z.infer<typeof meetingSchema>;

const roleColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-700 border-red-200",
  moderator: "bg-purple-500/10 text-purple-700 border-purple-200",
  member: "bg-muted text-muted-foreground border-border",
};

const ALL_TABS = ["overview", "clubs", "members", "projects", "events", "meetings", "requests", "roles"] as const;
type TabValue = (typeof ALL_TABS)[number];

/** Resolve stored college imagery: absolute URL as-is, /sb|/gcs paths via API. */
function collegeAsset(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = appConfig.apiUrl.replace(/\/+$/, "");
  const routePath = path.startsWith("/sb/") || path.startsWith("/gcs/")
    ? path.replace(/^\//, "")
    : `objects/${path.replace(/^\/objects\//, "")}`;
  return `${base}/api/storage/${routePath}`;
}

export default function CollegePage() {
  const [, params] = useRoute("/colleges/:collegeId");
  const collegeId = parseInt(params?.collegeId ?? "0");
  const { isSignedIn, userId } = useAuth();
  const [, setLocation] = useLocation();
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: college, isLoading, isError } = useGetCollege(collegeId, { query: { queryKey: getGetCollegeQueryKey(collegeId), enabled: !!collegeId } });
  const { data: members } = useGetCollegeMembers(collegeId, { query: { queryKey: getGetCollegeMembersQueryKey(collegeId), enabled: !!collegeId } });
  const { data: projects } = useGetCollegeProjects(collegeId, { query: { queryKey: getGetCollegeProjectsQueryKey(collegeId), enabled: !!collegeId } });
  const { data: meetings } = useGetCollegeMeetings(collegeId, { query: { queryKey: getGetCollegeMeetingsQueryKey(collegeId), enabled: !!collegeId && !!isSignedIn } });
  const { data: clubs } = useGetCollegeClubs(collegeId, { query: { queryKey: getGetCollegeClubsQueryKey(collegeId), enabled: !!collegeId } });
  const { data: events } = useListEvents({ collegeId }, { query: { queryKey: getListEventsQueryKey({ collegeId }), enabled: !!collegeId } });

  const joinCollege = useJoinCollege();
  const applyModerator = useApplyForModerator();
  const createMeeting = useCreateCollegeMeeting();
  const updateJoinRequest = useUpdateCollegeJoinRequest();
  const updateCollege = useUpdateCollege();
  const registerForEvent = useRegisterForEvent();

  const form = useForm<MeetingValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: { title: "", description: "", meetLink: "", scheduledAt: "" },
  });

  const typedCollege = college as Record<string, unknown> | null | undefined;
  const typedMembers = (members as unknown as Array<Record<string, unknown>>) ?? [];
  const typedProjects = (projects as unknown as Array<Record<string, unknown>>) ?? [];
  const typedMeetings = (meetings as unknown as Array<Record<string, unknown>>) ?? [];
  const typedClubs = (clubs as unknown as Array<Record<string, unknown>>) ?? [];
  const typedEvents = (events as unknown as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string; clerkId?: string } | null | undefined;

  const myMembership = typedMembers.find(m => m.clerkId === userId);
  const isMember = !!myMembership;
  const isModerator = myMembership?.role === "moderator" || myMembership?.role === "admin" || typedProfile?.role === "admin";

  // Tab routing (?tab=): deep-linkable, back/forward friendly.
  const readTab = (): TabValue => {
    if (typeof window === "undefined") return "overview";
    const v = new URLSearchParams(window.location.search).get("tab") ?? "overview";
    return (ALL_TABS as readonly string[]).includes(v) ? (v as TabValue) : "overview";
  };
  const [tab, setTab] = useState<TabValue>(() => readTab());
  useEffect(() => {
    setTab(readTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId]);
  function selectTab(v: string) {
    const next = (ALL_TABS as readonly string[]).includes(v) ? (v as TabValue) : "overview";
    setTab(next);
    setLocation(`/colleges/${collegeId}?tab=${next}`, { replace: true });
  }
  useEffect(() => {
    if ((tab === "requests" || tab === "roles") && !isModerator && !isLoading) setTab("overview");
    if (tab === "meetings" && !isMember && !isLoading) setTab("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModerator, isMember, isLoading]);

  const { data: joinRequests } = useGetCollegeJoinRequests(collegeId, {
    query: { queryKey: getGetCollegeJoinRequestsQueryKey(collegeId), enabled: !!collegeId && !!isModerator },
  });
  const typedJoinRequests = (joinRequests as unknown as Array<Record<string, unknown>>) ?? [];

  async function handleJoinRequest(requestId: number, status: "approved" | "rejected") {
    try {
      await updateJoinRequest.mutateAsync({ collegeId, requestId, data: { status } });
      qc.invalidateQueries({ queryKey: getGetCollegeJoinRequestsQueryKey(collegeId) });
      qc.invalidateQueries({ queryKey: getGetCollegeMembersQueryKey(collegeId) });
      toast({ title: status === "approved" ? "Member approved!" : "Request rejected" });
    } catch {
      toast({ title: "Could not update request", variant: "destructive" });
    }
  }

  async function handleJoin() {
    if (!isSignedIn) { toast({ title: "Sign in to join" }); return; }
    try {
      await joinCollege.mutateAsync({ collegeId });
      qc.invalidateQueries({ queryKey: getGetCollegeMembersQueryKey(collegeId) });
      toast({ title: "Join request sent!", description: "A moderator will review your request." });
    } catch {
      toast({ title: "Error or already requested", variant: "destructive" });
    }
  }

  async function handleApplyModerator() {
    try {
      await applyModerator.mutateAsync({ collegeId, data: { motivation: "I want to help moderate this club." } });
      toast({ title: "Moderator application submitted!" });
    } catch {
      toast({ title: "Error applying", variant: "destructive" });
    }
  }

  async function handleMeeting(values: MeetingValues) {
    try {
      await createMeeting.mutateAsync({
        collegeId,
        data: { ...values, meetLink: values.meetLink || undefined, scheduledAt: new Date(values.scheduledAt).toISOString() },
      });
      qc.invalidateQueries({ queryKey: getGetCollegeMeetingsQueryKey(collegeId) });
      toast({ title: "Meeting scheduled!" });
      setMeetingOpen(false);
      form.reset();
    } catch {
      toast({ title: "Error scheduling meeting", variant: "destructive" });
    }
  }

  async function handleRegisterEvent(eventId: number) {
    if (!isSignedIn) { toast({ title: "Sign in to register" }); return; }
    try {
      await registerForEvent.mutateAsync({ eventId });
      qc.invalidateQueries({ queryKey: getListEventsQueryKey({ collegeId }) });
      toast({ title: "Registered!" });
    } catch {
      toast({ title: "Already registered or event is full", variant: "destructive" });
    }
  }

  // ---- About edit (College Head / platform admin enforced server-side) ----
  const [aboutName, setAboutName] = useState("");
  const [aboutLocation, setAboutLocation] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  const [aboutWebsite, setAboutWebsite] = useState("");
  const [aboutAffiliation, setAboutAffiliation] = useState("");
  const [aboutYear, setAboutYear] = useState("");
  const [aboutLogo, setAboutLogo] = useState<string | null>(null);
  const [aboutBanner, setAboutBanner] = useState<string | null>(null);

  function startAboutEdit() {
    const c = (typedCollege ?? {}) as Record<string, unknown>;
    setAboutName(String(c.name ?? ""));
    setAboutLocation(String(c.location ?? ""));
    setAboutDescription(String(c.description ?? ""));
    setAboutWebsite(String(c.website ?? ""));
    setAboutAffiliation(String(c.affiliation ?? ""));
    setAboutYear(c.establishedYear != null ? String(c.establishedYear) : "");
    setAboutLogo(null);
    setAboutBanner(null);
    setAboutOpen(true);
  }

  async function handleAboutSave() {
    try {
      await updateCollege.mutateAsync({
        collegeId,
        data: {
          name: aboutName.trim() || undefined,
          location: aboutLocation.trim() || undefined,
          description: aboutDescription.trim() || null,
          website: aboutWebsite.trim() || null,
          affiliation: aboutAffiliation.trim() || null,
          establishedYear: aboutYear.trim() ? Number(aboutYear.trim()) : null,
          ...(aboutLogo ? { logoUrl: aboutLogo } : {}),
          ...(aboutBanner ? { bannerUrl: aboutBanner } : {}),
        },
      });
      qc.invalidateQueries({ queryKey: getGetCollegeQueryKey(collegeId) });
      toast({ title: "College updated" });
      setAboutOpen(false);
    } catch {
      toast({ title: "Could not update college", description: "College Head or platform admin only.", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <AppLayout userRole={typedProfile?.role}>
        <div className="mx-auto max-w-6xl">
          <Skeleton className="mb-6 h-52 rounded-3xl" />
          <Skeleton className="mb-6 h-40 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !typedCollege) {
    return (
      <AppLayout userRole={typedProfile?.role}>
        <div className="mx-auto max-w-xl py-16 text-center">
          <h1 className="font-display text-xl font-bold">College not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
          <Link href="/discover/colleges">
            <Button className="mt-5" data-testid="button-back-colleges">Browse colleges</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const banner = collegeAsset(String(typedCollege.bannerUrl ?? "") || null);
  const logo = collegeAsset(String(typedCollege.logoUrl ?? "") || null);
  const verified = String(typedCollege.status ?? "") === "approved";
  const upcoming = [...typedMeetings]
    .filter((m) => new Date(String(m.scheduledAt)).getTime() > Date.now() - 3600000)
    .sort((a, b) => new Date(String(a.scheduledAt)).getTime() - new Date(String(b.scheduledAt)).getTime())
    .slice(0, 3);
  const upcomingEvents = typedEvents
    .filter((e) => new Date(String(e.startDate)).getTime() > Date.now() - 86400000)
    .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime())
    .slice(0, 4);
  const contributors = [...typedMembers]
    .sort((a, b) => {
      const rank = (m: Record<string, unknown>) =>
        String(m.memberType ?? "") === "COLLEGE_HEAD" ? 0
        : ["moderator", "admin"].includes(String(m.role ?? "")) ? 1 : 2;
      return rank(a) - rank(b);
    })
    .slice(0, 6);
  const newMembers = [...typedMembers]
    .sort((a, b) => new Date(String(b.joinedAt ?? 0)).getTime() - new Date(String(a.joinedAt ?? 0)).getTime())
    .slice(0, 4);

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="mx-auto max-w-6xl">
        <Link href="/discover/colleges" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All colleges
        </Link>

        {/* ── HERO: single campus banner ─────────────────────────── */}
        <Reveal>
          <section className="relative overflow-hidden rounded-3xl border border-border/70 shadow-xl" data-testid="college-hero">
            {banner ? (
              <>
                <img src={banner} alt="" className="h-56 w-full object-cover sm:h-64" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
              </>
            ) : (
              <div className="relative h-56 overflow-hidden bg-gradient-to-br from-primary/25 via-background to-accent/20 sm:h-64">
                <div className="motif-grid pointer-events-none absolute inset-0 opacity-60" />
                <div className="animate-drift-a pointer-events-none absolute -left-16 top-8 h-56 w-56 rounded-full bg-ch-violet/20 blur-3xl" />
                <div className="animate-drift-b pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-ch-cyan/20 blur-3xl" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/40 shadow-xl backdrop-blur-md">
                  {logo ? (
                    <img src={logo} alt={`${String(typedCollege.name)} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <GraduationCap className="h-9 w-9 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl" data-testid="text-college-name">
                      {String(typedCollege.name)}
                    </h1>
                    {verified && (
                      <Badge className="gap-1 border-white/20 bg-white/10 text-white backdrop-blur-md" data-testid="badge-college-verified">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {String(typedCollege.location)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {Number(typedCollege.memberCount ?? 0)} members
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Folder className="h-3.5 w-3.5" /> {Number(typedCollege.projectCount ?? 0)} projects
                    </span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  {typedProfile?.role === "admin" && (
                    <Link href="/admin">
                      <Button variant="outline" size="sm" className="gap-2 border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white" data-testid="link-college-admin">
                        <Settings className="h-4 w-4" /> Admin
                      </Button>
                    </Link>
                  )}
                  {isMember && !isModerator && (
                    <Button size="sm" variant="outline" className="gap-2 border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white" onClick={handleApplyModerator} data-testid="button-apply-moderator">
                      Apply as Moderator
                    </Button>
                  )}
                  {!isMember && isSignedIn && (
                    <Button size="sm" className="gap-2" onClick={handleJoin} disabled={joinCollege.isPending} data-testid="button-join-college">
                      <UserPlus className="h-4 w-4" /> {joinCollege.isPending ? "Requesting..." : "Request to Join"}
                    </Button>
                  )}
                  {isModerator && (
                    <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2" data-testid="button-schedule-meeting">
                          <Video className="h-4 w-4" /> Schedule Meeting
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Schedule a Meeting</DialogTitle></DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleMeeting)} className="space-y-4">
                            <FormField control={form.control} name="title" render={({ field }) => (
                              <FormItem><FormLabel>Title</FormLabel><FormControl><Input data-testid="input-meeting-title" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} className="resize-none" data-testid="input-meeting-desc" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="meetLink" render={({ field }) => (
                              <FormItem><FormLabel>Meet Link <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input placeholder="https://meet.google.com/..." data-testid="input-meet-link" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                              <FormItem><FormLabel>Date & Time</FormLabel><FormControl><Input type="datetime-local" data-testid="input-meeting-date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={createMeeting.isPending} data-testid="button-submit-meeting">
                              {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── TABS ───────────────────────────────────────────────── */}
        <Tabs value={tab} onValueChange={selectTab} className="mt-6">
          <TabsList className="mb-6 grid w-full grid-cols-3 sm:inline-flex sm:w-auto" data-testid="tabs-college">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="clubs" className="text-xs sm:text-sm">Clubs</TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">Members ({typedMembers.length})</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs sm:text-sm">Projects ({typedProjects.length})</TabsTrigger>
            <TabsTrigger value="events" className="text-xs sm:text-sm">Events</TabsTrigger>
            {isMember && <TabsTrigger value="meetings" className="text-xs sm:text-sm">Meetings</TabsTrigger>}
            {isModerator && (
              <TabsTrigger value="requests" data-testid="tab-college-requests" className="text-xs sm:text-sm">
                Requests
                {typedJoinRequests.length > 0 && (
                  <Badge className="ml-2 h-5 px-1.5 text-xs">{typedJoinRequests.length}</Badge>
                )}
              </TabsTrigger>
            )}
            {isModerator && (
              <TabsTrigger value="roles" data-testid="tab-college-roles" className="text-xs sm:text-sm">
                Roles &amp; Permissions
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── OVERVIEW ─────────────────────────────────────────── */}
          <TabsContent value="overview">
            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">About {String(typedCollege.name)}</CardTitle>
                    {isModerator && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={startAboutEdit} data-testid="button-edit-college">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {typedCollege.description ? (
                      <p className="leading-relaxed text-foreground/90">{String(typedCollege.description)}</p>
                    ) : (
                      <p className="text-muted-foreground">No description yet.</p>
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 pt-1 sm:grid-cols-2">
                      <div className="flex gap-2">
                        <dt className="font-medium text-foreground">Location:</dt>
                        <dd className="text-muted-foreground">{String(typedCollege.location)}</dd>
                      </div>
                      {typedCollege.affiliation != null && (
                        <div className="flex gap-2">
                          <dt className="font-medium text-foreground">Affiliation:</dt>
                          <dd className="text-muted-foreground">{String(typedCollege.affiliation)}</dd>
                        </div>
                      )}
                      {typedCollege.establishedYear != null && (
                        <div className="flex gap-2">
                          <dt className="font-medium text-foreground">Established:</dt>
                          <dd className="text-muted-foreground">{String(typedCollege.establishedYear)}</dd>
                        </div>
                      )}
                      {Boolean(typedCollege.website) && (
                        <div className="flex gap-2">
                          <dt className="font-medium text-foreground">Website:</dt>
                          <dd>
                            <a href={String(typedCollege.website)} className="inline-flex items-center gap-1 text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                              Visit <ExternalLink className="h-3 w-3" />
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Recent Projects</CardTitle>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => selectTab("projects")} data-testid="link-all-college-projects">
                      See All
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {typedProjects.slice(0, 3).map(p => (
                      <Link key={String(p.id)} href={`/projects/${p.id}`}>
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50" data-testid={`link-project-${p.id}`}>
                          <div className="bg-gradient-violet-cyan flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold text-white">
                            {String(p.title).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{String(p.title)}</p>
                            <p className="text-xs capitalize text-muted-foreground">{String(p.status).replace("_", " ")}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {typedProjects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Clubs</CardTitle>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => selectTab("clubs")} data-testid="link-all-college-clubs">
                      See All
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {typedClubs.slice(0, 3).map(c => (
                      <Link key={String(c.id)} href={`/clubs/${c.id}`}>
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50" data-testid={`link-club-${c.id}`}>
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-sm font-bold text-primary">
                            {String(c.name).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{String(c.name)}</p>
                            <p className="truncate text-xs text-muted-foreground">{String(c.description ?? "")}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {typedClubs.length === 0 && <p className="text-sm text-muted-foreground">No clubs yet.</p>}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Upcoming Events</CardTitle>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => selectTab("events")} data-testid="link-all-college-events">
                      See All
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {upcomingEvents.length === 0 && (
                      <p className="py-2 text-sm text-muted-foreground">Nothing scheduled yet.</p>
                    )}
                    {upcomingEvents.map(e => (
                      <div key={String(e.id)} className="flex items-center gap-3 rounded-lg px-2 py-2">
                        <div className="flex w-11 flex-shrink-0 flex-col items-center rounded-lg bg-muted py-1">
                          <span className="font-display text-base font-bold leading-none">
                            {new Date(String(e.startDate)).getDate()}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">
                            {new Date(String(e.startDate)).toLocaleString(undefined, { month: "short" })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{String(e.title)}</p>
                          <p className="text-xs capitalize text-muted-foreground">{String(e.type)}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {contributors.length === 0 && (
                      <p className="py-2 text-sm text-muted-foreground">No members yet.</p>
                    )}
                    {contributors.map(m => (
                      <Link key={String(m.clerkId)} href={`/profile/${m.clerkId}`}>
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50" data-testid={`contributor-${m.clerkId}`}>
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarImage src={String(m.avatarUrl ?? "")} />
                            <AvatarFallback>{String(m.name ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{String(m.name)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {String(m.memberType ?? "STUDENT")}
                              {Array.isArray(m.assignedRoles) && m.assignedRoles.length > 0 && (
                                <> · {(m.assignedRoles as Array<{ name: string }>).map((r) => r.name).join(", ")}</>
                              )}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">New Members</CardTitle></CardHeader>
                  <CardContent>
                    <MemberStack members={newMembers} size="md" />
                    {newMembers.length === 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">Be the first to join.</p>
                    )}
                  </CardContent>
                </Card>

                {isModerator && (
                  <Card className="border-primary/25">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Admin shortcuts</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {typedJoinRequests.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => selectTab("requests")} data-testid="shortcut-requests">
                          Review requests ({typedJoinRequests.length})
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => selectTab("roles")} data-testid="shortcut-roles">
                        Roles &amp; Permissions
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)} data-testid="shortcut-meeting">
                        Schedule meeting
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="clubs">
            {typedClubs.length === 0 ? (
              <EmptyState
                headline="No clubs yet"
                subline="Clubs created for this college will appear here."
                actionLabel="Browse all clubs"
                actionHref="/clubs"
                testId="empty-college-clubs"
              />
            ) : (
              <Stagger className="grid gap-4 sm:grid-cols-2">
                {typedClubs.map(c => (
                  <Reveal asStaggerItem key={String(c.id)}>
                    <ClubCard club={c} />
                  </Reveal>
                ))}
              </Stagger>
            )}
          </TabsContent>

          <TabsContent value="members">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {typedMembers.map(m => (
                <Link key={String(m.clerkId)} href={`/profile/${m.clerkId}`}>
                  <Card className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm" data-testid={`card-member-${m.clerkId}`}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={String(m.avatarUrl ?? "")} />
                        <AvatarFallback>{String(m.name ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" data-testid={`text-member-name-${m.clerkId}`}>{String(m.name)}</p>
                        <p className="truncate text-xs text-muted-foreground">{String(m.course)}, Sem {String(m.semester)}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {String(m.memberType ?? "STUDENT")}
                          {Array.isArray(m.assignedRoles) && m.assignedRoles.length > 0 && (
                            <> · {(m.assignedRoles as Array<{ name: string }>).map((r) => r.name).join(", ")}</>
                          )}
                          {String(m.memberStatus ?? "VERIFIED") !== "VERIFIED" && (
                            <> · {String(m.memberStatus).toLowerCase()}</>
                          )}
                        </p>
                      </div>
                      <Badge className={cn("flex-shrink-0 border text-xs capitalize", roleColors[String(m.role)] ?? "bg-muted")} data-testid={`badge-role-${m.clerkId}`}>
                        {String(m.role)}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {typedMembers.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No members yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typedProjects.map(p => (
                <Link key={String(p.id)} href={`/projects/${p.id}`}>
                  <Card className="h-full cursor-pointer transition-all hover:border-primary/30 hover:shadow-md" data-testid={`card-project-${p.id}`}>
                    <CardContent className="p-5">
                      <h3 className="mb-1.5 font-semibold">{String(p.title)}</h3>
                      {Boolean(p.description) && <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{String(p.description)}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs capitalize">{String(p.status).replace("_", " ")}</Badge>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {Number(p.memberCount ?? 0)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {typedProjects.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No projects yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="events">
            <div className="space-y-8">
              <div>
                <h3 className="mb-3 font-display text-base font-bold">Upcoming</h3>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events.</p>
                ) : (
                  <Stagger className="grid gap-4 sm:grid-cols-2">
                    {upcomingEvents.map(e => (
                      <Reveal asStaggerItem key={String(e.id)}>
                        <SocialEventCard event={e} onRegister={(eventId) => void handleRegisterEvent(eventId)} />
                      </Reveal>
                    ))}
                  </Stagger>
                )}
              </div>
              {isMember && typedMeetings.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-base font-bold">College meetings</h3>
                  <div className="space-y-3">
                    {typedMeetings.map(m => (
                      <Card key={String(m.id)} data-testid={`card-meeting-${m.id}`}>
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Video className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground">{String(m.title)}</p>
                            {Boolean(m.description) && <p className="line-clamp-1 text-sm text-muted-foreground">{String(m.description)}</p>}
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /> {format(new Date(String(m.scheduledAt)), "MMM d, yyyy 'at' h:mm a")}
                              {Boolean(m.createdByName) && <span className="ml-2">by {String(m.createdByName)}</span>}
                            </p>
                          </div>
                          {Boolean(m.meetLink) && (
                            <a href={String(m.meetLink)} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-join-meeting-${m.id}`}>
                                <Video className="h-4 w-4" /> Join
                              </Button>
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {isModerator && (
            <TabsContent value="requests">
              {typedJoinRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending join requests.</p>
              ) : (
                <div className="space-y-3">
                  {typedJoinRequests.map(r => (
                    <Card key={String(r.id)} data-testid={`card-join-request-${r.id}`}>
                      <CardContent className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" data-testid={`text-request-name-${r.id}`}>{String(r.userName || "Student")}</p>
                          <p className="truncate text-xs text-muted-foreground">{String(r.userEmail || "")}</p>
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 hover:bg-green-700"
                            onClick={() => void handleJoinRequest(Number(r.id), "approved")}
                            disabled={updateJoinRequest.isPending}
                            data-testid={`button-approve-join-${r.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleJoinRequest(Number(r.id), "rejected")}
                            disabled={updateJoinRequest.isPending}
                            data-testid={`button-reject-join-${r.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="meetings">
            <div className="space-y-3">
              {typedMeetings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Video className="mx-auto mb-2 h-10 w-10 opacity-20" />
                  <p>No meetings scheduled yet.</p>
                </div>
              ) : typedMeetings.map(m => (
                <Card key={String(m.id)} data-testid={`card-meeting-${m.id}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{String(m.title)}</p>
                      {Boolean(m.description) && <p className="line-clamp-1 text-sm text-muted-foreground">{String(m.description)}</p>}
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {format(new Date(String(m.scheduledAt)), "MMM d, yyyy 'at' h:mm a")}
                        {Boolean(m.createdByName) && <span className="ml-2">by {String(m.createdByName)}</span>}
                      </p>
                    </div>
                    {Boolean(m.meetLink) && (
                      <a href={String(m.meetLink)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-join-meeting-${m.id}`}>
                          <Video className="h-4 w-4" /> Join
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {isModerator && (
            <TabsContent value="roles">
              <RolesTab collegeId={collegeId} userId={userId ?? null} members={typedMembers} />
            </TabsContent>
          )}
        </Tabs>

        {/* ── About edit dialog (head/platform-admin enforced server-side) ── */}
        <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit college</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Name</label>
                  <Input value={aboutName} onChange={(e) => setAboutName(e.target.value)} data-testid="input-college-name" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Location</label>
                  <Input value={aboutLocation} onChange={(e) => setAboutLocation(e.target.value)} data-testid="input-college-location" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Description</label>
                <Textarea value={aboutDescription} onChange={(e) => setAboutDescription(e.target.value)} rows={3} data-testid="input-college-desc" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Affiliation <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <Input value={aboutAffiliation} onChange={(e) => setAboutAffiliation(e.target.value)} placeholder="e.g. VTU" data-testid="input-college-affiliation" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Established <span className="font-normal text-muted-foreground">(year)</span></label>
                  <Input type="number" min={1700} max={new Date().getFullYear()} value={aboutYear} onChange={(e) => setAboutYear(e.target.value)} placeholder="e.g. 2001" data-testid="input-college-year" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Website <span className="font-normal text-muted-foreground">(optional)</span></label>
                <Input value={aboutWebsite} onChange={(e) => setAboutWebsite(e.target.value)} placeholder="https://…" data-testid="input-college-website" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Logo</p>
                  <UploadButton accept="image/png,image/jpeg,image/webp" label="Upload logo" currentUrl={collegeAsset(String(typedCollege?.logoUrl ?? "") || null)} onUploaded={(path) => setAboutLogo(path)} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Campus banner</p>
                  <UploadButton accept="image/png,image/jpeg,image/webp" label="Upload banner" currentUrl={collegeAsset(String((typedCollege as Record<string, unknown> | null)?.bannerUrl ?? "") || null)} onUploaded={(path) => setAboutBanner(path)} />
                </div>
              </div>
              <Button onClick={() => void handleAboutSave()} disabled={updateCollege.isPending} className="w-full" data-testid="button-save-college">
                {updateCollege.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
