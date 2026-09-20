import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clerkAppearance } from "@/lib/clerk-appearance";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import Discover from "@/pages/discover";
import DiscoverColleges from "@/pages/discover-colleges";
import DiscoverEvents from "@/pages/discover-events";
import CollegePage from "@/pages/college";
import ProjectPage from "@/pages/project";
import ProfilePage from "@/pages/profile";
import NotificationsPage from "@/pages/notifications";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { ClubAdmin, ClubDirectory, ClubProfile, ClubRegister } from "@/pages/clubs";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

/**
 * Bridges Clerk session tokens into the generated API client.
 * The SPA is hosted on a different origin than the API (Vercel -> Render),
 * so session cookies never reach the backend. Every API call instead carries
 * `Authorization: Bearer <session JWT>`, which @clerk/express verifies
 * server-side (requires CLERK_SECRET_KEY on the API).
 */
function ClerkTokenBridge() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() =>
      getToken().catch(() => null),
    );
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);
  return null;
}

function AppRouter() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign in to ClubHouse",
            subtitle: "Welcome back! Please sign in to continue",
          },
        },
        signUp: {
          start: {
            title: "Create your ClubHouse account",
            subtitle: "Join your college community",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to))}
      appearance={clerkAppearance}
    >
      <ClerkTokenBridge />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/discover" component={Discover} />
        <Route path="/discover/colleges" component={DiscoverColleges} />
        <Route path="/discover/events" component={DiscoverEvents} />
        <Route path="/clubs/register" component={ClubRegister} />
        <Route path="/clubs/:clubId/admin" component={ClubAdmin} />
        <Route path="/clubs/:clubId" component={ClubProfile} />
        <Route path="/clubs" component={ClubDirectory} />
        <Route path="/colleges/:collegeId" component={CollegePage} />
        <Route path="/projects/:projectId" component={ProjectPage} />
        <Route path="/profile/me" component={ProfilePage} />
        <Route path="/profile/:userId" component={ProfilePage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} fallbackRedirectUrl="/dashboard" />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} fallbackRedirectUrl="/onboarding" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
