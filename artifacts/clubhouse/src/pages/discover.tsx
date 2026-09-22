import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Plus, Search } from "lucide-react";
import { useListProjects, getListProjectsQueryKey, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ProjectCard } from "@/components/social/project-card";
import { DiscoverTabs } from "@/components/social/discover-tabs";
import { FilterPill } from "@/components/social/filter-pill";
import { EmptyState } from "@/components/social/empty-state";
import { Reveal, Stagger } from "@/components/reveal";

const createSchema = z.object({
  title: z.string().min(2, "Title required"),
  description: z.string().optional(),
  techStack: z.string().optional(),
  visibility: z.enum(["public", "private", "college_only"]),
  openForApplications: z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;
type QuickFilter = "all" | "open" | "mine" | "active";

export default function Discover() {
  const { isSignedIn } = useAuth();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: projects, isLoading } = useListProjects(undefined, { query: { queryKey: getListProjectsQueryKey() } });
  const createProject = useCreateProject();

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", description: "", techStack: "", visibility: "public", openForApplications: false },
  });

  const typedProjects = (projects as unknown as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string; college?: string } | null | undefined;
  const myCollege = typedProfile?.college ?? "";

  // Deep link: /discover?create=1 opens the composer (global Create menu).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("create") === "1") {
      setCreateOpen(true);
    }
  }, []);

  const filtered = typedProjects.filter((p) => {
    if (search && !`${p.title ?? ""} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (quick === "open" && !p.openForApplications) return false;
    if (quick === "active" && p.status !== "active") return false;
    if (quick === "mine" && myCollege && String(p.collegeName ?? "") !== myCollege) return false;
    return true;
  });
  const [featured, ...rest] = filtered;

  async function handleCreate(values: CreateValues) {
    try {
      await createProject.mutateAsync({ data: values });
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "Project created!" });
      setCreateOpen(false);
      form.reset();
    } catch {
      toast({ title: "Error creating project", variant: "destructive" });
    }
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ch-violet">Discover</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            What are you looking for?
          </h1>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="relative mt-5">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects, tech, ideas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-13 rounded-2xl border-border bg-card py-3.5 pl-11 text-base shadow-sm"
              data-testid="input-search"
            />
          </div>
        </Reveal>

        <div className="mt-5">
          <DiscoverTabs />
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {(
            [
              ["all", "All"],
              ["open", "Open roles"],
              ["mine", "My college"],
              ["active", "Active now"],
            ] as Array<[QuickFilter, string]>
          ).map(([value, label]) => (
            <FilterPill key={value} active={quick === value} onClick={() => setQuick(value)} testId={`pill-${value}`}>
              {label}
            </FilterPill>
          ))}
          <div className="ml-auto flex-shrink-0">
            {isSignedIn && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-full" data-testid="button-create-project">
                    <Plus className="h-4 w-4" /> New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Start a new project</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Title</FormLabel>
                          <FormControl><Input placeholder="My Awesome Project" data-testid="input-project-title" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl><Textarea rows={3} className="resize-none" data-testid="input-project-desc" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="techStack" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tech Stack <span className="text-muted-foreground font-normal">(comma separated)</span></FormLabel>
                          <FormControl><Input placeholder="React, Node.js, PostgreSQL" data-testid="input-tech-stack" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="visibility" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Visibility</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-visibility">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">Public</SelectItem>
                              <SelectItem value="college_only">College Only</SelectItem>
                              <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createProject.isPending} data-testid="button-submit-project">
                        {createProject.isPending ? "Creating..." : "Create Project"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              headline="Nothing matches those filters"
              subline="Try a different search — or start the project you wish existed."
              actionLabel="Start a project"
              actionHref="/discover?create=1"
              testId="empty-projects"
            />
          </div>
        ) : (
          <div className="mt-6">
            {featured && (
              <Reveal className="mb-4">
                <ProjectCard project={featured} featured />
              </Reveal>
            )}
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Reveal asStaggerItem key={String(p.id)}>
                  <ProjectCard project={p} />
                </Reveal>
              ))}
            </Stagger>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
