import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Shield, Users, GraduationCap, Folder, CheckCircle, XCircle, Clock } from "lucide-react";
import {
  useGetMyProfile, getGetMyProfileQueryKey,
  useAdminGetStats, getAdminGetStatsQueryKey,
  useAdminGetCollegeRegistrations, getAdminGetCollegeRegistrationsQueryKey,
  useAdminGetModeratorApplications, getAdminGetModeratorApplicationsQueryKey,
  useAdminUpdateCollegeRegistration, useAdminUpdateModeratorApplication,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <Card data-testid={`card-admin-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn },
  });
  const typedProfile = profile as { role?: string } | null | undefined;

  useEffect(() => {
    if (!profileLoading && typedProfile?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [typedProfile, profileLoading, setLocation]);

  const { data: stats } = useAdminGetStats({ query: { queryKey: getAdminGetStatsQueryKey(), enabled: typedProfile?.role === "admin" } });
  const { data: colleges, isLoading: collegesLoading } = useAdminGetCollegeRegistrations({
    query: { queryKey: getAdminGetCollegeRegistrationsQueryKey(), enabled: typedProfile?.role === "admin" }
  });
  const { data: modApps, isLoading: modAppsLoading } = useAdminGetModeratorApplications({
    query: { queryKey: getAdminGetModeratorApplicationsQueryKey(), enabled: typedProfile?.role === "admin" }
  });

  const updateCollege = useAdminUpdateCollegeRegistration();
  const updateMod = useAdminUpdateModeratorApplication();

  const typedStats = stats as Record<string, number> | null | undefined;
  const typedColleges = (colleges as Array<Record<string, unknown>>) ?? [];
  const typedModApps = (modApps as Array<Record<string, unknown>>) ?? [];

  async function handleCollegeAction(collegeId: number, status: "approved" | "rejected") {
    try {
      await updateCollege.mutateAsync({ collegeId, data: { status } });
      qc.invalidateQueries({ queryKey: getAdminGetCollegeRegistrationsQueryKey() });
      qc.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
      toast({ title: `College ${status}` });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleModAction(applicationId: number, status: "approved" | "rejected") {
    try {
      await updateMod.mutateAsync({ applicationId, data: { status } });
      qc.invalidateQueries({ queryKey: getAdminGetModeratorApplicationsQueryKey() });
      toast({ title: `Application ${status}` });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  if (profileLoading) {
    return (
      <AppLayout userRole="admin">
        <div className="p-6 max-w-6xl mx-auto">
          <Skeleton className="h-9 w-48 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userRole="admin">
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Platform management and moderation</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Users" value={typedStats?.totalUsers ?? 0} icon={Users} color="bg-blue-500/10 text-blue-600" />
          <StatCard label="Active Colleges" value={typedStats?.totalColleges ?? 0} icon={GraduationCap} color="bg-green-500/10 text-green-600" />
          <StatCard label="Pending Colleges" value={typedStats?.pendingColleges ?? 0} icon={Clock} color="bg-orange-500/10 text-orange-600" />
          <StatCard label="Total Projects" value={typedStats?.totalProjects ?? 0} icon={Folder} color="bg-purple-500/10 text-purple-600" />
          <StatCard label="Total Events" value={typedStats?.totalEvents ?? 0} icon={CheckCircle} color="bg-primary/10 text-primary" />
          <StatCard label="Pending Moderators" value={typedStats?.pendingModerators ?? 0} icon={Shield} color="bg-yellow-500/10 text-yellow-600" />
        </div>

        <Tabs defaultValue="colleges">
          <TabsList className="mb-6">
            <TabsTrigger value="colleges" data-testid="tab-colleges">
              College Registrations
              {typedStats?.pendingColleges ? <Badge className="ml-2 h-5 px-1.5 text-xs">{typedStats.pendingColleges}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="moderators" data-testid="tab-moderators">
              Moderator Applications
              {typedStats?.pendingModerators ? <Badge className="ml-2 h-5 px-1.5 text-xs">{typedStats.pendingModerators}</Badge> : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="colleges">
            {collegesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl mb-3" />)
            ) : typedColleges.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No pending college registrations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {typedColleges.map(c => (
                  <Card key={String(c.id)} data-testid={`card-college-registration-${c.id}`}>
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground" data-testid={`text-college-name-${c.id}`}>{String(c.name)}</h3>
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Pending</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{String(c.location)}</p>
                        {c.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{String(c.description)}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted {formatDistanceToNow(new Date(String(c.createdAt)), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700"
                          onClick={() => handleCollegeAction(Number(c.id), "approved")}
                          disabled={updateCollege.isPending}
                          data-testid={`button-approve-college-${c.id}`}
                        >
                          <CheckCircle className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleCollegeAction(Number(c.id), "rejected")}
                          disabled={updateCollege.isPending}
                          data-testid={`button-reject-college-${c.id}`}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="moderators">
            {modAppsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl mb-3" />)
            ) : typedModApps.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No pending moderator applications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {typedModApps.map(app => (
                  <Card key={String(app.id)} data-testid={`card-mod-app-${app.id}`}>
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground" data-testid={`text-mod-name-${app.id}`}>{String(app.userName)}</h3>
                          <Badge variant="secondary" className="text-xs">wants to moderate</Badge>
                          <span className="text-sm text-muted-foreground">{String(app.collegeName)}</span>
                        </div>
                        {app.motivation && <p className="text-sm text-muted-foreground line-clamp-2">{String(app.motivation)}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Applied {formatDistanceToNow(new Date(String(app.createdAt)), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700"
                          onClick={() => handleModAction(Number(app.id), "approved")}
                          disabled={updateMod.isPending}
                          data-testid={`button-approve-mod-${app.id}`}
                        >
                          <CheckCircle className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleModAction(Number(app.id), "rejected")}
                          disabled={updateMod.isPending}
                          data-testid={`button-reject-mod-${app.id}`}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

