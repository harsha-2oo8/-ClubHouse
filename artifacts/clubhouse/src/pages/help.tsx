import { Link } from "wouter";
import { ArrowLeft, Bell, Flag, Lock, Search, UserRound, UsersRound } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    icon: UserRound,
    title: "Getting started",
    body: "Sign up, complete the 2-step onboarding (identity, then bio and portfolio), and you land on your dashboard. Your profile is public to other students except your email, which only you can see. Portfolio and social links can be hidden anytime in Settings → Privacy.",
  },
  {
    icon: UsersRound,
    title: "Colleges, clubs and projects",
    body: "Find your college under Discover → Colleges and request to join; a moderator approves you. Browse open projects under Discover, apply with a short note, or create your own and invite teammates by search. Clubs have public pages with team lists and events.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "You are notified about invitations, applications to your projects, approvals, join decisions, meetings and event cancellations. Open the bell icon anytime; mark items read individually or all at once.",
  },
  {
    icon: Search,
    title: "Password, sessions and sign-in trouble",
    body: "ClubHouse uses Clerk for all authentication — we never see or store your password. Forgot it? Use “Forgot password?” on the sign-in page (secure email link from Clerk). To change your password, review active sessions or enable extra verification, open the account menu → Account & Security, which opens Clerk's secure management flow.",
  },
  {
    icon: Flag,
    title: "Safety and reporting",
    body: "Use the flag button on any project, club, event or profile to report spam, harassment, impersonation or inappropriate content. Reports go to moderators and platform admins; reporters cannot resolve their own reports. Deleting your own project, club or event is possible from its manage page with confirmation.",
  },
  {
    icon: Lock,
    title: "Privacy",
    body: "Public profiles show your name, course, bio, portfolio and socials — never your email. Toggle portfolio and social visibility in Settings → Privacy. Anything marked private (such as private uploads) is visible only to you or an admin.",
  },
];

/** In-app help: real how-to, no fake contact details. */
export default function HelpPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Help &amp; Support</h1>
        <p className="text-muted-foreground text-sm mt-0.5 mb-6">How ClubHouse works and how to stay safe</p>
        <div className="space-y-4">
          {sections.map((s) => (
            <Card key={s.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-primary" /> {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
