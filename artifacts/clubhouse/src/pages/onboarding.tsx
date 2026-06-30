import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ArrowRight, ArrowLeft, User, Briefcase, Link as LinkIcon } from "lucide-react";
import { useUpdateMyProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const step1Schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.coerce.number().int().min(16).max(40),
  course: z.string().min(1, "Course is required"),
  semester: z.coerce.number().int().min(1).max(12),
  college: z.string().min(2, "College name is required"),
  pronouns: z.string().min(1, "Pronouns are required"),
});

const step2Schema = z.object({
  bio: z.string().max(500).optional(),
  portfolioProjects: z.array(z.object({
    title: z.string().min(1, "Title required"),
    url: z.string().url("Enter a valid URL"),
    description: z.string().optional(),
  })),
  socials: z.object({
    linkedin: z.string().url().optional().or(z.literal("")),
    github: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal("")),
    facebook: z.string().url().optional().or(z.literal("")),
    reddit: z.string().url().optional().or(z.literal("")),
    whatsapp: z.string().optional(),
  }),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

const pronounOptions = ["He/Him", "She/Her", "They/Them", "He/They", "She/They", "Any", "Prefer not to say"];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const updateProfile = useUpdateMyProfile();

  const form1 = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: "", age: 19, course: "", semester: 1, college: "", pronouns: "" },
  });

  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { bio: "", portfolioProjects: [], socials: {} },
  });

  const portfolioProjects = form2.watch("portfolioProjects");

  function addProject() {
    form2.setValue("portfolioProjects", [
      ...portfolioProjects,
      { title: "", url: "", description: "" },
    ]);
  }

  function removeProject(index: number) {
    form2.setValue("portfolioProjects", portfolioProjects.filter((_, i) => i !== index));
  }

  function handleStep1(values: Step1Values) {
    setStep1Data(values);
    setStep(2);
  }

  async function handleStep2(values: Step2Values) {
    if (!step1Data) return;
    const cleanSocials = Object.fromEntries(
      Object.entries(values.socials).filter(([, v]) => v && v.trim().length > 0)
    );
    const cleanProjects = values.portfolioProjects.filter(p => p.title && p.url);
    try {
      await updateProfile.mutateAsync({
        data: {
          ...step1Data,
          bio: values.bio || undefined,
          portfolioProjects: cleanProjects.length > 0 ? cleanProjects : undefined,
          socials: Object.keys(cleanSocials).length > 0 ? cleanSocials : undefined,
        },
      });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Error saving profile", description: "Please try again.", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                s === step ? "bg-primary border-primary text-primary-foreground" :
                s < step ? "bg-primary/20 border-primary text-primary" : "bg-muted border-muted-foreground/30 text-muted-foreground"
              )}>
                {s}
              </div>
              <span className={cn("text-sm font-medium hidden sm:block", s === step ? "text-foreground" : "text-muted-foreground")}>
                {s === 1 ? "Basic Info" : "Profile & Links"}
              </span>
              {s < 2 && <div className={cn("h-0.5 flex-1", s < step ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <User className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Tell us about yourself</CardTitle>
              <CardDescription>This is how other students will find and recognize you on ClubHouse.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(handleStep1)} className="space-y-4">
                  <FormField control={form1.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input placeholder="Arjun Sharma" data-testid="input-name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form1.control} name="age" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl><Input type="number" min="16" max="40" data-testid="input-age" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="pronouns" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pronouns</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-pronouns">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {pronounOptions.map(p => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form1.control} name="course" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course / Program</FormLabel>
                      <FormControl><Input placeholder="B.Tech Computer Science" data-testid="input-course" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form1.control} name="semester" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semester</FormLabel>
                        <FormControl><Input type="number" min="1" max="12" data-testid="input-semester" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="college" render={({ field }) => (
                      <FormItem>
                        <FormLabel>College</FormLabel>
                        <FormControl><Input placeholder="IIT Bombay" data-testid="input-college" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" className="w-full gap-2" data-testid="button-next-step1">
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Your work & presence</CardTitle>
              <CardDescription>Optional but highly recommended. Show what you've built and where to find you.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-6">
                  <FormField control={form2.control} name="bio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell other students what you're about — interests, skills, what you're looking to build..."
                          className="resize-none"
                          rows={3}
                          data-testid="input-bio"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Portfolio projects */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium">Portfolio Projects <span className="text-muted-foreground font-normal">(optional)</span></label>
                      <Button type="button" variant="outline" size="sm" onClick={addProject} data-testid="button-add-project">
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                    {portfolioProjects.map((_, i) => (
                      <div key={i} className="border border-border rounded-lg p-4 mb-3 space-y-3" data-testid={`card-portfolio-${i}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Project {i + 1}</span>
                          <button type="button" onClick={() => removeProject(i)} className="text-destructive hover:text-destructive/80" data-testid={`button-remove-project-${i}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <FormField control={form2.control} name={`portfolioProjects.${i}.title`} render={({ field }) => (
                          <FormItem>
                            <FormControl><Input placeholder="Project title" data-testid={`input-project-title-${i}`} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form2.control} name={`portfolioProjects.${i}.url`} render={({ field }) => (
                          <FormItem>
                            <FormControl><Input placeholder="https://github.com/..." data-testid={`input-project-url-${i}`} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form2.control} name={`portfolioProjects.${i}.description`} render={({ field }) => (
                          <FormItem>
                            <FormControl><Input placeholder="Short description" data-testid={`input-project-desc-${i}`} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    ))}
                  </div>

                  {/* Socials */}
                  <div>
                    <label className="text-sm font-medium flex items-center gap-2 mb-3">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" /> Social Links <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["linkedin", "github", "instagram", "facebook", "reddit", "whatsapp"] as const).map((social) => (
                        <FormField key={social} control={form2.control} name={`socials.${social}`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="capitalize text-xs">{social}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={social === "whatsapp" ? "+91 98765..." : `https://${social}.com/...`}
                                data-testid={`input-social-${social}`}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setStep(1)}
                      data-testid="button-back"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 gap-2"
                      disabled={updateProfile.isPending}
                      data-testid="button-finish-onboarding"
                    >
                      {updateProfile.isPending ? "Saving..." : "Go to ClubHouse"} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
