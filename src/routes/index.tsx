import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type Section = "overview" | "shoots" | "calendar" | "team";

const demoShoots: Shoot[] = [
  {
    id: "demo-shoot-1",
    couple_name: "Maya & Arjun",
    event_type: "Wedding",
    event_date: "2026-10-22",
    location: "Jaipur, Rajasthan",
    venue: "Samode Palace",
    start_time: "09:00",
    end_time: "20:00",
    planned_team_size: 8,
    status: "Upcoming",
    notes: null,
    created_by: null,
    created_at: "2026-10-01T09:00:00.000Z",
    updated_at: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "demo-shoot-2",
    couple_name: "Isha & Kabir",
    event_type: "Engagement",
    event_date: "2026-10-25",
    location: "Udaipur, Rajasthan",
    venue: "The Leela Palace",
    start_time: "15:30",
    end_time: "21:00",
    planned_team_size: 7,
    status: "Upcoming",
    notes: null,
    created_by: null,
    created_at: "2026-10-03T09:00:00.000Z",
    updated_at: "2026-10-03T09:00:00.000Z",
  },
  {
    id: "demo-shoot-3",
    couple_name: "Ananya & Rohan",
    event_type: "Reception",
    event_date: "2026-11-08",
    location: "Mumbai, Maharashtra",
    venue: "Taj Mahal Palace",
    start_time: "17:00",
    end_time: "23:00",
    planned_team_size: 9,
    status: "Upcoming",
    notes: null,
    created_by: null,
    created_at: "2026-10-05T09:00:00.000Z",
    updated_at: "2026-10-05T09:00:00.000Z",
  },
  {
    id: "demo-shoot-4",
    couple_name: "Diya & Veer",
    event_type: "Pre-wedding",
    event_date: "2026-10-18",
    location: "Jodhpur, Rajasthan",
    venue: "Mehrangarh Fort",
    start_time: "06:30",
    end_time: "12:00",
    planned_team_size: 7,
    status: "Completed",
    notes: null,
    created_by: null,
    created_at: "2026-09-20T09:00:00.000Z",
    updated_at: "2026-09-20T09:00:00.000Z",
  },
];

const demoTeam: TeamMember[] = [
  {
    id: "demo-member-1",
    full_name: "Aarav Mehta",
    role: "Photographer",
    email: "aarav@example.com",
    phone: "+91 98765 43210",
    available: true,
    notes: null,
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "demo-member-2",
    full_name: "Sana Kapoor",
    role: "Videographer",
    email: "sana@example.com",
    phone: "+91 98765 43211",
    available: true,
    notes: null,
    created_at: "2026-07-02T09:00:00.000Z",
    updated_at: "2026-07-02T09:00:00.000Z",
  },
  {
    id: "demo-member-3",
    full_name: "Devika Shah",
    role: "Photo Editor",
    email: "devika@example.com",
    phone: "+91 98765 43212",
    available: false,
    notes: null,
    created_at: "2026-07-03T09:00:00.000Z",
    updated_at: "2026-07-03T09:00:00.000Z",
  },
  {
    id: "demo-member-4",
    full_name: "Ishaan Rao",
    role: "Cinematographer / Creative Director",
    email: "ishaan@example.com",
    phone: "+91 98765 43213",
    available: true,
    notes: null,
    created_at: "2026-07-04T09:00:00.000Z",
    updated_at: "2026-07-04T09:00:00.000Z",
  },
  {
    id: "demo-member-5",
    full_name: "Meera Nair",
    role: "Album Designer",
    email: "meera@example.com",
    phone: "+91 98765 43214",
    available: true,
    notes: null,
    created_at: "2026-07-05T09:00:00.000Z",
    updated_at: "2026-07-05T09:00:00.000Z",
  },
];

const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "shoots", label: "Shoots", icon: Camera },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "team", label: "Team", icon: Users },
];

