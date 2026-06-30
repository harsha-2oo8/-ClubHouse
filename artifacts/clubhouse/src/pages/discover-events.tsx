import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Calendar, Users, ExternalLink, Plus, Filter } from "lucide-react";
import { useListEvents, getListEventsQueryKey, useGetMyProfile, getGetMyProfileQueryKey, useCreateEvent, useRegisterForEvent } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const typeColors: Record<string, string> = {
  hackathon: "bg-purple-500/10 text-purple-700 border-purple-200",
  workshop: "bg-blue-500/10 text-blue-700 border-blue-200",
  seminar: "bg-green-500/10 text-green-700 border-green-200",
  other: "bg-muted text-muted-foreground border-border",
};

const createSchema = z.object({
  title: z.string().min(2, "Title required"),
  description: z.string().optional(),
  type: z.enum(["hackathon", "workshop", "seminar", "other"]),
  visibility: z.enum(["public", "private"]),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().optional(),
  registrationLink: z.string().url().optional().or(z.literal("")),
  maxParticipants: z.coerce.number().int().min(1).optional(),
});

type CreateValues = z.infer<typeof createSchema>;

function EventCard({ event, onRegister }: { event: Record<string, unknown>; onRegister: (id: number) => void }) {
  const start = new Date(String(event.startDate));
  const end = event.endDate ? new Date(String(event.endDate)) : null;
  return (
    <Card
      className="hover:shadow-md hover:border-primary/30 transition-all duration-200 h-full"
      data-testid={`card-event-${event.id}`}
    >
      <CardContent className="p-5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-foreground">{String(event.title)}</h3>
          <Badge className={cn("text-xs flex-shrink-0 border capitalize", typeColors[String(event.type)] ?? "bg-muted")}>
            {String(event.type)}
          </Badge>
        </div>
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{String(event.description)}</p>
        )}
        <div className="space-y-1.5 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {format(start, "MMM d, yyyy")}
              {end && ` – ${format(end, "MMM d, yyyy")}`}
            </span>
          </div>
          {event.collegeName && (
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{String(event.collegeName)}</span>
            </div>
          )}
          {event.maxParticipants && (
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{Number(event.registrantCount ?? 0)} / {Number(event.maxParticipants)} registered</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-auto">
          {event.registrationLink ? (
            <a href={String(event.registrationLink)} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" className="w-full gap-1.5" data-testid={`button-external-register-${event.id}`}>
                Register <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onRegister(Number(event.id))}
              data-testid={`button-register-event-${event.id}`}
            >
              Register
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiscoverEvents() {
  const { isSignedIn } = useAuth();
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: events, isLoading } = useListEvents({ query: { queryKey: getListEventsQueryKey() } });
  const createEvent = useCreateEvent();
  const registerForEvent = useRegisterForEvent();

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", description: "", type: "other", visibility: "public", startDate: "", endDate: "", registrationLink: "" },
  });

  const typedEvents = (events as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string } | null | undefined;

  const filtered = typedEvents.filter(e => typeFilter === "all" || e.type === typeFilter);

  async function handleCreate(values: CreateValues) {
    try {
      await createEvent.mutateAsync({
        data: {
          ...values,
          endDate: values.endDate || undefined,
          registrationLink: values.registrationLink || undefined,
          maxParticipants: values.maxParticipants,
        }
      });
      qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
      toast({ title: "Event created!" });
      setCreateOpen(false);
      form.reset();
    } catch {
      toast({ title: "Error creating event", variant: "destructive" });
    }
  }

  async function handleRegister(eventId: number) {
    if (!isSignedIn) { toast({ title: "Sign in to register" }); return; }
    try {
      await registerForEvent.mutateAsync({ eventId });
      qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
      toast({ title: "Registered!" });
    } catch {
      toast({ title: "Already registered or error occurred", variant: "destructive" });
    }
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Events</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Hackathons, workshops, seminars and more</p>
          </div>
          {isSignedIn && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-event">
                  <Plus className="h-4 w-4" /> Create Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create a new event</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Title</FormLabel><FormControl><Input data-testid="input-event-title" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} className="resize-none" data-testid="input-event-desc" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="hackathon">Hackathon</SelectItem>
                              <SelectItem value="workshop">Workshop</SelectItem>
                              <SelectItem value="seminar">Seminar</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="visibility" render={({ field }) => (
                        <FormItem><FormLabel>Visibility</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="public">Public</SelectItem>
                              <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                      <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="datetime-local" data-testid="input-start-date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem><FormLabel>End Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input type="datetime-local" data-testid="input-end-date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="registrationLink" render={({ field }) => (
                      <FormItem><FormLabel>External Registration Link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input placeholder="https://..." data-testid="input-reg-link" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createEvent.isPending} data-testid="button-submit-event">
                      {createEvent.isPending ? "Creating..." : "Create Event"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mb-6">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48" data-testid="select-type-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="hackathon">Hackathon</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
              <SelectItem value="seminar">Seminar</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No events found</p>
            <p className="text-sm">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(e => <EventCard key={String(e.id)} event={e} onRegister={handleRegister} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
