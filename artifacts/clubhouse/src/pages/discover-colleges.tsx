import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Search, Users, Folder, GraduationCap, Plus } from "lucide-react";
import { useListColleges, getListCollegesQueryKey, useGetMyProfile, getGetMyProfileQueryKey, useRegisterCollege } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  name: z.string().min(2, "College name required"),
  location: z.string().min(2, "Location required"),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
});

type RegisterValues = z.infer<typeof registerSchema>;

function CollegeCard({ college }: { college: Record<string, unknown> }) {
  return (
    <Link href={`/colleges/${college.id}`}>
      <Card
        className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full"
        data-testid={`card-college-${college.id}`}
      >
        <CardContent className="p-5 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{String(college.name)}</h3>
              <p className="text-xs text-muted-foreground truncate">{String(college.location)}</p>
            </div>
          </div>
          {college.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{String(college.description)}</p>
          )}
          <div className="flex items-center gap-4 mt-auto pt-2 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {Number(college.memberCount ?? 0)} members
            </span>
            <span className="flex items-center gap-1">
              <Folder className="h-3.5 w-3.5" /> {Number(college.projectCount ?? 0)} projects
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DiscoverColleges() {
  const { isSignedIn } = useAuth();
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn } });
  const { data: colleges, isLoading } = useListColleges({ query: { queryKey: getListCollegesQueryKey() } });
  const registerCollege = useRegisterCollege();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", location: "", description: "", website: "" },
  });

  const typedColleges = (colleges as Array<Record<string, unknown>>) ?? [];
  const typedProfile = profile as { role?: string } | null | undefined;

  const filtered = typedColleges.filter(c =>
    !search || String(c.name).toLowerCase().includes(search.toLowerCase()) ||
    String(c.location).toLowerCase().includes(search.toLowerCase())
  );

  async function handleRegister(values: RegisterValues) {
    try {
      await registerCollege.mutateAsync({ data: { ...values, website: values.website || undefined } });
      qc.invalidateQueries({ queryKey: getListCollegesQueryKey() });
      toast({ title: "College submitted for review!", description: "An admin will approve it soon." });
      setRegisterOpen(false);
      form.reset();
    } catch {
      toast({ title: "Error submitting college", variant: "destructive" });
    }
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Colleges</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Find and join your college's club community</p>
          </div>
          {isSignedIn && (
            <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-register-college">
                  <Plus className="h-4 w-4" /> Register College
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Register a new college</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Your submission will be reviewed by an admin before going live.</p>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>College Name</FormLabel>
                        <FormControl><Input placeholder="IIT Delhi" data-testid="input-college-name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl><Input placeholder="New Delhi, India" data-testid="input-college-location" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl><Textarea rows={3} className="resize-none" data-testid="input-college-desc" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="website" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl><Input placeholder="https://iitd.ac.in" data-testid="input-college-website" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={registerCollege.isPending} data-testid="button-submit-college">
                      {registerCollege.isPending ? "Submitting..." : "Submit for Review"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search colleges by name or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No colleges found</p>
            <p className="text-sm">Can't find your college? Register it above.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => <CollegeCard key={String(c.id)} college={c} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