const sectionCopy: Record<Section, { title: string; description: string }> = {
  overview: {
    title: "Your studio at a glance",
    description: "A clear view of what's happening across your team.",
  },
  shoots: {
    title: "All shoots",
    description: "Search and keep track of every upcoming celebration.",
  },
  calendar: {
    title: "Studio calendar",
    description: "See what's coming up and plan your team's schedule.",
  },
  team: {
    title: "Your team",
    description: "The people who make every celebration unforgettable.",
  },
};

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<"checking" | "allowed" | "signed-out">("checking");
  const [demoMode, setDemoMode] = useState(false);
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [dataError, setDataError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) setAccess("signed-out");
      else setAccess("checking");
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setAuthError(error.message);
          setAccess("signed-out");
          return;
        }
        setSession(data.session);
        if (!data.session) setAccess("signed-out");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAuthError(error instanceof Error ? error.message : "Could not restore your session.");
        setAccess("signed-out");
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let mounted = true;

    void Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle(),
      supabase.from("profiles").select("display_name").eq("user_id", session.user.id).maybeSingle(),
    ])
      .then(async ([roleResult, profileResult]) => {
        if (!mounted) return;
        if (roleResult.error || profileResult.error) {
          throw roleResult.error ?? profileResult.error;
        }
        if (!roleResult.data) {
          await supabase.auth.signOut();
          if (mounted) {
            setSession(null);
            setAuthError("This account does not have owner access.");
            setAccess("signed-out");
          }
          return;
        }
        setProfileName(profileResult.data?.display_name || session.user.email || "Studio owner");
        setAccess("allowed");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAuthError(
          error instanceof Error ? error.message : "We couldn't verify your owner access.",
        );
        setAccess("signed-out");
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  const [profileName, setProfileName] = useState("Studio owner");

  const loadWorkspace = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    if (demoMode) {
      setShoots(demoShoots);
      setTeam(demoTeam);
      setLoadingData(false);
      return;
    }
    try {
      const [shootResult, teamResult] = await Promise.all([
        supabase.from("shoots").select("*").order("event_date", { ascending: true }),
        supabase.from("team_members").select("*").order("full_name", { ascending: true }),
      ]);
      if (shootResult.error) throw shootResult.error;
      if (teamResult.error) throw teamResult.error;
      setShoots(shootResult.data);
      setTeam(teamResult.data);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "We couldn't load your studio data.");
    } finally {
      setLoadingData(false);
    }
  }, [demoMode]);

  useEffect(() => {
    if (access === "allowed") void loadWorkspace();
  }, [access, loadWorkspace]);

  function handleDemo() {
    setAuthError("");
    setProfileName("Demo Owner");
    setDemoMode(true);
    setAccess("allowed");
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setSession(data.session);
      setDemoMode(false);
      setAccess("checking");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't sign you in.");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    if (demoMode) {
      setDemoMode(false);
      setAccess("signed-out");
      setShoots([]);
      setTeam([]);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(`Could not sign out: ${error.message}`);
      return;
    }
    setSession(null);
    setAccess("signed-out");
    setShoots([]);
    setTeam([]);
  }

  if ((!session && !demoMode) || access === "signed-out") {
    return (
      <SignInScreen
        error={authError}
        loading={signingIn}
        onSubmit={handleSignIn}
        onDemo={handleDemo}
        onDismissError={() => setAuthError("")}
      />
    );
  }

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7f4] text-[#4c514c]">
        <div className="flex items-center gap-3 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking your studio access…
        </div>
      </main>
    );
  }

  return (
    <Workspace
      section={section}
      onSectionChange={setSection}
      profileName={profileName}
      shoots={shoots}
      team={team}
      loading={loadingData}
      error={dataError}
      demoMode={demoMode}
      onRefresh={() => void loadWorkspace()}
      onSignOut={() => void handleSignOut()}
    />
  );
}

