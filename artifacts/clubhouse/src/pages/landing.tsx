import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { ArrowRight, Users, BookOpen, Zap, Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Users,
    title: "College Communities",
    description: "Join your college's official club, connect with peers across semesters and courses, and participate in a shared campus experience.",
  },
  {
    icon: BookOpen,
    title: "Collaborative Projects",
    description: "Find open projects that need your skills, or start your own and recruit talented teammates from any college.",
  },
  {
    icon: Zap,
    title: "Hackathons & Workshops",
    description: "Discover upcoming events hosted by clubs across the network — hackathons, workshops, seminars, and more.",
  },
  {
    icon: Globe,
    title: "Cross-College Networking",
    description: "Break out of your campus bubble. Meet students building real things at colleges everywhere.",
  },
];

const stats = [
  { label: "Students", value: "10,000+" },
  { label: "Colleges", value: "250+" },
  { label: "Active Projects", value: "1,200+" },
  { label: "Events Hosted", value: "3,000+" },
];

export default function Landing() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isSignedIn) setLocation("/dashboard");
  }, [isSignedIn, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">CH</span>
            </div>
            <span className="font-bold text-foreground text-lg tracking-tight">ClubHouse</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" data-testid="link-sign-in">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" data-testid="link-sign-up">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-6 font-medium" data-testid="badge-hero-tag">
              The campus internet
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight leading-tight mb-6">
              Where students{" "}
              <span className="text-primary">build</span>
              {" "}together
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl">
              ClubHouse is the platform for college students to find their community, collaborate on real projects, and grow beyond their campus. Join clubs, ship things, make friends.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="gap-2 font-semibold" data-testid="button-cta-primary">
                  Start building <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button size="lg" variant="outline" data-testid="button-cta-secondary">
                  Sign in to your club
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="text-3xl md:text-4xl font-extrabold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything your campus needs
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Built specifically for how students actually work and learn together.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200"
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Your college club awaits
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
            Sign up in seconds. No OTP, no nonsense. Email and password — that's it.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 font-semibold" data-testid="button-footer-cta">
              Create your account <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>ClubHouse — Multi-College Student Platform</span>
          <span>Built for students, by students</span>
        </div>
      </footer>
    </div>
  );
}
