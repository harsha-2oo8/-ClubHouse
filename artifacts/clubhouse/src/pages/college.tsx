import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { GraduationCap, Users, Folder, Calendar, Settings, UserPlus, Video, Clock, ArrowLeft } from "lucide-react";
import {
  useGetCollege, getGetCollegeQueryKey,
  useGetCollegeMembers, getGetCollegeMembersQueryKey,
  useGetCollegeProjects, getGetCollegeProjectsQueryKey,
  useGetCollegeMeetings, getGetCollegeMeetingsQueryKey,
  useJoinCollege, useApplyForModerator,
  useCreateCollegeMeeting,
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

export default function CollegePage() {
  const [, params] = useRoute("/colleges/:collegeId");
  const collegeId = parseInt(params?.collegeId ?? "0");
  const { isSignedIn, userId } = useAuth();
  const [meetingOpen, setMeetingOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: college, isLoading } = useGetCollege(collegeId, { query: { queryKey: getGetCollegeQueryKey(collegeId), enabled: !!collegeId } });
  const { data: members } = useGetCollegeMembers(collegeId, { query: { queryKey: getGetCollegeMembersQueryKey(collegeId), enabled: !!collegeId } });
  const { data: projects } = useGetCollegeProjects(collegeId, { query: { queryKey: getGetCollegeProjectsQueryKey(collegeId), enabled: !!collegeId } });
  const { data: meetings } = useGetCollegeMeetings(collegeId, { query: { queryKey: getGetCollegeMeetingsQueryKey(collegeId), enabled: !!collegeId && !!isSignedIn } });

  const joinCollege = useJoinCollege();
  const applyModerator = useApplyForModerator();
  const createMeeting = useCreateCollegeMeeting();

  const form = useForm<MeetingValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: { title: "", description: "", meetLink: "", scheduledAt: "" },
  });

  const typedCollege = college as Record<string, unknown> | null | undefined;
  const typedMembers = (members as Array<Record<string, unknown>>) ?? [];
  const typedProjects = (projects as Array<Record<string, unknown>>) ?? [];
  const typedMeetings = (meetings as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string; clerkId?: string } | null | undefined;

  const myMembership = typedMembers.find(m => m.clerkId === userId);
  const isMember = !!myMembership;
  const isModerator = myMembership?.role === "moderator" || myMembership?.role === "admin" || typedProfile?.role === "admin";

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

  if (isLoading) {
    return (
      <AppLayout userRole={typedProfile?.role}>
        <div className="p-6 max-w-6xl mx-auto">
          <Skeleton className="h-40 rounded-xl mb-6" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!typedCollege) {
    return (
      <AppLayout userRole={typedProfile?.role}>
        <div className="p-6 text-center text-muted-foreground">College not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-6xl mx-auto">
        {/* College header */}
        <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-college-name">{String(typedCollege.name)}</h1>
              <Badge variant="secondary">{String(typedCollege.location)}</Badge>
            </div>
            {typedCollege.description && (
              <p className="text-muted-foreground text-sm mb-3">{String(typedCollege.description)}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {Number(typedCollege.memberCount ?? 0)} members</span>
              <span className="flex items-center gap-1.5"><Folder className="h-4 w-4" /> {Number(typedCollege.projectCount ?? 0)} projects</span>
              {typedCollege.website && (
                <a href={String(typedCollege.website)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Website</a>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {typedProfile?.role === "admin" && (
              <Link href={`/colleges/${collegeId}/admin`}>
                <Button variant="outline" size="sm" className="gap-2" data-testid="link-college-admin">
                  <Settings className="h-4 w-4" /> Admin
                </Button>
              </Link>
            )}
            {isMember && !isModerator && (
              <Button variant="outline" size="sm" onClick={handleApplyModerator} data-testid="button-apply-moderator">
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
                        <FormItem><FormLabel>Meet Link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input placeholder="https://meet.google.com/..." data-testid="input-meet-link" {...field} /></FormControl><FormMessage /></FormItem>
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

        <Tabs defaultValue="overview">
          <TabsList className="mb-6" data-testid="tabs-college">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members ({typedMembers.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({typedProjects.length})</TabsTrigger>
            {isMember && <TabsTrigger value="meetings">Meetings</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">About</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  {typedCollege.description
                    ? <p>{String(typedCollege.description)}</p>
                    : <p>No description yet.</p>}
                  <p><span className="font-medium text-foreground">Location:</span> {String(typedCollege.location)}</p>
                  {typedCollege.website && (
                    <p><span className="font-medium text-foreground">Website:</span>{" "}
                      <a href={String(typedCollege.website)} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                        {String(typedCollege.website)}
                      </a>
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Recent Projects</CardTitle></CardHeader>
                <CardContent>
                  {typedProjects.slice(0, 3).map(p => (
                    <Link key={String(p.id)} href={`/projects/${p.id}`}>
                      <div className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors" data-testid={`link-project-${p.id}`}>
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Folder className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{String(p.title)}</p>
                          <p className="text-xs text-muted-foreground">{String(p.status)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {typedProjects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {typedMembers.map(m => (
                <Link key={String(m.clerkId)} href={`/profile/${m.clerkId}`}>
                  <Card className="hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer" data-testid={`card-member-${m.clerkId}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={String(m.avatarUrl ?? "")} />
                        <AvatarFallback>{String(m.name ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate" data-testid={`text-member-name-${m.clerkId}`}>{String(m.name)}</p>
                        <p className="text-xs text-muted-foreground truncate">{String(m.course)}, Sem {m.semester}</p>
                      </div>
                      <Badge className={cn("text-xs border capitalize flex-shrink-0", roleColors[String(m.role)] ?? "bg-muted")} data-testid={`badge-role-${m.clerkId}`}>
                        {String(m.role)}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {typedMembers.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No members yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {typedProjects.map(p => (
                <Link key={String(p.id)} href={`/projects/${p.id}`}>
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full" data-testid={`card-project-${p.id}`}>
                    <CardContent className="p-5">
                      <h3 className="font-semibold mb-1.5">{String(p.title)}</h3>
                      {p.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{String(p.description)}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">{String(p.status)}</Badge>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {Number(p.memberCount ?? 0)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {typedProjects.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No projects yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="meetings">
            <div className="space-y-3">
              {typedMeetings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>No meetings scheduled yet.</p>
                </div>
              ) : typedMeetings.map(m => (
                <Card key={String(m.id)} data-testid={`card-meeting-${m.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{String(m.title)}</p>
                      {m.description && <p className="text-sm text-muted-foreground line-clamp-1">{String(m.description)}</p>}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> {format(new Date(String(m.scheduledAt)), "MMM d, yyyy 'at' h:mm a")}
                        {m.createdByName && <span className="ml-2">by {String(m.createdByName)}</span>}
                      </p>
                    </div>
                    {m.meetLink && (
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
        </Tabs>
      </div>
    </AppLayout>
  );
}

