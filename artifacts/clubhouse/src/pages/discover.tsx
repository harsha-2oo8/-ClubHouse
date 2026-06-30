import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Search, Filter, Users, Lock, Unlock, Plus, Folder } from "lucide-react";
import { useListProjects, getListProjectsQueryKey, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/10 text-blue-700 border-blue-200",
  active: "bg-green-500/10 text-green-700 border-green-200",
  completed: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const createSchema = z.object({
  title: z.string().min(2, "Title required"),
  description: z.string().optional(),
  techStack: z.string().optional(),
  visibility: z.enum(["public", "private", "college_only"]),
  openForApplications: z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;

function ProjectCard({ project }: { project: Record<string, unknown> }) {
  const roles = (project.requiredRoles as Array<{ role: string }>) ?? [];
  const tech = project.techStack ? String(project.techStack).split(",").map(s => s.trim()).filter(Boolean) : [];
  return (
    <Link href={`/projects/${project.id}`}>
      <Card
        className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full"
        data-testid={`card-project-${project.id}`}
      >
        <CardContent className="p-5 h-full flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-semibold text-foreground line-clamp-2">{String(project.title)}</h3>
            <Badge className={cn("text-xs flex-shrink-0 border", statusColors[String(project.status)] ?? "bg-muted")}>
              {String(project.status).replace("_", " ")}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{String(project.description)}</p>
          )}
          {tech.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tech.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
              {tech.length > 4 && <Badge variant="secondary" className="text-xs">+{tech.length - 4}</Badge>}
            </div>
          )}
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{Number(project.memberCount ?? 0)} members</span>
              {project.collegeName && (
                <span className="text-muted-foreground/60">· {String(project.collegeName)}</span>
              )}
            </div>
            {project.openForApplications ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1">
                <Unlock className="h-3 w-3" /> Open
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <Lock className="h-3 w-3" /> Closed
              </Badge>
            )}
          </div>
          {roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {roles.slice(0, 3).map((r, i) => (
                <Badge key={i} variant="outline" className="text-xs">{r.role}</Badge>
              ))}
              {roles.length > 3 && <Badge variant="outline" className="text-xs">+{roles.length - 3} more roles</Badge>}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Discover() {
  const { isSignedIn } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openFilter, setOpenFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: projects, isLoading } = useListProjects({ query: { queryKey: getListProjectsQueryKey() } });
  const createProject = useCreateProject();

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", description: "", techStack: "", visibility: "public", openForApplications: false },
  });

  const typedProjects = (projects as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string } | null | undefined;

  const filtered = typedProjects.filter(p => {
    if (search && !String(p.title).toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (openFilter === "open" && !p.openForApplications) return false;
    return true;
  });

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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Discover Projects</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Find projects to join or start your own</p>
          </div>
          {isSignedIn && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-project">
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={openFilter} onValueChange={setOpenFilter}>
            <SelectTrigger className="w-40" data-testid="select-open-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="open">Open to Join</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Project grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No projects found</p>
            <p className="text-sm">Try adjusting your filters or start a new project</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => <ProjectCard key={String(p.id)} project={p} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