function SignInScreen({
  error,
  loading,
  onSubmit,
  onDemo,
  onDismissError,
}: {
  error: string;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDemo: () => void;
  onDismissError: () => void;
}) {
  return (
    <main className="grid min-h-screen bg-[#fbfaf7] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#30382f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_20%,rgba(205,174,126,0.24),transparent_38%),linear-gradient(145deg,transparent_35%,rgba(12,18,12,0.65))]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full border border-white/30">
            <Camera className="size-5" strokeWidth={1.5} />
          </span>
          <span className="font-serif text-xl tracking-wide">TA BRIDALS</span>
        </div>
        <div className="relative max-w-xl pb-6">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#d7c4a5]">
            The studio workspace
          </p>
          <h1 className="font-serif text-5xl leading-[1.13] xl:text-6xl">
            Thoughtfully planned.
            <br />
            <span className="italic text-[#d7c4a5]">Beautifully captured.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/70">
            A quieter way to manage your shoots, your schedule, and the people behind every
            unforgettable moment.
          </p>
        </div>
        <p className="relative text-xs text-white/45">A little more room for the work you love.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-14">
        <div className="w-full max-w-[390px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-full bg-[#30382f] text-white">
              <Camera className="size-5" strokeWidth={1.5} />
            </span>
            <span className="font-serif text-lg tracking-wide text-[#30382f]">TA BRIDALS</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b806f]">
            Welcome back
          </p>
          <h2 className="mt-3 font-serif text-4xl text-[#30382f]">Your studio, in sync.</h2>
          <p className="mt-3 text-sm leading-6 text-[#77786f]">
            Sign in with your owner account to open your workspace.
          </p>

          <form className="mt-9 space-y-5" onSubmit={onSubmit}>
            <label className="block space-y-2 text-sm font-medium text-[#444941]">
              Email address
              <Input
                className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-[#444941]">
              Password
              <Input
                className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>
            {error && (
              <div
                className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={onDismissError}
                  className="shrink-0 font-medium underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            )}
            <Button
              className="h-12 w-full rounded-lg bg-[#344234] text-sm text-white hover:bg-[#283528]"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign in to your studio"
              )}
            </Button>
            <div className="relative py-1 text-center text-[11px] text-[#a09b90]">
              <span className="bg-[#fbfaf7] px-3">or take a look around</span>
            </div>
            <Button
              className="h-11 w-full rounded-lg border-[#dedbd2] bg-transparent text-sm text-[#465143] hover:bg-[#f1f0e9]"
              type="button"
              variant="outline"
              onClick={onDemo}
            >
              Explore demo workspace
            </Button>
            <p className="text-center text-[11px] leading-5 text-[#89877e]">
              Sample data only. No sign-in needed.
            </p>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-[#89877e]">
            Real studio data is only available to the owner account.
          </p>
        </div>
      </section>
    </main>
  );
}

function Workspace({
  section,
  onSectionChange,
  profileName,
  shoots,
  team,
  loading,
  error,
  demoMode,
  onRefresh,
  onSignOut,
}: {
  section: Section;
  onSectionChange: (section: Section) => void;
  profileName: string;
  shoots: Shoot[];
  team: TeamMember[];
  loading: boolean;
  error: string;
  demoMode: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const copy = sectionCopy[section];
  const firstName = profileName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#343a33]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[248px] flex-col border-r border-[#e9e7df] bg-white px-5 py-7 lg:flex">
        <Brand />
        <p className="mb-3 mt-12 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#aaa69b]">
          Workspace
        </p>
        <nav className="space-y-1" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              aria-current={section === id ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                section === id
                  ? "bg-[#eef0eb] font-medium text-[#344234]"
                  : "text-[#74766e] hover:bg-[#f7f6f2] hover:text-[#343a33]"
              }`}
            >
              <Icon className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
              {label}
              {id === "shoots" && shoots.length > 0 && (
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-[#77786f]">
                  {shoots.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-[#f7f6f2] p-4">
          <p className="text-xs font-medium text-[#464c44]">A note for today</p>
          <p className="mt-2 text-xs leading-5 text-[#818177]">
            Good planning makes space for the magic.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-5 flex items-center gap-3 px-3 py-2 text-sm text-[#76776f] hover:text-[#343a33]"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-[5] border-b border-[#e9e7df] bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Brand compact />
            </div>
            <nav
              className="flex items-center gap-1 overflow-x-auto lg:hidden"
              aria-label="Mobile navigation"
            >
              {navigation.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSectionChange(id)}
                  aria-current={section === id ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-2.5 py-2 text-xs ${
                    section === id ? "bg-[#eef0eb] font-medium text-[#344234]" : "text-[#76776f]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-[#42483f]">{profileName}</p>
                <p className="mt-0.5 text-[10px] text-[#99968c]">Studio owner</p>
              </div>
              <div
                className="grid size-9 place-items-center rounded-full bg-[#e9ece5] text-xs font-semibold text-[#435040]"
                aria-hidden="true"
              >
                {firstName.slice(0, 1).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-md p-2 text-[#8a897f] hover:bg-[#f5f4f0] lg:hidden"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
          {demoMode && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6dfce] bg-[#f4f0e6] px-4 py-3">
              <p className="text-xs text-[#665e4d]">
                <span className="font-semibold">Demo workspace</span>
                <span className="mx-2 text-[#b0a78f]" aria-hidden="true">
                  ·
                </span>
                Sample data only. Nothing here is connected to your studio.
              </p>
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs font-medium text-[#56634f] underline underline-offset-2 hover:text-[#344234]"
              >
                Exit demo
              </button>
            </div>
          )}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-[#9a8c77]">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
              <h1 className="font-serif text-[32px] leading-tight text-[#343a33] sm:text-[38px]">
                {section === "overview" ? `Good to see you, ${firstName}.` : copy.title}
              </h1>
              <p className="mt-2 text-sm text-[#818177]">{copy.description}</p>
            </div>
            {loading && (
              <span className="flex items-center gap-2 pb-1 text-xs text-[#77786f]">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Updating
              </span>
            )}
          </div>

          {error ? (
            <div
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-white p-5"
              role="alert"
            >
              <div>
                <p className="text-sm font-medium text-red-900">Your studio data couldn't load.</p>
                <p className="mt-1 text-xs text-red-800">{error}</p>
              </div>
              <Button variant="outline" onClick={onRefresh}>
                Try again
              </Button>
            </div>
          ) : section === "overview" ? (
            <Overview shoots={shoots} team={team} loading={loading} onNavigate={onSectionChange} />
          ) : section === "shoots" ? (
            <ShootsView shoots={shoots} loading={loading} />
          ) : section === "calendar" ? (
            <CalendarView shoots={shoots} loading={loading} />
          ) : (
            <TeamView team={team} loading={loading} />
          )}
        </main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#344234] text-white">
        <Camera className="size-[17px]" strokeWidth={1.6} aria-hidden="true" />
      </span>
      {!compact && (
        <span>
          <span className="block font-serif text-base tracking-[0.08em] text-[#344234]">
            TA BRIDALS
          </span>
          <span className="mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-[#969287]">
            Studio management
          </span>
        </span>
      )}
    </div>
  );
}

function Overview({
  shoots,
  team,
  loading,
  onNavigate,
}: {
  shoots: Shoot[];
  team: TeamMember[];
  loading: boolean;
  onNavigate: (section: Section) => void;
}) {
  const today = new Date();
  const upcoming = shoots.filter(
    (shoot) => shoot.status === "Upcoming" && parseISO(shoot.event_date) >= startOfDay(today),
  );
  const thisMonth = shoots.filter(
    (shoot) => shoot.status !== "Cancelled" && isSameMonth(parseISO(shoot.event_date), today),
  );
  const availableCount = team.filter((member) => member.available).length;

  return (
    <div className="space-y-7">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Upcoming shoots"
          value={upcoming.length}
          caption="Ready for the calendar"
        >
          <CalendarDays className="size-[18px]" />
        </MetricCard>
        <MetricCard
          label="This month"
          value={thisMonth.length}
          caption={format(today, "MMMM yyyy")}
        >
          <Camera className="size-[18px]" />
        </MetricCard>
        <MetricCard
          label="Available team"
          value={availableCount}
          caption={`of ${team.length} members`}
        >
          <Users className="size-[18px]" />
        </MetricCard>
        <MetricCard
          label="Team coverage"
          value={team.length ? `${Math.round((availableCount / team.length) * 100)}%` : "—"}
          caption={team.length ? "Currently marked available" : "Add your team to get started"}
        >
          <Check className="size-[18px]" />
        </MetricCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efeee9] px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-[#3e453d]">Coming up</h2>
            <p className="mt-1 text-xs text-[#929086]">Your next celebrations, all in one place.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("shoots")}
            className="text-xs font-medium text-[#586651] hover:text-[#344234]"
          >
            View all shoots <span aria-hidden="true">→</span>
          </button>
        </div>
        {loading && shoots.length === 0 ? (
          <LoadingRows />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Your calendar is clear."
            detail="When you add an upcoming shoot, it'll show up here."
          />
        ) : (
          <div className="divide-y divide-[#f0efe9]">
            {upcoming.slice(0, 5).map((shoot) => (
              <ShootRow key={shoot.id} shoot={shoot} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#e9e7df] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-[#3e453d]">A lovely team</h2>
              <p className="mt-1 text-xs text-[#929086]">Your people, ready for the next story.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("team")}
              className="text-xs font-medium text-[#586651] hover:text-[#344234]"
            >
              Meet the team <span aria-hidden="true">→</span>
            </button>
          </div>
          {loading && team.length === 0 ? (
            <LoadingRows />
          ) : team.length === 0 ? (
            <EmptyState
              title="Your team starts here."
              detail="Once your team is added, you'll see them here."
            />
          ) : (
            <div className="mt-5 space-y-3">
              {team.slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar name={member.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#444941]">
                      {member.full_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#929086]">{member.role}</p>
                  </div>
                  <Availability available={member.available} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-[#344234] p-6 text-white sm:p-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d5c7ad]">
              Your studio rhythm
            </p>
            <h2 className="mt-3 max-w-sm font-serif text-2xl leading-snug">
              Make room for the moments that matter.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">
              Keep your schedule close, your team in the loop, and the beautiful details in view.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("calendar")}
            className="mt-7 flex w-fit items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/10"
          >
            Open your calendar <ChevronRight className="size-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  children,
}: {
  label: string;
  value: string | number;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e9e7df] bg-white p-5">
      <div className="flex items-center justify-between text-[#8d927f]">
        <span className="text-xs font-medium text-[#77786f]">{label}</span>
        {children}
      </div>
      <p className="mt-5 font-serif text-3xl text-[#394238]">{value}</p>
      <p className="mt-1 text-[11px] text-[#99968c]">{caption}</p>
    </div>
  );
}

function ShootsView({ shoots, loading }: { shoots: Shoot[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const filteredShoots = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return shoots.filter((shoot) =>
      [shoot.couple_name, shoot.event_type, shoot.location, shoot.venue ?? "", shoot.status]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, shoots]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-serif text-xl text-[#3e453d]">Your shoots</h2>
          <p className="mt-1 text-xs text-[#929086]">
            {shoots.length} {shoots.length === 1 ? "celebration" : "celebrations"} in your studio
          </p>
        </div>
        <label className="relative block w-full sm:max-w-[280px]">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a09d93]"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search couples, venues…"
            aria-label="Search shoots"
            className="h-10 border-[#e6e4dd] pl-9 text-sm"
          />
        </label>
      </div>
      {loading && shoots.length === 0 ? (
        <LoadingRows />
      ) : filteredShoots.length === 0 ? (
        <EmptyState
          title={query ? "No shoots found." : "Your shoot list is empty."}
          detail={
            query
              ? "Try a different name, event type, or location."
              : "Your saved shoots will appear here."
          }
        />
      ) : (
        <div className="divide-y divide-[#f0efe9]">
          {filteredShoots.map((shoot) => (
            <ShootRow key={shoot.id} shoot={shoot} />
          ))}
        </div>
      )}
    </section>
  );
}

function CalendarView({ shoots, loading }: { shoots: Shoot[]; loading: boolean }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const periodStart = view === "month" ? startOfMonth(anchor) : startOfWeek(anchor);
  const periodEnd = view === "month" ? endOfWeek(endOfMonth(anchor)) : endOfWeek(anchor);
  const days = useMemo(
    () =>
      Array.from({ length: Math.round((+periodEnd - +periodStart) / 86_400_000) + 1 }, (_, i) =>
        addDays(periodStart, i),
      ),
    [periodEnd, periodStart],
  );
  const previous = () => setAnchor(view === "month" ? subMonths(anchor, 1) : subWeeks(anchor, 1));
  const next = () => setAnchor(view === "month" ? addMonths(anchor, 1) : addWeeks(anchor, 1));
  const eventsFor = (day: Date) =>
    shoots.filter(
      (shoot) => shoot.status !== "Cancelled" && isSameDay(parseISO(shoot.event_date), day),
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h2 className="min-w-[145px] font-serif text-xl text-[#3e453d]">
            {format(anchor, "MMMM yyyy")}
          </h2>
          <button
            type="button"
            onClick={previous}
            className="rounded-md p-2 text-[#77786f] hover:bg-[#f5f4f0]"
            aria-label={`Previous ${view}`}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-md p-2 text-[#77786f] hover:bg-[#f5f4f0]"
            aria-label={`Next ${view}`}
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="rounded-md px-2 py-1 text-xs text-[#72766b] hover:bg-[#f5f4f0]"
          >
            Today
          </button>
        </div>
        <div className="flex rounded-lg bg-[#f5f4f0] p-1" aria-label="Calendar view">
          {(["month", "week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`rounded-md px-3 py-1.5 text-xs capitalize ${
                view === option ? "bg-white font-medium text-[#42483f] shadow-sm" : "text-[#818177]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {loading && shoots.length === 0 ? (
        <LoadingRows />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-[#efeee9]">
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className="py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#99968c]"
                >
                  {format(addDays(startOfWeek(new Date()), i), "EEE")}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const events = eventsFor(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[112px] border-b border-r border-[#f0efe9] p-2.5 ${
                      view === "month" && !isSameMonth(day, anchor) ? "bg-[#fbfaf8]" : ""
                    }`}
                  >
                    <span
                      className={`grid size-7 place-items-center rounded-full text-xs ${
                        isToday(day)
                          ? "bg-[#344234] font-medium text-white"
                          : isSameMonth(day, anchor)
                            ? "text-[#565b52]"
                            : "text-[#bbb8ae]"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {events.slice(0, 2).map((shoot) => (
                        <div
                          key={shoot.id}
                          className="truncate rounded bg-[#eef0eb] px-1.5 py-1 text-[10px] text-[#4c5847]"
                          title={`${shoot.couple_name} · ${shoot.event_type}`}
                        >
                          {shoot.couple_name}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <p className="px-1 text-[9px] text-[#838177]">+{events.length - 2} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!loading && shoots.length === 0 && (
        <p className="px-5 py-3 text-center text-xs text-[#929086]">
          No shoots yet — your calendar is ready when you are.
        </p>
      )}
    </section>
  );
}

function TeamView({ team, loading }: { team: TeamMember[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const filteredTeam = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return team.filter((member) =>
      [member.full_name, member.role, member.email ?? "", member.phone ?? ""]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, team]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-serif text-xl text-[#3e453d]">Meet your team</h2>
          <p className="mt-1 text-xs text-[#929086]">
            {team.length} {team.length === 1 ? "person" : "people"} in your studio
          </p>
        </div>
        <label className="relative block w-full sm:max-w-[280px]">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a09d93]"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your team…"
            aria-label="Search team"
            className="h-10 border-[#e6e4dd] pl-9 text-sm"
          />
        </label>
      </div>
      {loading && team.length === 0 ? (
        <LoadingRows />
      ) : filteredTeam.length === 0 ? (
        <EmptyState
          title={query ? "No team members found." : "Your team is ready to meet."}
          detail={
            query
              ? "Try another name, role, or contact detail."
              : "Team members will appear here once added."
          }
        />
      ) : (
        <div className="grid gap-px bg-[#f0efe9] sm:grid-cols-2 xl:grid-cols-3">
          {filteredTeam.map((member) => (
            <article key={member.id} className="flex min-w-0 items-start gap-3 bg-white p-5">
              <Avatar name={member.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#444941]">{member.full_name}</p>
                <p className="mt-1 text-xs text-[#87867d]">{member.role}</p>
                {member.email && (
                  <a
                    className="mt-3 block truncate text-xs text-[#75806c] hover:underline"
                    href={`mailto:${member.email}`}
                  >
                    {member.email}
                  </a>
                )}
                {member.phone && (
                  <a
                    className="mt-1 block text-xs text-[#75806c] hover:underline"
                    href={`tel:${member.phone}`}
                  >
                    {member.phone}
                  </a>
                )}
              </div>
              <Availability available={member.available} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ShootRow({ shoot }: { shoot: Shoot }) {
  return (
    <article className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f1f2ed] text-center text-[#59654f]">
        <span className="text-[9px] font-semibold uppercase leading-none">
          {format(parseISO(shoot.event_date), "MMM")}
        </span>
        <span className="font-serif text-lg leading-none">
          {format(parseISO(shoot.event_date), "d")}
        </span>
      </div>
      <div className="min-w-[155px] flex-1">
        <p className="text-sm font-medium text-[#42483f]">{shoot.couple_name}</p>
        <p className="mt-1 text-xs text-[#8d8b81]">{shoot.event_type}</p>
      </div>
      <div className="hidden min-w-[150px] items-center gap-2 text-xs text-[#77786f] md:flex">
        <MapPin className="size-3.5 shrink-0 text-[#a19e93]" aria-hidden="true" />
        <span className="truncate">{shoot.venue || shoot.location}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-[#77786f]">
        <Clock3 className="size-3.5 text-[#a19e93]" aria-hidden="true" />
        {formatTime(shoot.start_time)}
      </div>
      <StatusBadge status={shoot.status} />
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    Upcoming: "bg-[#eef0eb] text-[#56634f]",
    "In Progress": "bg-[#fbf2e6] text-[#9a713c]",
    Completed: "bg-[#edf3ef] text-[#587462]",
    Cancelled: "bg-[#f7ecea] text-[#96615b]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${palette[status] ?? "bg-[#f1f0eb] text-[#77786f]"}`}
    >
      {status}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9ece5] text-xs font-semibold text-[#59654f]"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function Availability({ available }: { available: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 text-[10px] ${
        available ? "text-[#69806a]" : "text-[#969287]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${available ? "bg-[#82a17f]" : "bg-[#c0bdb3]"}`} />
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 px-5 py-5" aria-label="Loading studio data">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex animate-pulse items-center gap-3">
          <span className="size-10 rounded-xl bg-[#f0efe9]" />
          <span className="h-3 w-36 rounded bg-[#f0efe9]" />
          <span className="ml-auto h-3 w-20 rounded bg-[#f0efe9]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-5 py-10 text-center sm:py-12">
      <p className="font-serif text-lg text-[#52594e]">{title}</p>
      <p className="mt-2 text-xs text-[#929086]">{detail}</p>
    </div>
  );
}

function formatTime(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  return format(new Date(2000, 0, 1, Number(hours), Number(minutes)), "h:mm a");
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
