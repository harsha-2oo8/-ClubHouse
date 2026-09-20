import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Bell, Lock, LogOut, MonitorSmartphone, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import {
  useGetMyProfile, getGetMyProfileQueryKey, useUpdateMyProfile,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

/**
 * Account settings: profile, security (Clerk-hosted), appearance,
 * privacy toggles, notifications entry, sign out.
 */
export default function SettingsPage() {
  const { isSignedIn } = useAuth();
  const { signOut, openUserProfile } = useClerk();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey(), enabled: !!isSignedIn },
  });
  const typedProfile = profile as {
    role?: string;
    showPortfolio?: boolean;
    showSocials?: boolean;
  } | null | undefined;
  const updateProfile = useUpdateMyProfile();

  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showSocials, setShowSocials] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (typedProfile) {
      setShowPortfolio(typedProfile.showPortfolio ?? true);
      setShowSocials(typedProfile.showSocials ?? true);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Deep-link support: /settings#privacy scrolls to the privacy card.
  useEffect(() => {
    if (window.location.hash === "#privacy") {
      document.getElementById("privacy")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  async function savePrivacy() {
    try {
      await updateProfile.mutateAsync({ data: { showPortfolio, showSocials } });
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      setDirty(false);
      toast({ title: "Privacy settings saved" });
    } catch {
      toast({ title: "Could not save privacy settings", variant: "destructive" });
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      qc.clear();
      setLocation("/");
      toast({ title: "Signed out" });
    }
  }

  return (
    <AppLayout userRole={typedProfile?.role}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Profile, security, appearance and privacy</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" /> Profile
            </CardTitle>
            <CardDescription>How you appear to other students</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/profile/me">
              <Button variant="outline" size="sm" data-testid="settings-view-profile">View public profile</Button>
            </Link>
            <Link href="/profile/me?edit=1">
              <Button variant="outline" size="sm" data-testid="settings-edit-profile">Edit profile</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Account &amp; Security
            </CardTitle>
            <CardDescription>
              Passwords, sessions and verification are managed by Clerk — ClubHouse never sees your password
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openUserProfile()} data-testid="settings-manage-account">
              Manage account &amp; security
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={theme ?? "light"} onValueChange={setTheme} className="flex flex-col sm:flex-row gap-3">
              {[
                { value: "light", label: "Light", Icon: Sun },
                { value: "dark", label: "Dark", Icon: Moon },
                { value: "system", label: "System", Icon: MonitorSmartphone },
              ].map(({ value, label, Icon }) => (
                <Label
                  key={value}
                  htmlFor={`theme-${value}`}
                  className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm cursor-pointer hover:border-primary/40"
                >
                  <RadioGroupItem value={value} id={`theme-${value}`} data-testid={`settings-theme-${value}`} />
                  <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card id="privacy" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Privacy
            </CardTitle>
            <CardDescription>Your email is always private — only you can see it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-16 rounded-lg" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Show portfolio on public profile</p>
                    <p className="text-xs text-muted-foreground">Project titles, links and descriptions</p>
                  </div>
                  <Switch
                    checked={showPortfolio}
                    onCheckedChange={(v) => { setShowPortfolio(v); setDirty(true); }}
                    data-testid="settings-show-portfolio"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Show social links on public profile</p>
                    <p className="text-xs text-muted-foreground">LinkedIn, GitHub and other links you added</p>
                  </div>
                  <Switch
                    checked={showSocials}
                    onCheckedChange={(v) => { setShowSocials(v); setDirty(true); }}
                    data-testid="settings-show-socials"
                  />
                </div>
                <Button size="sm" disabled={!dirty || updateProfile.isPending} onClick={() => void savePrivacy()} data-testid="settings-save-privacy">
                  {updateProfile.isPending ? "Saving..." : "Save privacy settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/notifications">
              <Button variant="outline" size="sm" data-testid="settings-notifications">Open notifications</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </CardTitle>
            <CardDescription>Ends your session on this device and clears cached data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm" onClick={() => void handleSignOut()} data-testid="settings-sign-out">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
