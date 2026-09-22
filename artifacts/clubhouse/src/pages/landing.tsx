import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { ArrowRight, Rocket, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useListProjects, getListProjectsQueryKey,
  useListEvents, getListEventsQueryKey,
  useListClubs, getListClubsQueryKey,
  useListColleges, getListCollegesQueryKey,
} from "@workspace/api-client-react";
import { NetworkHero } from "@/components/social/network-hero";
import { ProjectCard } from "@/components/social/project-card";
import { SocialEventCard } from "@/components/social/event-card";
import { ClubCard } from "@/components/social/club-card";
import { CollegeCard } from "@/components/social/college-card";
import { SectionHeading } from "@/components/social/section-heading";
import { Reveal, Stagger } from "@/components/reveal";
import { fadeUp, springIn, staggerItem } from "@/lib/motion";

export default function Landing() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isSignedIn) setLocation("/dashboard");
  }, [isSignedIn, setLocation]);

  const { data: projects } = useListProjects(undefined, { query: { queryKey: getListProjectsQueryKey() } });
  const { data: events } = useListEvents(undefined, { query: { queryKey: getListEventsQueryKey() } });
  const { data: clubs } = useListClubs({ query: { queryKey: getListClubsQueryKey() } });
  const { data: colleges } = useListColleges(undefined, { query: { queryKey: getListCollegesQueryKey() } });

  const typedProjects = (projects as unknown as Array<Record<string, unknown>>) ?? [];
  const typedEvents = (events as unknown as Array<Record<string, unknown>>) ?? [];
  const typedClubs = (clubs as unknown as Array<Record<string, unknown>>) ?? [];
  const typedColleges = (colleges as unknown as Array<Record<string, unknown>>) ?? [];

  const openProjects = typedProjects.filter((p) => p.openForApplications);
  const upcomingEvents = typedEvents
    .filter((e) => new Date(String(e.startDate)).getTime() > Date.now() - 86400000)
    .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime());

  const stats: Array<[string, number, string]> = [
    ["Projects", typedProjects.length, "text-ch-violet"],
    ["Events", typedEvents.length, "text-ch-cyan"],
    ["Clubs", typedClubs.length, "text-ch-pink"],
    ["Colleges", typedColleges.length, "text-ch-amber"],
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-violet-cyan text-white shadow-md">
              <Zap className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Club<span className="text-gradient-violet-cyan">House</span>
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" data-testid="link-sign-in">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="rounded-full" data-testid="link-sign-up">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden pt-16">
        <NetworkHero className="mask-fade-b pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-ch-violet/20 blur-3xl animate-drift-a" />
        <div className="pointer-events-none absolute -right-24 top-64 h-72 w-72 rounded-full bg-ch-cyan/20 blur-3xl animate-drift-b" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 md:pb-24 md:pt-24">
          <motion.p
            variants={fadeUp}
            initial="initial"
            animate="animate"
            className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-ch-violet"
          >
            Build · Connect · Belong
          </motion.p>
          <motion.h1
            variants={springIn}
            initial="initial"
            animate="animate"
            className="max-w-3xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl"
          >
            Find your people.
            <br />
            <span className="text-gradient-violet-cyan">Build something</span>
            <br />
            worth showing.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.15 }}
            className="mt-6 max-w-xl text-lg text-muted-foreground"
          >
            ClubHouse is where college students find teams, ship projects and fill
            their weekends with hackathons — across every campus.
          </motion.p>
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.25 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link href="/discover">
              <Button size="lg" className="gap-2 rounded-full px-7 font-semibold shadow-lg" data-testid="button-cta-explore">
                Explore ClubHouse <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={isSignedIn ? "/discover?create=1" : "/sign-up"}>
              <Button size="lg" variant="outline" className="gap-2 rounded-full px-7 font-semibold" data-testid="button-cta-start">
                <Rocket className="h-4 w-4" /> Start a Project
              </Button>
            </Link>
          </motion.div>

          {/* LIVE strip — real counts only */}
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.35 }}
            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-green-500 text-green-500" />
              Live on ClubHouse
            </span>
            {stats.map(([label, value, cls]) => (
              <span key={label} className="flex items-baseline gap-1.5">
                <span className={`font-display text-2xl font-bold ${cls}`}>{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TRENDING PROJECTS */}
      {openProjects.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <Reveal>
            <SectionHeading
              kicker="Trending projects"
              kickerClass="text-ch-coral"
              title="Teams are forming right now"
              subtitle="Open projects looking for people like you"
              actionLabel="All projects"
              actionHref="/discover"
            />
          </Reveal>
          <Stagger className="scroll-slim -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {openProjects.slice(0, 6).map((p) => (
              <Reveal key={String(p.id)} asStaggerItem className="w-[85%] flex-shrink-0 snap-start sm:w-[380px]">
                <ProjectCard project={p} />
              </Reveal>
            ))}
          </Stagger>
        </section>
      )}

      {/* WHAT'S HAPPENING */}
      {upcomingEvents.length > 0 && (
        <section className="border-y border-border/60 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <Reveal>
              <SectionHeading
                kicker="What's happening"
                kickerClass="text-ch-cyan"
                title="Upcoming energy"
                subtitle="Hackathons, workshops and talks on the calendar"
                actionLabel="All events"
                actionHref="/discover/events"
              />
            </Reveal>
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {upcomingEvents.slice(0, 4).map((e) => (
                <Reveal key={String(e.id)} asStaggerItem>
                  <SocialEventCard event={e} />
                </Reveal>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ACTIVE COMMUNITIES */}
      {typedClubs.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <Reveal>
            <SectionHeading
              kicker="Active communities"
              kickerClass="text-ch-pink"
              title="Find your club"
              subtitle="Crews that build, meet and ship together"
              actionLabel="All clubs"
              actionHref="/clubs"
            />
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {typedClubs.slice(0, 4).map((c) => (
              <Reveal key={String(c.id)} asStaggerItem>
                <ClubCard club={c} />
              </Reveal>
            ))}
          </Stagger>
        </section>
      )}

      {/* DISCOVER YOUR CAMPUS */}
      {typedColleges.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <Reveal>
            <SectionHeading
              kicker="Discover your campus"
              kickerClass="text-ch-amber"
              title="Colleges on ClubHouse"
              actionLabel="All colleges"
              actionHref="/discover/colleges"
            />
          </Reveal>
          <Stagger className="grid gap-3 sm:grid-cols-2">
            {typedColleges.slice(0, 4).map((c) => (
              <Reveal key={String(c.id)} asStaggerItem>
                <CollegeCard college={c} />
              </Reveal>
            ))}
          </Stagger>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-border/60">
        <div className="motif-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <Reveal>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-ch-violet">
              Something is happening near you
            </p>
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Your next team is <span className="text-gradient-pink-violet">one click away</span>
            </h2>
            <Link href="/sign-up">
              <Button size="lg" className="mt-8 gap-2 rounded-full px-8 font-semibold shadow-lg" data-testid="button-footer-cta">
                Join ClubHouse <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>ClubHouse — built for students, by students</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-green-500 text-green-500" />
            Live demo data, real platform
          </span>
        </div>
      </footer>
    </div>
  );
}
