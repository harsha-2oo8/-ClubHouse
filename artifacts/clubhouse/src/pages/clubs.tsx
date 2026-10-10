import { useEffect, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClubs, useGetClub, getGetClubQueryKey, getListClubsQueryKey,
  useCreateClub, useUpdateClub, useCreateClubMember, useDeleteClubMember,
  useCreateClubEvent, useUpdateClubEvent, useDeleteClubEvent, useDeleteClub,
  useGetMyProfile, getGetMyProfileQueryKey, useSearchUsers, getSearchUsersQueryKey,
  useJoinClub, useListClubJoinRequests, getListClubJoinRequestsQueryKey,
  useUpdateClubJoinRequest,
} from "@workspace/api-client-react";
import { DeleteConfirm } from "@/components/delete-confirm";
import { ReportDialog } from "@/components/report-dialog";
import { DiscoverTabs } from "@/components/social/discover-tabs";
import type { Club, ClubMember, ClubManagementEvent } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { appConfig } from "@/lib/config";
import { ArrowLeft, CalendarDays, ExternalLink, FileText, Flag, ImagePlus, Pencil, Plus, Settings, Trash2, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function assetUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  // Same-origin in single-host dev; absolute API base in split prod deploys.
  // Stored objectPaths (/sb/…, /gcs/…) map onto their serving routes;
  // legacy /objects/… values keep working where that backend exists.
  const base = appConfig.apiUrl.replace(/\/+$/, "");
  const routePath = path.startsWith("/sb/") || path.startsWith("/gcs/")
    ? path.replace(/^\//, "")
    : `objects/${path.replace(/^\/objects\//, "")}`;
  return `${base}/api/storage/${routePath}`;
}

function UploadButton({ accept, label, onUploaded, currentUrl }: {
  accept: string;
  label: string;
  onUploaded: (path: string, name: string) => void;
  /** Already-saved image URL to preview (e.g. existing logo); hidden once a new file is picked. */
  currentUrl?: string | null;
}) {
  // Uploads must target the API origin, not the Vercel static host:
  // same-origin /api/* on Vercel answers 405 (no such route exists there).
  const apiBase = appConfig.apiUrl.replace(/\/+$/, "");
  const { uploadFile, isUploading } = useUpload({ basePath: `${apiBase}/api/storage` });
  const { toast } = useToast();
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const shownImage = preview && preview.type.startsWith("image/") ? preview.url : (!preview && currentUrl ? currentUrl : null);

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
      {shownImage ? (
        <img src={shownImage} alt="" className="h-8 w-8 rounded-md object-cover" data-testid="upload-preview" />
      ) : (
        <ImagePlus className="h-4 w-4" />
      )}
      <span className="min-w-0">
        {isUploading ? "Uploading…" : preview ? preview.name : label}
      </span>
      <input
        className="hidden"
        type="file"
        accept={accept}
        disabled={isUploading}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (preview) URL.revokeObjectURL(preview.url);
          setPreview({ url: URL.createObjectURL(file), type: file.type, name: file.name });
          const uploaded = await uploadFile(file);
          if (uploaded) {
            onUploaded(uploaded.objectPath, file.name);
          } else {
            setPreview(null);
            toast({ title: "Upload failed", description: "Check the file type/size, or ask an admin whether uploads are configured.", variant: "destructive" });
          }
          event.target.value = "";
        }}
      />
    </label>
  );
}

