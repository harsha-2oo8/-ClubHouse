import { useState } from "react";
import { useRoute } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { Edit2, ExternalLink, Save, X, Plus, Trash2 } from "lucide-react";
import {
  useGetMyProfile, getGetMyProfileQueryKey,
  useGetUserProfile, getGetUserProfileQueryKey,
  useUpdateMyProfile,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const socialLinks = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "github", label: "GitHub" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "reddit", label: "Reddit" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:userId");
  const { isSignedIn, userId: currentUserId } = useAuth();
  const { user } = useUser();
  const isOwnProfile = !params?.userId || params.userId === "me" || params.userId === currentUserId;
  const targetUserId = isOwnProfile ? "me" : params?.userId ?? "";
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateProfile = useUpdateMyProfile();

  const { data: ownProfile, isLoading: ownLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn && isOwnProfile },
  });

  const { data: otherProfile, isLoading: otherLoading } = useGetUserProfile(targetUserId, {
    query: { queryKey: getGetUserProfileQueryKey(targetUserId), enabled: !isOwnProfile && !!targetUserId },
  });

  const profile = isOwnProfile ? ownProfile : otherProfile;
  const isLoading = isOwnProfile ? ownLoading : otherLoading;
  const typedProfile = profile as Record<string, unknown> | null | undefined;

  const [editForm, setEditForm] = useState({
    bio: "",
    portfolioProjects: [] as Array<{ title: string; url: string; description?: string }>,
    socials: {} as Record<string, string>,
  });

  function startEditing() {
    setEditForm({
      bio: String(typedProfile?.bio ?? ""),
      portfolioProjects: (typedProfile?.portfolioProjects as Array<{ title: string; url: string; description?: string }>) ?? [],
      socials: (typedProfile?.socials as Record<string, string>) ?? {},
    });
    setEditing(true);
  }

  async function saveEdits() {
    try {
      await updateProfile.mutateAsync({
        data: {
          bio: editForm.bio || undefined,
          portfolioProjects: editForm.portfolioProjects,
          socials: editForm.socials,
        },
      });
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      toast({ title: "Profile updated!" });
      setEditing(false);
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    }
  }

  function addPortfolioProject() {
    setEditForm(prev => ({
      ...prev,
      portfolioProjects: [...prev.portfolioProjects, { title: "", url: "", description: "" }],
    }));
  }

  function removePortfolioProject(i: number) {
    setEditForm(prev => ({
      ...prev,
      portfolioProjects: prev.portfolioProjects.filter((_, idx) => idx !== i),
    }));
  }

  const ownProfileData = ownProfile as { role?: string } | null | undefined;

  if (isLoading) {
    return (
      <AppLayout userRole={ownProfileData?.role}>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!typedProfile) {
    return (
      <AppLayout userRole={ownProfileData?.role}>
        <div className="p-6 text-center text-muted-foreground">
          {isOwnProfile ? "Please complete onboarding to view your profile." : "User not found."}
        </div>
      </AppLayout>
    );
  }

  const portfolioProjects = (typedProfile.portfolioProjects as Array<{ title: string; url: string; description?: string }>) ?? [];
  const socials = (typedProfile.socials as Record<string, string>) ?? {};

  return (
    <AppLayout userRole={ownProfileData?.role}>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
          <Avatar className="h-20 w-20 flex-shrink-0 border-2 border-border">
            <AvatarImage src={String(typedProfile.avatarUrl ?? "")} />
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
              {String(typedProfile.name ?? "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-profile-name">{String(typedProfile.name)}</h1>
              <Badge variant="secondary" className="text-xs">{String(typedProfile.pronouns)}</Badge>
              {typedProfile.role === "admin" && <Badge className="text-xs bg-primary text-primary-foreground">Admin</Badge>}
            </div>
            <p className="text-muted-foreground text-sm mb-1">
              {String(typedProfile.course)}, Semester {Number(typedProfile.semester)} · {String(typedProfile.college)}
            </p>
            <p className="text-muted-foreground text-sm">{String(typedProfile.email)}</p>
          </div>
          {isOwnProfile && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={saveEdits} disabled={updateProfile.isPending} className="gap-1.5" data-testid="button-save-profile">
                    <Save className="h-4 w-4" /> {updateProfile.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-1.5" data-testid="button-cancel-edit">
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={startEditing} className="gap-1.5" data-testid="button-edit-profile">
                  <Edit2 className="h-4 w-4" /> Edit Profile
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Bio */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">About</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editForm.bio}
                  onChange={e => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="resize-none"
                  placeholder="Write something about yourself..."
                  data-testid="input-bio"
                />
              ) : typedProfile.bio ? (
                <p className="text-sm text-muted-foreground" data-testid="text-bio">{String(typedProfile.bio)}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No bio yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Portfolio */}
          {(portfolioProjects.length > 0 || editing) && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Portfolio Projects</CardTitle>
                {editing && (
                  <Button size="sm" variant="outline" onClick={addPortfolioProject} className="gap-1.5" data-testid="button-add-portfolio">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? editForm.portfolioProjects.map((p, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-2" data-testid={`card-portfolio-edit-${i}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Project {i + 1}</span>
                      <button type="button" onClick={() => removePortfolioProject(i)} className="text-destructive" data-testid={`button-remove-portfolio-${i}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input
                      placeholder="Title"
                      value={p.title}
                      onChange={e => {
                        const updated = [...editForm.portfolioProjects];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setEditForm(prev => ({ ...prev, portfolioProjects: updated }));
                      }}
                      data-testid={`input-portfolio-title-${i}`}
                    />
                    <Input
                      placeholder="URL"
                      value={p.url}
                      onChange={e => {
                        const updated = [...editForm.portfolioProjects];
                        updated[i] = { ...updated[i], url: e.target.value };
                        setEditForm(prev => ({ ...prev, portfolioProjects: updated }));
                      }}
                      data-testid={`input-portfolio-url-${i}`}
                    />
                    <Input
                      placeholder="Description"
                      value={p.description ?? ""}
                      onChange={e => {
                        const updated = [...editForm.portfolioProjects];
                        updated[i] = { ...updated[i], description: e.target.value };
                        setEditForm(prev => ({ ...prev, portfolioProjects: updated }));
                      }}
                      data-testid={`input-portfolio-desc-${i}`}
                    />
                  </div>
                )) : portfolioProjects.map((p, i) => (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all group"
                    data-testid={`link-portfolio-${i}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">{p.title}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Social links */}
          {(Object.keys(socials).some(k => socials[k]) || editing) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Social Links</CardTitle></CardHeader>
              <CardContent>
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    {socialLinks.map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                        <Input
                          placeholder={key === "whatsapp" ? "+91 98765..." : `https://${key}.com/...`}
                          value={editForm.socials[key] ?? ""}
                          onChange={e => setEditForm(prev => ({ ...prev, socials: { ...prev.socials, [key]: e.target.value } }))}
                          data-testid={`input-social-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.filter(({ key }) => socials[key]).map(({ key, label }) => (
                      <a
                        key={key}
                        href={socials[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-social-${key}`}
                      >
                        <Badge variant="outline" className="gap-1.5 hover:border-primary/50 hover:text-primary transition-colors cursor-pointer">
                          {label} <ExternalLink className="h-3 w-3" />
                        </Badge>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
