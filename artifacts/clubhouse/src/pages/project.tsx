import { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Users, Send, Calendar, Plus, Lock, Unlock, Video, Clock, ArrowLeft } from "lucide-react";
import {
  useGetProject, getGetProjectQueryKey,
  useGetProjectMembers, getGetProjectMembersQueryKey,
  useGetProjectMessages, getGetProjectMessagesQueryKey,
  useGetProjectEvents, getGetProjectEventsQueryKey,
  useApplyToProject, useSendProjectMessage, useCreateProjectEvent,
  useGetMyProfile, getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/10 text-blue-700 border-blue-200",
  active: "bg-green-500/10 text-green-700 border-green-200",
  completed: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const applySchema = z.object({
  appliedRole: z.string().optional(),
  message: z.string().min(10, "Please write at least 10 characters"),
});

const eventSchema = z.object({
  title: z.string().min(2, "Title required"),
  description: z.string().optional(),
  meetLink: z.string().url().optional().or(z.literal("")),
  scheduledAt: z.string().min(1, "Date required"),
});

type ApplyValues = z.infer<typeof applySchema>;
type EventValues = z.infer<typeof eventSchema>;

export default function ProjectPage() {
  const [, params] = useRoute("/projects/:projectId");
  const projectId = parseInt(params?.projectId ?? "0");
  const { isSignedIn, userId } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: project, isLoading } = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId), enabled: !!projectId } });
  const { data: members } = useGetProjectMembers(projectId, { query: { queryKey: getGetProjectMembersQueryKey(projectId), enabled: !!projectId } });

  const typedMembers = (members as Array<Record<string, unknown>>) ?? [];
  const isMember = typedMembers.some(m => m.clerkId === userId);

  const { data: messages } = useGetProjectMessages(projectId, { query: { queryKey: getGetProjectMessagesQueryKey(projectId), enabled: !!projectId && isMember } });
  const { data: events } = useGetProjectEvents(projectId, { query: { queryKey: getGetProjectEventsQueryKey(projectId), enabled: !!projectId && isMember } });

  const sendMessage = useSendProjectMessage();
  const applyToProject = useApplyToProject();
  const createEvent = useCreateProjectEvent();

  const applyForm = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    defaultValues: { appliedRole: "", message: "" },
  });

  const eventForm = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", description: "", meetLink: "", scheduledAt: "" },
  });

  const typedProject = project as Record<string, unknown> | null | undefined;
  const typedMessages = (messages as Array<Record<string, unknown>>) ?? [];
  const typedEvents = (events as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string } | null | undefined;
  const tech = typedProject?.techStack ? String(typedProject.techStack).split(",").map(s => s.trim()).filter(Boolean) : [];
  const requiredRoles = (typedProject?.requiredRoles as Array<{ id: number; role: string; description?: string }>) ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [typedMessages.length]);

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    try {
      await sendMessage.mutateAsync({ projectId, data: { content: newMessage.trim() } });
      qc.invalidateQueries({ queryKey: getGetProjectMessagesQueryKey(projectId) });
      setNewMessage("");
    } catch {
      toast({ title: "Error sending message", variant: "destructive" });
    }
  }

  async function handleApply(values: ApplyValues) {
    try {
      await applyToProject.mutateAsync({ projectId, data: values });
      toast({ title: "Application sent!" });
      setApplyOpen(false);
    } catch {
      toast({ title: "Already applied or error", variant: "destructive" });
    }
  }

  async function handleCreateEvent(values: EventValues) {
    try {
      await createEvent.mutateAsync({
        projectId,
        data: { ...values, meetLink: values.meetLink || undefined, scheduledAt: new Date(values.scheduledAt).toISOString() },
      });
      qc.invalidateQueries({ queryKey: getGetProjectEventsQueryKey(projectId) });
      toast({ title: "Meeting scheduled!" });
      setEventOpen(false);
      eventForm.reset();
    } catch {
      toast({ title: "Error scheduling meeting", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <AppLayout userRole={typedProfile?.role}>
        <div className="p-6 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-48 rounded-xl mb-6" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!typedProject) {
    return (
      <AppLayout userRole={typedProfile?.role}>
        <div className="p-6 text-center text-muted-foreground">Project not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back */}
        <Link href="/discover">
          <Button variant="ghost" size="sm" className="gap-2 mb-4 -ml-2 text-muted-foreground" data-testid="link-back-discover">
            <ArrowLeft className="h-4 w-4" /> Back to Discover
          </Button>
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-project-title">{String(typedProject.title)}</h1>
              <Badge className={cn("text-xs border", statusColors[String(typedProject.status)] ?? "bg-muted")}>
                {String(typedProject.status).replace("_", " ")}
              </Badge>
              {typedProject.openForApplications ? (
                <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1">
                  <Unlock className="h-3 w-3" /> Open
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> Closed
                </Badge>
              )}
            </div>
            {typedProject.description && (
              <p className="text-muted-foreground mb-3">{String(typedProject.description)}</p>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {tech.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {Number(typedProject.memberCount ?? 0)} members</span>
              <span>by {String(typedProject.ownerName)}</span>
              {typedProject.collegeName && <span>at {String(typedProject.collegeName)}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!isMember && typedProject.openForApplications && isSignedIn && (
              <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-apply-project">
                    <Plus className="h-4 w-4" /> Apply to Join
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Apply to Join</DialogTitle></DialogHeader>
                  <Form {...applyForm}>
                    <form onSubmit={applyForm.handleSubmit(handleApply)} className="space-y-4">
                      {requiredRoles.length > 0 && (
                        <FormField control={applyForm.control} name="appliedRole" render={({ field }) => (
                          <FormItem><FormLabel>Role you're applying for</FormLabel>
                            <FormControl><Input placeholder="e.g. Frontend Developer" data-testid="input-applied-role" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={applyForm.control} name="message" render={({ field }) => (
                        <FormItem><FormLabel>Why do you want to join?</FormLabel>
                          <FormControl><Textarea rows={4} className="resize-none" placeholder="Tell the project owner about yourself and why you'd be a great fit..." data-testid="input-apply-message" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={applyToProject.isPending} data-testid="button-submit-application">
                        {applyToProject.isPending ? "Sending..." : "Submit Application"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Required roles */}
        {requiredRoles.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3"><CardTitle className="text-base">Looking For</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {requiredRoles.map(r => (
                  <div key={r.id} className="border border-border rounded-lg px-3 py-2" data-testid={`badge-role-${r.id}`}>
                    <p className="font-medium text-sm">{r.role}</p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={isMember ? "chat" : "members"}>
          <TabsList className="mb-6">
            <TabsTrigger value="members">Members ({typedMembers.length})</TabsTrigger>
            {isMember && <TabsTrigger value="chat">Chat</TabsTrigger>}
            {isMember && <TabsTrigger value="events">Meetings ({typedEvents.length})</TabsTrigger>}
          </TabsList>

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
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{String(m.name)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{String(m.role)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          {isMember && (
            <TabsContent value="chat">
              <Card className="flex flex-col h-[500px]">
                <CardHeader className="pb-3 border-b flex-shrink-0">
                  <CardTitle className="text-base">Project Chat</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {typedMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No messages yet. Start the conversation!</p>
                    </div>
                  ) : typedMessages.map(msg => (
                    <div key={String(msg.id)} className={cn("flex gap-3", msg.userId === userId ? "flex-row-reverse" : "")} data-testid={`message-${msg.id}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={String(msg.avatarUrl ?? "")} />
                        <AvatarFallback className="text-xs">{String(msg.userName ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className={cn("max-w-[70%]", msg.userId === userId ? "items-end" : "items-start")} style={{ display: "flex", flexDirection: "column" }}>
                        <div className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm",
                          msg.userId === userId
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm"
                        )}>
                          {String(msg.content)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {msg.userId !== userId && <span className="font-medium mr-1">{String(msg.userName)}</span>}
                          {formatDistanceToNow(new Date(String(msg.createdAt)), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </CardContent>
                <div className="p-3 border-t flex gap-2 flex-shrink-0">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    className="flex-1"
                    data-testid="input-message"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}

          {isMember && (
            <TabsContent value="events">
              <div className="flex justify-end mb-4">
                <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-schedule-project-meeting">
                      <Plus className="h-4 w-4" /> Schedule Meeting
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Schedule a Project Meeting</DialogTitle></DialogHeader>
                    <Form {...eventForm}>
                      <form onSubmit={eventForm.handleSubmit(handleCreateEvent)} className="space-y-4">
                        <FormField control={eventForm.control} name="title" render={({ field }) => (
                          <FormItem><FormLabel>Title</FormLabel><FormControl><Input data-testid="input-event-title" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={eventForm.control} name="description" render={({ field }) => (
                          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} className="resize-none" data-testid="input-event-desc" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={eventForm.control} name="meetLink" render={({ field }) => (
                          <FormItem><FormLabel>Meet Link</FormLabel><FormControl><Input placeholder="https://meet.google.com/..." data-testid="input-meet-link" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={eventForm.control} name="scheduledAt" render={({ field }) => (
                          <FormItem><FormLabel>Date & Time</FormLabel><FormControl><Input type="datetime-local" data-testid="input-event-date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={createEvent.isPending} data-testid="button-submit-event">
                          {createEvent.isPending ? "Scheduling..." : "Schedule"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3">
                {typedEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No meetings scheduled yet.</p>
                  </div>
                ) : typedEvents.map(e => (
                  <Card key={String(e.id)} data-testid={`card-event-${e.id}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{String(e.title)}</p>
                        {e.description && <p className="text-sm text-muted-foreground line-clamp-1">{String(e.description)}</p>}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> {format(new Date(String(e.scheduledAt)), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      {e.meetLink && (
                        <a href={String(e.meetLink)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-join-meeting-${e.id}`}>
                            <Video className="h-4 w-4" /> Join
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