function ClubCard({ club }: { club: Club }) {
  const logo = assetUrl(club.logoPath);
  return (
    <Link href={`/clubs/${club.id}`}>
      <Card className="h-full cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
        <CardContent className="p-5">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xl font-bold text-primary">
              {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : club.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{club.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{club.description}</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {club.memberCount} members</span>
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {club.eventCount} events</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ClubDirectory() {
  const { data, isLoading } = useListClubs();
  const clubs = (data ?? []) as Club[];
  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-6">
        <DiscoverTabs />
        <div className="mb-8 mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">ClubHouse community</p>
            <h1 className="text-3xl font-bold tracking-tight">Find your club</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Explore student communities, meet their teams, and find events at your college.</p>
          </div>
          <Link href="/clubs/register"><Button className="gap-2"><Plus className="h-4 w-4" /> Register a club</Button></Link>
        </div>
        {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-40 rounded-xl" />)}</div>
          : clubs.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{clubs.map((club) => <ClubCard key={club.id} club={club} />)}</div>
          : <Card><CardContent className="p-10 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">No clubs registered yet</h2><p className="mt-1 text-sm text-muted-foreground">Be the first team to create a club profile.</p><Link href="/clubs/register"><Button className="mt-5">Register a club</Button></Link></CardContent></Card>}
      </div>
    </AppLayout>
  );
}

export function ClubRegister() {
  const [, navigate] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const createClub = useCreateClub();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [brochurePath, setBrochurePath] = useState<string | null>(null);
  const [brochureName, setBrochureName] = useState<string | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creator, setCreator] = useState<{ clerkId: string; name: string } | null>(null);

  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn },
  });
  const isPlatformAdmin = (profile as { role?: string } | null | undefined)?.role === "admin";
  const { data: creatorResults } = useSearchUsers(
    { q: creatorQuery },
    {
      query: {
        queryKey: getSearchUsersQueryKey({ q: creatorQuery }),
        enabled: isPlatformAdmin && creatorQuery.trim().length >= 2 && !creator,
      },
    },
  );
  const typedCreatorResults = (creatorResults as unknown as Array<Record<string, unknown>>) ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isSignedIn) { toast({ title: "Sign in to register a club", variant: "destructive" }); return; }
    try {
      const club = await createClub.mutateAsync({
        data: {
          name, description, logoPath, brochurePath, brochureName,
          ...(isPlatformAdmin && creator ? { createdBy: creator.clerkId } : {}),
        },
      });
      qc.invalidateQueries({ queryKey: getListClubsQueryKey() });
      navigate(`/clubs/${club.id}/admin`);
      toast({ title: "Club registered", description: "You can now customize its team and events." });
    } catch { toast({ title: "Could not register club", description: "Check the form and try again.", variant: "destructive" }); }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-6">
        <Link href="/clubs" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to clubs</Link>
        <Card>
          <CardHeader><CardTitle>Register your club</CardTitle><p className="text-sm text-muted-foreground">Create a public home for your college community.</p></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div><label className="mb-2 block text-sm font-medium">Club name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Robotics Club" required minLength={2} /></div>
              <div><label className="mb-2 block text-sm font-medium">About the club</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does your club do, and who is it for?" required minLength={10} rows={5} /></div>
              {isPlatformAdmin && (
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="mb-2 text-sm font-medium">Club creator <span className="text-muted-foreground font-normal">(admin only — defaults to you)</span></p>
                  {creator ? (
                    <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                      <span className="text-sm font-medium" data-testid="text-club-creator">{creator.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setCreator(null); setCreatorQuery(""); }} data-testid="button-creator-clear">
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        value={creatorQuery}
                        onChange={(e) => setCreatorQuery(e.target.value)}
                        placeholder="Search students by name or email"
                        data-testid="input-creator-search"
                      />
                      {creatorQuery.trim().length >= 2 && (
                        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                          {typedCreatorResults.map((u) => (
                            <button
                              key={String(u.clerkId)}
                              type="button"
                              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => setCreator({ clerkId: String(u.clerkId), name: String(u.name) })}
                              data-testid={`button-creator-pick-${u.clerkId}`}
                            >
                              <span className="font-medium">{String(u.name)}</span>
                              <span className="text-xs text-muted-foreground">{String(u.email ?? "")}</span>
                            </button>
                          ))}
                          {typedCreatorResults.length === 0 && (
                            <p className="text-xs text-muted-foreground px-1 py-2">No onboarded students match that search.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="mb-2 text-sm font-medium">Club logo</p><UploadButton accept="image/png,image/jpeg,image/webp" label={logoPath ? "Logo uploaded" : "Upload logo"} onUploaded={(path) => setLogoPath(path)} />{logoPath && <Badge variant="secondary" className="ml-2">Ready</Badge>}</div>
                <div><p className="mb-2 text-sm font-medium">Brochure or invite</p><UploadButton accept=".pdf,image/png,image/jpeg" label={brochureName ?? "Upload brochure"} onUploaded={(path, fileName) => { setBrochurePath(path); setBrochureName(fileName); }} />{brochurePath && <Badge variant="secondary" className="ml-2">Ready</Badge>}</div>
              </div>
              <Button type="submit" disabled={createClub.isPending} className="w-full sm:w-auto">{createClub.isPending ? "Registering…" : "Register club"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export function ClubProfile() {
  const [, params] = useRoute("/clubs/:clubId");
  const id = Number(params?.clubId);
  const { isSignedIn, userId } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [joinRequested, setJoinRequested] = useState(false);
  const { toast } = useToast();
  const { data, isLoading } = useGetClub(id, { query: { queryKey: getGetClubQueryKey(id), enabled: Number.isInteger(id) } });
  const club = data as Club | undefined;
  const joinClub = useJoinClub();
  if (isLoading) return <AppLayout><div className="mx-auto max-w-5xl p-6"><Skeleton className="h-48 rounded-xl" /></div></AppLayout>;
  if (!club) return <AppLayout><div className="p-6 text-center text-muted-foreground">Club not found.</div></AppLayout>;
  const logo = assetUrl(club.logoPath);
  const brochure = assetUrl(club.brochurePath);
  const members = (club.members ?? []) as unknown as Array<Record<string, unknown>>;
  const isMember = Boolean(userId && members.some((m) => m.clerkId === userId));
  const isOwner = Boolean(userId && club.createdBy === userId);

  async function handleJoin() {
    try {
      await joinClub.mutateAsync({ clubId: id });
      setJoinRequested(true);
      toast({ title: "Join request sent!", description: "The club owner will review it soon." });
    } catch {
      setJoinRequested(true);
      toast({ title: "Already requested or a member", variant: "destructive" });
    }
  }
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl p-6">
        <Link href="/clubs" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All clubs</Link>
        <Card className="mb-6 overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
          <CardContent className="-mt-10 p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-primary/10 text-3xl font-bold text-primary shadow">{logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : club.name.slice(0, 1)}</div>
              <div className="flex-1"><h1 className="text-3xl font-bold">{club.name}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{club.description}</p></div>
              {brochure && <a href={brochure} target="_blank" rel="noreferrer"><Button variant="outline" className="gap-2"><FileText className="h-4 w-4" /> {club.brochureName || "Club brochure"}</Button></a>}
              <Link href={`/clubs/${club.id}/admin`}><Button variant="outline" size="icon" aria-label="Club settings"><Settings className="h-4 w-4" /></Button></Link>
              {isSignedIn && !isMember && !isOwner && (
                joinRequested ? (
                  <Button variant="outline" size="sm" disabled data-testid="button-join-club-pending">
                    Request pending
                  </Button>
                ) : (
                  <Button size="sm" className="gap-2" onClick={() => void handleJoin()} disabled={joinClub.isPending} data-testid="button-join-club">
                    <UserPlus className="h-4 w-4" /> {joinClub.isPending ? "Requesting..." : "Join Club"}
                  </Button>
                )
              )}
              {isSignedIn && (
                <Button variant="ghost" size="icon" onClick={() => setReportOpen(true)} aria-label="Report club" data-testid="button-report-club">
                  <Flag className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-5 flex gap-5 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {club.memberCount} team members</span><span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {club.eventCount} events</span></div>
          </CardContent>
        </Card>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card><CardHeader><CardTitle className="text-lg">Team</CardTitle></CardHeader><CardContent className="space-y-3">{club.members?.length ? club.members.map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><div><p className="font-medium">{member.name}</p><p className="text-sm text-muted-foreground">{member.role}</p></div></div>) : <p className="text-sm text-muted-foreground">The team will be added soon.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Upcoming events</CardTitle></CardHeader><CardContent className="space-y-3">{club.events?.length ? club.events.map((event) => <div key={event.id} className="rounded-lg border p-4">{assetUrl(event.bannerPath) && <img src={assetUrl(event.bannerPath)!} alt="" className="mb-3 h-28 w-full rounded-md object-cover" />}<div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{event.title}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(event.scheduledAt).toLocaleString()}</p>{event.description && <p className="mt-2 text-sm">{event.description}</p>}</div><CalendarDays className="h-5 w-5 text-primary" /></div></div>) : <p className="text-sm text-muted-foreground">No events have been announced yet.</p>}</CardContent></Card>
        </div>
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="club"
          targetId={String(club.id)}
          targetLabel="club"
        />
      </div>
    </AppLayout>
  );
}

export function ClubAdmin() {
  const [, params] = useRoute("/clubs/:clubId/admin");
  const id = Number(params?.clubId);
  const { userId } = useAuth();
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetClub(id, { query: { queryKey: getGetClubQueryKey(id), enabled: Number.isInteger(id) } });
  const club = data as Club | undefined;
  const { data: profile, isLoading: profileLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: Boolean(userId) },
  });
  const typedProfile = profile as { role?: string } | null | undefined;
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateClub = useUpdateClub();
  const addMember = useCreateClubMember();
  const deleteMember = useDeleteClubMember();
  const addEvent = useCreateClubEvent();
  const editEvent = useUpdateClubEvent();
  const deleteEvent = useDeleteClubEvent();
  const removeClub = useDeleteClub();
  const updateJoinRequest = useUpdateClubJoinRequest();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [brochurePath, setBrochurePath] = useState<string | null>(null);
  const [brochureName, setBrochureName] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventBanner, setEventBanner] = useState<string | null>(null);
  const [deleteClubOpen, setDeleteClubOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<ClubManagementEvent | null>(null);
  const [eventToEdit, setEventToEdit] = useState<ClubManagementEvent | null>(null);
  const [editEventTitle, setEditEventTitle] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventDescription, setEditEventDescription] = useState("");
  const [editEventBanner, setEditEventBanner] = useState<string | null>(null);

  if (isLoading || profileLoading) return <AppLayout><div className="mx-auto max-w-5xl p-6"><Skeleton className="h-96 rounded-xl" /></div></AppLayout>;
  if (!club) return <AppLayout><div className="p-6 text-center">Club not found.</div></AppLayout>;
  const isOwner = club.createdBy === userId;
  if (!isOwner && typedProfile?.role !== "admin") return <AppLayout><div className="mx-auto max-w-xl p-6"><Card><CardContent className="p-8 text-center"><h1 className="font-semibold">Admin access required</h1><p className="mt-2 text-sm text-muted-foreground">Only the club administrator can edit this page.</p><Link href={`/clubs/${club.id}`}><Button className="mt-5">Back to club</Button></Link></CardContent></Card></div></AppLayout>;

  const { data: joinRequests } = useListClubJoinRequests(id, {
    query: { queryKey: getListClubJoinRequestsQueryKey(id), enabled: Number.isInteger(id) },
  });
  const typedJoinRequests = ((joinRequests as unknown as Array<Record<string, unknown>>) ?? []);

  async function handleJoinRequest(requestId: number, status: "approved" | "rejected") {
    try {
      await updateJoinRequest.mutateAsync({ clubId: id, requestId, data: { status } });
      qc.invalidateQueries({ queryKey: getListClubJoinRequestsQueryKey(id) });
      refresh();
      toast({ title: status === "approved" ? "Member approved!" : "Request rejected" });
    } catch {
      toast({ title: "Could not update request", variant: "destructive" });
    }
  }

  const refresh = () => qc.invalidateQueries({ queryKey: getGetClubQueryKey(id) });
  const saveProfile = async () => { try { await updateClub.mutateAsync({ clubId: id, data: { name: name || club.name, description: description || club.description, logoPath: logoPath ?? club.logoPath, brochurePath: brochurePath ?? club.brochurePath, brochureName: brochureName ?? club.brochureName } }); refresh(); toast({ title: "Club profile saved" }); } catch { toast({ title: "Could not save profile", variant: "destructive" }); } };
  const saveMember = async (event: React.FormEvent) => { event.preventDefault(); try { await addMember.mutateAsync({ clubId: id, data: { name: memberName, role: memberRole } }); setMemberName(""); setMemberRole(""); refresh(); } catch { toast({ title: "Could not add team member", variant: "destructive" }); } };
  const saveEvent = async (event: React.FormEvent) => { event.preventDefault(); try { await addEvent.mutateAsync({ clubId: id, data: { title: eventTitle, scheduledAt: new Date(eventDate).toISOString(), description: eventDescription || null, bannerPath: eventBanner } }); setEventTitle(""); setEventDate(""); setEventDescription(""); setEventBanner(null); refresh(); } catch { toast({ title: "Could not create event", variant: "destructive" }); } };
  const handleDeleteClub = async () => { try { await removeClub.mutateAsync({ clubId: id }); toast({ title: "Club deleted" }); setDeleteClubOpen(false); navigate("/clubs"); } catch { toast({ title: "Could not delete club", variant: "destructive" }); } };
  const handleDeleteEvent = async () => { if (!eventToDelete) return; try { await deleteEvent.mutateAsync({ clubId: id, eventId: eventToDelete.id }); refresh(); toast({ title: "Event deleted" }); setEventToDelete(null); } catch { toast({ title: "Could not delete event", variant: "destructive" }); } };
  const startEditEvent = (event: ClubManagementEvent) => {
    setEventToEdit(event);
    setEditEventTitle(event.title);
    setEditEventDescription(event.description ?? "");
    setEditEventBanner(null);
    const d = new Date(event.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditEventDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };
  const handleEditEvent = async () => {
    if (!eventToEdit || editEventTitle.trim().length < 2 || !editEventDate) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }
    try {
      await editEvent.mutateAsync({
        clubId: id,
        eventId: eventToEdit.id,
        data: {
          title: editEventTitle.trim(),
          scheduledAt: new Date(editEventDate).toISOString(),
          description: editEventDescription.trim() || null,
          ...(editEventBanner ? { bannerPath: editEventBanner } : {}),
        },
      });
      refresh();
      toast({ title: "Event updated" });
      setEventToEdit(null);
    } catch {
      toast({ title: "Could not update event", variant: "destructive" });
    }
  };
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between"><div><Link href={`/clubs/${id}`} className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back to club</Link><h1 className="text-3xl font-bold">Manage {club.name}</h1></div><Badge variant="secondary" className="gap-1"><Settings className="h-3.5 w-3.5" /> Admin</Badge></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Club profile</CardTitle></CardHeader><CardContent className="space-y-4"><Input placeholder={club.name} value={name} onChange={(e) => setName(e.target.value)} /><Textarea placeholder={club.description} value={description} onChange={(e) => setDescription(e.target.value)} rows={5} /><div className="flex flex-wrap gap-2"><UploadButton accept="image/png,image/jpeg,image/webp" label={logoPath || club.logoPath ? "Replace logo" : "Upload logo"} currentUrl={!logoPath ? assetUrl(club.logoPath) : null} onUploaded={(path) => setLogoPath(path)} /><UploadButton accept=".pdf,image/png,image/jpeg" label={brochureName || club.brochureName || "Upload brochure"} currentUrl={!brochurePath ? assetUrl(club.brochurePath) : null} onUploaded={(path, fileName) => { setBrochurePath(path); setBrochureName(fileName); }} /></div><Button onClick={saveProfile} disabled={updateClub.isPending}>Save profile</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Team members</CardTitle></CardHeader><CardContent><form onSubmit={saveMember} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input placeholder="Name" value={memberName} onChange={(e) => setMemberName(e.target.value)} required /><Input placeholder="Role" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} required /><Button type="submit" size="icon" aria-label="Add team member"><Plus className="h-4 w-4" /></Button></form><div className="space-y-2">{(club.members ?? []).map((member: ClubMember) => <div key={member.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{member.name}</p><p className="text-sm text-muted-foreground">{member.role}</p></div><Button variant="ghost" size="icon" onClick={async () => { await deleteMember.mutateAsync({ clubId: id, memberId: member.id }); refresh(); }} aria-label={`Remove ${member.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div></CardContent></Card>
          <Card><CardHeader><CardTitle>Join requests {typedJoinRequests.length > 0 && <Badge className="ml-2">{typedJoinRequests.length}</Badge>}</CardTitle></CardHeader><CardContent>{typedJoinRequests.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : <div className="space-y-2">{typedJoinRequests.map((r) => <div key={String(r.id)} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3" data-testid={`card-club-join-${r.id}`}><div className="flex-1 min-w-0"><p className="font-medium text-sm" data-testid={`text-club-request-name-${r.id}`}>{String(r.userName || "Student")}</p></div><div className="flex gap-2 flex-shrink-0"><Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => void handleJoinRequest(Number(r.id), "approved")} data-testid={`button-approve-club-join-${r.id}`}>Approve</Button><Button size="sm" variant="outline" onClick={() => void handleJoinRequest(Number(r.id), "rejected")} data-testid={`button-reject-club-join-${r.id}`}>Reject</Button></div></div>)}</div>}</CardContent></Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>Events</CardTitle></CardHeader><CardContent><form onSubmit={saveEvent} className="grid gap-3 md:grid-cols-2"><Input placeholder="Event title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required /><Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /><Textarea className="md:col-span-2" placeholder="Event description (optional)" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} /><div className="flex items-center gap-3"><UploadButton accept="image/png,image/jpeg,image/webp" label={eventBanner ? "Banner uploaded" : "Upload event banner"} onUploaded={(path) => setEventBanner(path)} /><Button type="submit" disabled={addEvent.isPending} className="gap-2"><Plus className="h-4 w-4" /> Create event</Button></div></form><div className="mt-6 grid gap-3 md:grid-cols-2">{(club.events ?? []).map((event: ClubManagementEvent) => <div key={event.id} className="rounded-lg border p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{event.title}</p><p className="text-sm text-muted-foreground">{new Date(event.scheduledAt).toLocaleString()}</p></div><div className="flex gap-1 flex-shrink-0"><Button variant="ghost" size="icon" onClick={() => startEditEvent(event)} aria-label={`Edit ${event.title}`} data-testid={`button-edit-club-event-${event.id}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setEventToDelete(event)} aria-label={`Delete ${event.title}`} data-testid={`button-delete-club-event-${event.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>{event.description && <p className="mt-2 text-sm">{event.description}</p>}</div>)}</div></CardContent></Card>
          <Card className="lg:col-span-2 border-destructive/40"><CardHeader><CardTitle className="text-destructive">Danger zone</CardTitle></CardHeader><CardContent className="flex flex-col sm:flex-row sm:items-center gap-3"><p className="text-sm text-muted-foreground flex-1">Permanently remove this club, its team list, events and assets. This cannot be undone.</p><Button variant="destructive" className="gap-2" onClick={() => setDeleteClubOpen(true)} data-testid="button-delete-club"><Trash2 className="h-4 w-4" /> Delete club</Button></CardContent></Card>
        </div>
        <DeleteConfirm
          open={deleteClubOpen}
          onOpenChange={setDeleteClubOpen}
          title="Delete club"
          statement={`You are about to permanently remove "${club.name}". This cannot be undone.`}
          consequences={[
            "All team members will be removed",
            "All club events will be removed",
            "Club logo, brochure and banners will be removed",
          ]}
          requireTyping
          confirmLabel="Delete club"
          pending={removeClub.isPending}
          onConfirm={handleDeleteClub}
        />
        <DeleteConfirm
          open={eventToDelete !== null}
          onOpenChange={(next) => { if (!next) setEventToDelete(null); }}
          title="Delete event"
          statement={`Remove "${eventToDelete?.title ?? ""}" from this club?`}
          pending={deleteEvent.isPending}
          onConfirm={handleDeleteEvent}
        />
        <Dialog open={eventToEdit !== null} onOpenChange={(next) => { if (!next) setEventToEdit(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit event</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Event title</label>
                <Input value={editEventTitle} onChange={(e) => setEditEventTitle(e.target.value)} data-testid="input-edit-club-event-title" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Date &amp; time</label>
                <Input type="datetime-local" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} data-testid="input-edit-club-event-date" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea value={editEventDescription} onChange={(e) => setEditEventDescription(e.target.value)} rows={3} data-testid="input-edit-club-event-desc" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Banner <span className="text-muted-foreground font-normal">(optional)</span></p>
                <UploadButton
                  accept="image/png,image/jpeg,image/webp"
                  label={editEventBanner || eventToEdit?.bannerPath ? "Replace banner" : "Upload banner"}
                  currentUrl={!editEventBanner ? assetUrl(eventToEdit?.bannerPath ?? null) : null}
                  onUploaded={(path) => setEditEventBanner(path)}
                />
              </div>
              <Button onClick={() => void handleEditEvent()} disabled={editEvent.isPending} className="w-full" data-testid="button-save-club-event">
                {editEvent.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}