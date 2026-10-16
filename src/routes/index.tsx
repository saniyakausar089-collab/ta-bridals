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
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type Assignment = Tables<"shoot_assignments">;
type ShootInput = TablesInsert<"shoots">;
type TeamMemberInput = TablesInsert<"team_members">;
type AssignmentInput = Pick<Assignment, "team_member_id" | "assignment_type">;
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

const demoAssignments: Assignment[] = [
  {
    id: "demo-assignment-1",
    shoot_id: "demo-shoot-1",
    team_member_id: "demo-member-1",
    assignment_type: "on_site",
    created_at: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "demo-assignment-2",
    shoot_id: "demo-shoot-1",
    team_member_id: "demo-member-2",
    assignment_type: "on_site",
    created_at: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "demo-assignment-3",
    shoot_id: "demo-shoot-1",
    team_member_id: "demo-member-3",
    assignment_type: "post_production",
    created_at: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "demo-assignment-4",
    shoot_id: "demo-shoot-2",
    team_member_id: "demo-member-1",
    assignment_type: "on_site",
    created_at: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "demo-assignment-5",
    shoot_id: "demo-shoot-3",
    team_member_id: "demo-member-4",
    assignment_type: "on_site",
    created_at: "2026-10-01T09:00:00.000Z",
  },
];

const navigation: {
  id: Section;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Dashboard", mobileLabel: "Home", icon: LayoutDashboard },
  { id: "shoots", label: "All Shoots", mobileLabel: "Shoots", icon: Camera },
  { id: "calendar", label: "Calendar", mobileLabel: "Calendar", icon: CalendarDays },
  { id: "team", label: "Team Overview", mobileLabel: "Team", icon: Users },
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
  const [globalQuery, setGlobalQuery] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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
      setAssignments(demoAssignments);
      setLoadingData(false);
      return;
    }
    try {
      const [shootResult, teamResult, assignmentResult] = await Promise.all([
        supabase.from("shoots").select("*").order("event_date", { ascending: true }),
        supabase.from("team_members").select("*").order("full_name", { ascending: true }),
        supabase.from("shoot_assignments").select("*"),
      ]);
      if (shootResult.error) throw shootResult.error;
      if (teamResult.error) throw teamResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      setShoots(shootResult.data);
      setTeam(teamResult.data);
      setAssignments(assignmentResult.data);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "We couldn't load your studio data.");
    } finally {
      setLoadingData(false);
    }
  }, [demoMode]);

  async function saveShoot(values: ShootInput, shootId?: string) {
    if (!session || demoMode) throw new Error("Sign in as the studio owner to save shoots.");
    const result = shootId
      ? await supabase.from("shoots").update(values).eq("id", shootId).select().single()
      : await supabase
          .from("shoots")
          .insert({ ...values, created_by: session.user.id })
          .select()
          .single();
    if (result.error) throw result.error;
    setShoots((current) =>
      [...current.filter((shoot) => shoot.id !== result.data.id), result.data].sort((a, b) =>
        a.event_date.localeCompare(b.event_date),
      ),
    );
  }

  async function deleteShoot(shootId: string) {
    if (!session || demoMode) throw new Error("Sign in as the studio owner to delete shoots.");
    const { error } = await supabase.from("shoots").delete().eq("id", shootId);
    if (error) throw error;
    setShoots((current) => current.filter((shoot) => shoot.id !== shootId));
    setAssignments((current) => current.filter((assignment) => assignment.shoot_id !== shootId));
  }

  async function saveShootAssignments(shootId: string, values: AssignmentInput[]) {
    if (!session || demoMode)
      throw new Error("Sign in as the studio owner to manage shoot assignments.");
    const { error } = await supabase.rpc("replace_shoot_assignments", {
      p_shoot_id: shootId,
      p_assignments: values,
    });
    if (error) throw error;
    const { data, error: loadError } = await supabase.from("shoot_assignments").select("*");
    if (loadError) throw loadError;
    setAssignments(data);
  }

  async function saveTeamMember(values: TeamMemberInput, memberId?: string) {
    if (!session || demoMode) throw new Error("Sign in as the studio owner to save team members.");
    const result = memberId
      ? await supabase.from("team_members").update(values).eq("id", memberId).select().single()
      : await supabase.from("team_members").insert(values).select().single();
    if (result.error) throw result.error;
    setTeam((current) =>
      [...current.filter((member) => member.id !== result.data.id), result.data].sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      ),
    );
  }

  async function deleteTeamMember(memberId: string) {
    if (!session || demoMode)
      throw new Error("Sign in as the studio owner to remove team members.");
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) throw error;
    setTeam((current) => current.filter((member) => member.id !== memberId));
    setAssignments((current) =>
      current.filter((assignment) => assignment.team_member_id !== memberId),
    );
  }

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
      setAssignments([]);
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
    setAssignments([]);
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
      globalQuery={globalQuery}
      onGlobalQueryChange={setGlobalQuery}
      profileName={profileName}
      shoots={shoots}
      team={team}
      assignments={assignments}
      loading={loadingData}
      error={dataError}
      demoMode={demoMode}
      onRefresh={() => void loadWorkspace()}
      onSignOut={() => void handleSignOut()}
      onSaveShoot={saveShoot}
      onDeleteShoot={deleteShoot}
      onSaveAssignments={saveShootAssignments}
      onSaveTeamMember={saveTeamMember}
      onDeleteTeamMember={deleteTeamMember}
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
  globalQuery,
  onGlobalQueryChange,
  profileName,
  shoots,
  team,
  assignments,
  loading,
  error,
  demoMode,
  onRefresh,
  onSignOut,
  onSaveShoot,
  onDeleteShoot,
  onSaveAssignments,
  onSaveTeamMember,
  onDeleteTeamMember,
}: {
  section: Section;
  onSectionChange: (section: Section) => void;
  globalQuery: string;
  onGlobalQueryChange: (query: string) => void;
  profileName: string;
  shoots: Shoot[];
  team: TeamMember[];
  assignments: Assignment[];
  loading: boolean;
  error: string;
  demoMode: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  onSaveShoot: (values: ShootInput, shootId?: string) => Promise<void>;
  onDeleteShoot: (shootId: string) => Promise<void>;
  onSaveAssignments: (shootId: string, values: AssignmentInput[]) => Promise<void>;
  onSaveTeamMember: (values: TeamMemberInput, memberId?: string) => Promise<void>;
  onDeleteTeamMember: (memberId: string) => Promise<void>;
}) {
  const copy = sectionCopy[section];
  const firstName = profileName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="studio-app min-h-screen bg-[#f8f7f4] text-[#343a33]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[196px] flex-col border-r border-[#e9e7df] bg-white px-4 py-6 lg:flex">
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
          <p className="font-serif text-sm italic text-[#586651]">
            Weddings are better with the right team.
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

      <div className="lg:pl-[196px]">
        <header className="sticky top-0 z-[5] border-b border-[#e9e7df] bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[62px] max-w-[1440px] items-center justify-between px-5 sm:px-7">
            <div className="flex items-center gap-3 lg:hidden">
              <Brand compact />
            </div>
            <nav
              className="flex items-center gap-1 overflow-x-auto lg:hidden"
              aria-label="Mobile navigation"
            >
              {navigation.map(({ id, mobileLabel }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSectionChange(id)}
                  aria-current={section === id ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-2.5 py-2 text-xs ${
                    section === id ? "bg-[#eef0eb] font-medium text-[#344234]" : "text-[#76776f]"
                  }`}
                >
                  {mobileLabel}
                </button>
              ))}
            </nav>
            <label className="relative hidden max-w-sm flex-1 md:block lg:ml-5">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a09d93]"
                aria-hidden="true"
              />
              <Input
                className="h-9 border-[#e6e4dd] bg-[#f8f7f4] pl-9 text-xs"
                placeholder="Search your studio"
                aria-label="Search your studio"
                value={globalQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  onGlobalQueryChange(value);
                  const query = value.trim().toLocaleLowerCase();
                  if (!query) return;
                  const shootMatch = shoots.some((shoot) =>
                    [shoot.couple_name, shoot.event_type, shoot.location, shoot.venue ?? ""]
                      .join(" ")
                      .toLocaleLowerCase()
                      .includes(query),
                  );
                  const teamMatch = team.some((member) =>
                    [member.full_name, member.role, member.email ?? "", member.phone ?? ""]
                      .join(" ")
                      .toLocaleLowerCase()
                      .includes(query),
                  );
                  onSectionChange(shootMatch || !teamMatch ? "shoots" : "team");
                }}
              />
            </label>
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

        <main className="studio-main mx-auto max-w-[1440px] px-5 py-6 sm:px-7">
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
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
                {section === "overview" ? "WEDDING STUDIO · " : ""}
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
              <h1 className="font-serif text-[30px] leading-tight text-[#343a33] sm:text-[34px]">
                {section === "overview" ? "Welcome back, TA Bridals." : copy.title}
              </h1>
              <p className="mt-2 text-sm text-[#818177]">
                {section === "overview"
                  ? "Manage your shoots, team assignments and upcoming events — all in one place."
                  : copy.description}
              </p>
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
            <Overview
              shoots={shoots}
              team={team}
              assignments={assignments}
              loading={loading}
              onNavigate={onSectionChange}
            />
          ) : section === "shoots" ? (
            <ShootsView
              shoots={shoots}
              assignments={assignments}
              loading={loading}
              externalQuery={globalQuery}
              editable={!demoMode}
              onSaveShoot={onSaveShoot}
              onDeleteShoot={onDeleteShoot}
              team={team}
              allShoots={shoots}
              onSaveAssignments={onSaveAssignments}
            />
          ) : section === "calendar" ? (
            <CalendarView shoots={shoots} loading={loading} />
          ) : (
            <TeamView
              team={team}
              loading={loading}
              externalQuery={globalQuery}
              editable={!demoMode}
              onSaveTeamMember={onSaveTeamMember}
              onDeleteTeamMember={onDeleteTeamMember}
            />
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
            Capturing your forever
          </span>
        </span>
      )}
    </div>
  );
}

function Overview({
  shoots,
  team,
  assignments,
  loading,
  onNavigate,
}: {
  shoots: Shoot[];
  team: TeamMember[];
  assignments: Assignment[];
  loading: boolean;
  onNavigate: (section: Section) => void;
}) {
  const today = new Date();
  const upcoming = shoots.filter(
    (shoot) => shoot.status === "Upcoming" && parseISO(shoot.event_date) >= startOfDay(today),
  );
  const inProgress = shoots.filter((shoot) => shoot.status === "In Progress");
  const completed = shoots.filter((shoot) => shoot.status === "Completed");
  const receptions = upcoming.filter((shoot) => shoot.event_type === "Reception");
  const upcomingIds = new Set(upcoming.map((shoot) => shoot.id));
  const onSiteAssignments = assignments.filter(
    (assignment) =>
      assignment.assignment_type === "on_site" && upcomingIds.has(assignment.shoot_id),
  );
  const assignedMemberIds = new Set(
    onSiteAssignments.map((assignment) => assignment.team_member_id),
  );
  const teamRequired = upcoming.reduce((total, shoot) => total + shoot.planned_team_size, 0);
  const shootsNeedingTeam = upcoming.filter(
    (shoot) =>
      onSiteAssignments.filter((assignment) => assignment.shoot_id === shoot.id).length <
      shoot.planned_team_size,
  );
  const nextSevenDays = upcoming.filter(
    (shoot) => parseISO(shoot.event_date) < addDays(startOfDay(today), 7),
  );
  const availableCount = team.filter((member) => member.available).length;

  return (
    <div className="space-y-5">
      <section className="studio-hero relative flex min-h-[176px] items-end overflow-hidden rounded-2xl border border-[#30282e] p-6 sm:min-h-[194px] sm:p-8">
        <div className="relative z-[1] max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e7a0ad]">
            CAPTURING YOUR FOREVER
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#f7f0ee] sm:text-4xl">
            Every love story deserves a perfect team.
          </h2>
          <p className="mt-2 max-w-lg text-xs leading-5 text-[#c7bbc0]">
            Your upcoming celebrations, people and plans — thoughtfully together.
          </p>
        </div>
        <Sparkles
          className="absolute bottom-8 right-8 hidden size-7 text-[#d9b98c]/75 xl:block"
          strokeWidth={1}
          aria-hidden="true"
        />
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-8">
        <MetricCard label="Upcoming shoots" value={upcoming.length} caption="On the calendar">
          <CalendarDays className="size-4" />
        </MetricCard>
        <MetricCard label="In progress" value={inProgress.length} caption="Happening now">
          <Camera className="size-4" />
        </MetricCard>
        <MetricCard label="Completed" value={completed.length} caption="Stories captured">
          <Check className="size-4" />
        </MetricCard>
        <MetricCard
          label="Upcoming receptions"
          value={receptions.length}
          caption="Celebrations ahead"
        >
          <Sparkles className="size-4" />
        </MetricCard>
        <MetricCard label="Crew required" value={teamRequired} caption="Upcoming shoots">
          <Users className="size-4" />
        </MetricCard>
        <MetricCard
          label="Crew assigned"
          value={assignedMemberIds.size}
          caption="Unique on-site people"
        >
          <Check className="size-4" />
        </MetricCard>
        <MetricCard
          label="Need a team"
          value={shootsNeedingTeam.length}
          caption="Under planned size"
        >
          <Users className="size-4" />
        </MetricCard>
        <MetricCard
          label="Next 7 days"
          value={nextSevenDays.length}
          caption="Upcoming celebrations"
        >
          <Clock3 className="size-4" />
        </MetricCard>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(350px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efeee9] px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-serif text-xl text-[#3e453d]">Upcoming shoots</h2>
              <p className="mt-1 text-xs text-[#929086]">
                Your next celebrations, all in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("shoots")}
              className="text-xs font-medium text-[#586651] hover:text-[#344234]"
            >
              View all <span aria-hidden="true">→</span>
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
                <ShootRow
                  key={shoot.id}
                  shoot={shoot}
                  assignedCount={
                    onSiteAssignments.filter((assignment) => assignment.shoot_id === shoot.id)
                      .length
                  }
                />
              ))}
            </div>
          )}
        </section>

        <CalendarView shoots={shoots} loading={loading} compact />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#e9e7df] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-[#3e453d]">Team overview</h2>
              <p className="mt-1 text-xs text-[#929086]">
                {team.length} registered · {availableCount} available
              </p>
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
            <>
              <div className="mb-4 mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TeamSummary
                  label="Photographers"
                  value={team.filter((member) => member.role.includes("Photographer")).length}
                />
                <TeamSummary
                  label="Videographers"
                  value={team.filter((member) => member.role.includes("Videographer")).length}
                />
                <TeamSummary
                  label="Editors & design"
                  value={
                    team.filter(
                      (member) =>
                        member.role.includes("Editor") || member.role.includes("Designer"),
                    ).length
                  }
                />
                <TeamSummary label="Available" value={availableCount} />
              </div>
              <div className="space-y-3">
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
            </>
          )}
        </div>
        <div className="studio-feature-panel flex flex-col justify-between rounded-2xl bg-[#344234] p-6 text-white sm:p-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d5c7ad]">
              A NOTE FOR THE STUDIO
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

function TeamSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e9e7df] bg-[#f8f7f4] px-3 py-2.5">
      <p className="text-lg font-medium text-[#3e453d]">{value}</p>
      <p className="mt-1 text-[10px] text-[#929086]">{label}</p>
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

function ShootsView({
  shoots,
  assignments,
  loading,
  externalQuery = "",
  editable,
  onSaveShoot,
  onDeleteShoot,
  team,
  allShoots,
  onSaveAssignments,
}: {
  shoots: Shoot[];
  assignments: Assignment[];
  loading: boolean;
  externalQuery?: string;
  editable: boolean;
  onSaveShoot: (values: ShootInput, shootId?: string) => Promise<void>;
  onDeleteShoot: (shootId: string) => Promise<void>;
  team: TeamMember[];
  allShoots: Shoot[];
  onSaveAssignments: (shootId: string, values: AssignmentInput[]) => Promise<void>;
}) {
  const [query, setQuery] = useState(externalQuery);
  const [eventType, setEventType] = useState("All event types");
  const [status, setStatus] = useState("All statuses");
  const [editingShoot, setEditingShoot] = useState<Shoot | null | undefined>(undefined);
  const [assigningShoot, setAssigningShoot] = useState<Shoot | null>(null);
  const [actionError, setActionError] = useState("");
  useEffect(() => setQuery(externalQuery), [externalQuery]);
  const filteredShoots = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return shoots.filter(
      (shoot) =>
        (eventType === "All event types" || shoot.event_type === eventType) &&
        (status === "All statuses" || shoot.status === status) &&
        [shoot.couple_name, shoot.event_type, shoot.location, shoot.venue ?? "", shoot.status]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
    );
  }, [eventType, query, shoots, status]);

  async function confirmDelete(shoot: Shoot) {
    if (
      !window.confirm(
        `Delete the shoot for ${shoot.couple_name}? This also removes its assignments.`,
      )
    )
      return;
    setActionError("");
    try {
      await onDeleteShoot(shoot.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete this shoot.");
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-[#3e453d]">Your shoots</h2>
            <p className="mt-1 text-xs text-[#929086]">
              {shoots.length} {shoots.length === 1 ? "celebration" : "celebrations"} in your studio
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative block min-w-[180px] flex-1 sm:max-w-[240px]">
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
            <select
              className="h-10 rounded-md border px-3 text-xs"
              aria-label="Filter by event type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              <option>All event types</option>
              <option>Wedding</option>
              <option>Reception</option>
              <option>Engagement</option>
              <option>Pre-wedding</option>
              <option>Other</option>
            </select>
            <select
              className="h-10 rounded-md border px-3 text-xs"
              aria-label="Filter by shoot status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option>All statuses</option>
              <option>Upcoming</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
            {editable && (
              <Button
                className="h-10 gap-2 rounded-lg bg-[#344234] text-xs text-white"
                onClick={() => setEditingShoot(null)}
              >
                <Plus className="size-4" /> Add shoot
              </Button>
            )}
          </div>
        </div>
        {actionError && (
          <p className="border-b border-red-200 px-5 py-3 text-xs text-red-700" role="alert">
            {actionError}
          </p>
        )}
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
              <ShootRow
                key={shoot.id}
                shoot={shoot}
                assignedCount={
                  assignments.filter(
                    (assignment) =>
                      assignment.shoot_id === shoot.id && assignment.assignment_type === "on_site",
                  ).length
                }
                onEdit={editable ? () => setEditingShoot(shoot) : undefined}
                onDelete={editable ? () => void confirmDelete(shoot) : undefined}
                onAssign={editable ? () => setAssigningShoot(shoot) : undefined}
              />
            ))}
          </div>
        )}
      </section>
      {editingShoot !== undefined && (
        <ShootEditor
          key={editingShoot?.id ?? "new-shoot"}
          shoot={editingShoot}
          onClose={() => setEditingShoot(undefined)}
          onSave={onSaveShoot}
        />
      )}
      {assigningShoot && (
        <AssignmentEditor
          shoot={assigningShoot}
          team={team}
          shoots={allShoots}
          assignments={assignments}
          onClose={() => setAssigningShoot(null)}
          onSave={onSaveAssignments}
        />
      )}
    </>
  );
}

function ShootEditor({
  shoot,
  onClose,
  onSave,
}: {
  shoot: Shoot | null;
  onClose: () => void;
  onSave: (values: ShootInput, shootId?: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const venue = String(form.get("venue") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const values: ShootInput = {
      couple_name: String(form.get("couple_name") ?? "").trim(),
      event_type: String(form.get("event_type") ?? "Wedding"),
      event_date: String(form.get("event_date") ?? ""),
      location: String(form.get("location") ?? "").trim(),
      venue: venue || null,
      start_time: String(form.get("start_time") ?? ""),
      end_time: String(form.get("end_time") ?? "") || null,
      planned_team_size: Number(form.get("planned_team_size")),
      status: String(form.get("status") ?? "Upcoming"),
      notes: notes || null,
    };
    try {
      await onSave(values, shoot?.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this shoot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shoot-editor-title"
      >
        <div className="mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
            STUDIO SCHEDULE
          </p>
          <h2 id="shoot-editor-title" className="mt-2 font-serif text-2xl">
            {shoot ? "Edit shoot details" : "Add a shoot"}
          </h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="studio-field sm:col-span-2">
              Couple / client
              <Input
                name="couple_name"
                defaultValue={shoot?.couple_name}
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <label className="studio-field">
              Event type
              <select name="event_type" defaultValue={shoot?.event_type ?? "Wedding"} required>
                <option>Wedding</option>
                <option>Reception</option>
                <option>Engagement</option>
                <option>Pre-wedding</option>
                <option>Other</option>
              </select>
            </label>
            <label className="studio-field">
              Date
              <Input
                name="event_date"
                type="date"
                defaultValue={shoot?.event_date ?? format(new Date(), "yyyy-MM-dd")}
                required
              />
            </label>
            <label className="studio-field">
              Location
              <Input name="location" defaultValue={shoot?.location} maxLength={160} required />
            </label>
            <label className="studio-field">
              Venue <span className="font-normal text-[#82767d]">· optional</span>
              <Input name="venue" defaultValue={shoot?.venue ?? ""} maxLength={160} />
            </label>
            <label className="studio-field">
              Start time
              <Input
                name="start_time"
                type="time"
                defaultValue={shoot?.start_time.slice(0, 5) ?? "09:00"}
                required
              />
            </label>
            <label className="studio-field">
              End time <span className="font-normal text-[#82767d]">· optional</span>
              <Input
                name="end_time"
                type="time"
                defaultValue={shoot?.end_time?.slice(0, 5) ?? ""}
              />
            </label>
            <label className="studio-field">
              Planned team size
              <Input
                name="planned_team_size"
                type="number"
                min={7}
                max={20}
                defaultValue={shoot?.planned_team_size ?? 7}
                required
              />
            </label>
            <label className="studio-field">
              Shoot status
              <select name="status" defaultValue={shoot?.status ?? "Upcoming"}>
                <option>Upcoming</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </label>
            <label className="studio-field sm:col-span-2">
              Notes <span className="font-normal text-[#82767d]">· optional</span>
              <textarea name="notes" maxLength={2000} defaultValue={shoot?.notes ?? ""} rows={3} />
            </label>
          </div>
          {error && (
            <p
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : shoot ? "Save changes" : "Add shoot"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AssignmentEditor({
  shoot,
  team,
  shoots,
  assignments,
  onClose,
  onSave,
}: {
  shoot: Shoot;
  team: TeamMember[];
  shoots: Shoot[];
  assignments: Assignment[];
  onClose: () => void;
  onSave: (shootId: string, values: AssignmentInput[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AssignmentInput[]>(() =>
    assignments
      .filter((assignment) => assignment.shoot_id === shoot.id)
      .map(({ team_member_id, assignment_type }) => ({ team_member_id, assignment_type })),
  );
  const [conflictsReviewed, setConflictsReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedIds = new Set(selected.map((assignment) => assignment.team_member_id));

  const conflicts = selected.flatMap((assignment) => {
    if (assignment.assignment_type !== "on_site") return [];
    return assignments
      .filter(
        (existing) =>
          existing.team_member_id === assignment.team_member_id &&
          existing.assignment_type === "on_site" &&
          existing.shoot_id !== shoot.id,
      )
      .map((existing) => shoots.find((otherShoot) => otherShoot.id === existing.shoot_id))
      .filter((otherShoot): otherShoot is Shoot => {
        if (
          !otherShoot ||
          otherShoot.status === "Cancelled" ||
          otherShoot.event_date !== shoot.event_date
        )
          return false;
        const currentStart = timeInMinutes(shoot.start_time);
        const currentEnd = timeInMinutes(shoot.end_time ?? "23:59");
        const otherStart = timeInMinutes(otherShoot.start_time);
        const otherEnd = timeInMinutes(otherShoot.end_time ?? "23:59");
        return currentStart < otherEnd && otherStart < currentEnd;
      })
      .map((otherShoot) => ({
        teamMemberId: assignment.team_member_id,
        shoot: otherShoot,
      }));
  });
  const onSiteCount = selected.filter(
    (assignment) => assignment.assignment_type === "on_site",
  ).length;
  const canSave = selected.length <= 20 && (conflicts.length === 0 || conflictsReviewed) && !saving;

  function toggleMember(memberId: string) {
    setConflictsReviewed(false);
    setSelected((current) =>
      current.some((assignment) => assignment.team_member_id === memberId)
        ? current.filter((assignment) => assignment.team_member_id !== memberId)
        : current.length >= 20
          ? current
          : [...current, { team_member_id: memberId, assignment_type: "on_site" }],
    );
  }

  function changeType(memberId: string, assignmentType: Assignment["assignment_type"]) {
    setConflictsReviewed(false);
    setSelected((current) =>
      current.map((assignment) =>
        assignment.team_member_id === memberId
          ? { ...assignment, assignment_type: assignmentType }
          : assignment,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(shoot.id, selected);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save these assignments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-editor-title"
      >
        <div className="mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
            TEAM SCHEDULING
          </p>
          <h2 id="assignment-editor-title" className="mt-2 font-serif text-2xl">
            {shoot.couple_name}
          </h2>
          <p className="mt-1 text-xs text-[#b8adb2]">
            {format(parseISO(shoot.event_date), "MMMM d, yyyy")} · {formatTime(shoot.start_time)}
          </p>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <TeamSummary label="On-site" value={onSiteCount} />
          <TeamSummary
            label="Still needed"
            value={Math.max(shoot.planned_team_size - onSiteCount, 0)}
          />
          <TeamSummary label="Capacity left" value={Math.max(20 - onSiteCount, 0)} />
        </div>
        <p className="mb-3 text-xs text-[#b8adb2]">
          Choose up to 20 unique team members. Post-production assignments don’t count toward
          on-site staffing.
        </p>
        <div className="max-h-[35dvh] overflow-y-auto rounded-lg border border-[#30282e]">
          {team.map((member) => {
            const assignment = selected.find((item) => item.team_member_id === member.id);
            return (
              <label
                key={member.id}
                className="flex flex-wrap items-center gap-3 border-b border-[#30282e] px-3 py-3 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(member.id)}
                  onChange={() => toggleMember(member.id)}
                  className="size-4 accent-[#c56c7d]"
                />
                <Avatar name={member.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-[#f7f0ee]">
                    {member.full_name}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-[#82767d]">
                    {member.role}
                    {!member.available && " · unavailable"}
                  </span>
                </span>
                {assignment && (
                  <select
                    className="rounded-md border border-[#30282e] bg-[#1b181d] px-2 py-1.5 text-[10px] text-[#b8adb2]"
                    aria-label={`${member.full_name} assignment type`}
                    value={assignment.assignment_type}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "on_site" || value === "post_production") {
                        changeType(member.id, value);
                      }
                    }}
                  >
                    <option value="on_site">On-site</option>
                    <option value="post_production">Post-production</option>
                  </select>
                )}
              </label>
            );
          })}
        </div>
        {conflicts.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3">
            <p className="text-xs font-medium text-amber-200">
              Review overlapping bookings before saving
            </p>
            <ul className="mt-2 space-y-1.5">
              {conflicts.map(({ teamMemberId, shoot: conflictingShoot }) => (
                <li
                  key={`${teamMemberId}-${conflictingShoot.id}`}
                  className="text-[11px] leading-5 text-amber-100/80"
                >
                  {team.find((member) => member.id === teamMemberId)?.full_name} is also assigned to{" "}
                  {conflictingShoot.couple_name} at {formatTime(conflictingShoot.start_time)}.
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-amber-100">
              <input
                className="mt-1 size-3 accent-[#c56c7d]"
                type="checkbox"
                checked={conflictsReviewed}
                onChange={(event) => setConflictsReviewed(event.target.checked)}
              />
              I reviewed these schedule conflicts and want to continue.
            </label>
          </div>
        )}
        {selected.length > 20 && (
          <p className="mt-3 text-xs text-red-300" role="alert">
            An event can have no more than 20 assignments.
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs text-red-300" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#30282e] pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? "Saving…" : "Save assignments"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function CalendarView({
  shoots,
  loading,
  compact = false,
}: {
  shoots: Shoot[];
  loading: boolean;
  compact?: boolean;
}) {
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null);
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
    <>
      <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h2 className="min-w-[100px] font-serif text-lg text-[#3e453d] sm:min-w-[145px] sm:text-xl">
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
                  view === option
                    ? "bg-white font-medium text-[#42483f] shadow-sm"
                    : "text-[#818177]"
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
            <div className={compact ? "min-w-0" : "min-w-[760px]"}>
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
                      className={`${compact ? "min-h-[78px]" : "min-h-[112px]"} border-b border-r border-[#f0efe9] p-2.5 ${
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
                        {events.slice(0, compact ? 1 : 2).map((shoot) => (
                          <button
                            key={shoot.id}
                            type="button"
                            onClick={() => setSelectedShoot(shoot)}
                            className="w-full truncate rounded bg-[#eef0eb] px-1.5 py-1 text-left text-[10px] text-[#4c5847]"
                            title={`${shoot.couple_name} · ${shoot.event_type}`}
                            aria-label={`View ${shoot.event_type} for ${shoot.couple_name}`}
                          >
                            {shoot.couple_name}
                          </button>
                        ))}
                        {events.length > (compact ? 1 : 2) && (
                          <p className="px-1 text-[9px] text-[#838177]">
                            +{events.length - (compact ? 1 : 2)} more
                          </p>
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
        {!loading && shoots.length > 0 && (
          <div className="border-t border-[#efeee9] p-4 md:hidden">
            <h3 className="mb-3 font-serif text-lg">This period</h3>
            <div className="space-y-2">
              {shoots
                .filter(
                  (shoot) =>
                    shoot.status !== "Cancelled" &&
                    parseISO(shoot.event_date) >= periodStart &&
                    parseISO(shoot.event_date) <= periodEnd,
                )
                .sort((a, b) => a.event_date.localeCompare(b.event_date))
                .map((shoot) => (
                  <button
                    key={shoot.id}
                    type="button"
                    onClick={() => setSelectedShoot(shoot)}
                    className="flex w-full items-center gap-3 rounded-lg border border-[#30282e] bg-[#151317] p-3 text-left"
                  >
                    <span className="font-serif text-lg text-[#e7a0ad]">
                      {format(parseISO(shoot.event_date), "d")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[#f7f0ee]">
                        {shoot.couple_name}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[#82767d]">
                        {shoot.event_type} · {formatTime(shoot.start_time)}
                      </span>
                    </span>
                    <StatusBadge status={shoot.status} />
                  </button>
                ))}
            </div>
          </div>
        )}
      </section>
      {selectedShoot && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedShoot(null);
          }}
        >
          <section
            className="studio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-shoot-title"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
              {selectedShoot.event_type}
            </p>
            <h2 id="calendar-shoot-title" className="mt-2 font-serif text-3xl">
              {selectedShoot.couple_name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={selectedShoot.status} />
              <span className="text-xs text-[#b8adb2]">
                {format(parseISO(selectedShoot.event_date), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <dl className="mt-6 grid gap-4 border-y border-[#30282e] py-5 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">Time</dt>
                <dd className="mt-1 text-sm text-[#f7f0ee]">
                  {formatTime(selectedShoot.start_time)}
                  {selectedShoot.end_time ? ` – ${formatTime(selectedShoot.end_time)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">
                  Team plan
                </dt>
                <dd className="mt-1 text-sm text-[#f7f0ee]">
                  {selectedShoot.planned_team_size} people
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">Location</dt>
                <dd className="mt-1 text-sm text-[#f7f0ee]">
                  {selectedShoot.venue ? `${selectedShoot.venue} · ` : ""}
                  {selectedShoot.location}
                </dd>
              </div>
              {selectedShoot.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-[#b8adb2]">
                    {selectedShoot.notes}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={() => setSelectedShoot(null)}>
                Close
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function TeamView({
  team,
  loading,
  externalQuery = "",
  editable,
  onSaveTeamMember,
  onDeleteTeamMember,
}: {
  team: TeamMember[];
  loading: boolean;
  externalQuery?: string;
  editable: boolean;
  onSaveTeamMember: (values: TeamMemberInput, memberId?: string) => Promise<void>;
  onDeleteTeamMember: (memberId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState(externalQuery);
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [availabilityFilter, setAvailabilityFilter] = useState("Everyone");
  const [editingMember, setEditingMember] = useState<TeamMember | null | undefined>(undefined);
  const [actionError, setActionError] = useState("");
  useEffect(() => setQuery(externalQuery), [externalQuery]);
  const filteredTeam = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return team.filter(
      (member) =>
        (roleFilter === "All roles" || member.role === roleFilter) &&
        (availabilityFilter === "Everyone" ||
          member.available === (availabilityFilter === "Available")) &&
        [member.full_name, member.role, member.email ?? "", member.phone ?? ""]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
    );
  }, [availabilityFilter, query, roleFilter, team]);

  async function confirmDelete(member: TeamMember) {
    if (
      !window.confirm(
        `Remove ${member.full_name} from the team? Their shoot assignments will also be removed.`,
      )
    )
      return;
    setActionError("");
    try {
      await onDeleteTeamMember(member.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not remove this team member.");
    }
  }

  return (
    <>
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
          <select
            className="h-10 rounded-md border px-3 text-xs"
            aria-label="Filter team by role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option>All roles</option>
            {Array.from(new Set(team.map((member) => member.role))).map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border px-3 text-xs"
            aria-label="Filter team by availability"
            value={availabilityFilter}
            onChange={(event) => setAvailabilityFilter(event.target.value)}
          >
            <option>Everyone</option>
            <option>Available</option>
            <option>Unavailable</option>
          </select>
          {editable && (
            <Button
              className="h-10 gap-2 rounded-lg bg-[#344234] text-xs text-white"
              onClick={() => setEditingMember(null)}
            >
              <Plus className="size-4" /> Add team member
            </Button>
          )}
        </div>
        {actionError && (
          <p className="border-b border-red-200 px-5 py-3 text-xs text-red-700" role="alert">
            {actionError}
          </p>
        )}
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
                  <Availability available={member.available} />
                </div>
                {editable && (
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingMember(member)}
                      className="rounded-md p-2 text-[#b8adb2] hover:bg-[#242026] hover:text-[#e7a0ad]"
                      aria-label={`Edit ${member.full_name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDelete(member)}
                      className="rounded-md p-2 text-[#b8adb2] hover:bg-[#242026] hover:text-[#f16c78]"
                      aria-label={`Remove ${member.full_name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {editingMember !== undefined && (
        <TeamMemberEditor
          key={editingMember?.id ?? "new-team-member"}
          member={editingMember}
          onClose={() => setEditingMember(undefined)}
          onSave={onSaveTeamMember}
        />
      )}
    </>
  );
}

function TeamMemberEditor({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSave: (values: TeamMemberInput, memberId?: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const roles = [
    "Photographer",
    "Videographer",
    "Photo Editor",
    "Video Editor",
    "Album Designer",
    "Cinematographer / Creative Director",
    "Drone Operator",
    "Assistant Photographer",
    "Assistant Videographer",
    "Lighting Assistant",
    "Data Manager / Footage Backup Assistant",
  ];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const values: TeamMemberInput = {
      full_name: String(form.get("full_name") ?? "").trim(),
      role: String(form.get("role") ?? roles[0]),
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      available: form.get("available") === "on",
    };
    try {
      await onSave(values, member?.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this team member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-editor-title"
      >
        <div className="mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
            YOUR STUDIO CREW
          </p>
          <h2 id="team-editor-title" className="mt-2 font-serif text-2xl">
            {member ? "Edit team member" : "Add a team member"}
          </h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="studio-field">
            Full name
            <Input
              name="full_name"
              defaultValue={member?.full_name}
              maxLength={100}
              required
              autoFocus
            />
          </label>
          <label className="studio-field">
            Primary role
            <select name="role" defaultValue={member?.role ?? roles[0]} required>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="studio-field">
              Email <span className="font-normal text-[#82767d]">· optional</span>
              <Input name="email" type="email" defaultValue={member?.email ?? ""} maxLength={255} />
            </label>
            <label className="studio-field">
              Phone <span className="font-normal text-[#82767d]">· optional</span>
              <Input name="phone" type="tel" defaultValue={member?.phone ?? ""} maxLength={32} />
            </label>
          </div>
          <label className="studio-field">
            Notes <span className="font-normal text-[#82767d]">· optional</span>
            <textarea name="notes" maxLength={1000} defaultValue={member?.notes ?? ""} rows={3} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#b8adb2]">
            <input
              name="available"
              type="checkbox"
              defaultChecked={member?.available ?? true}
              className="size-4 accent-[#c56c7d]"
            />
            Available for assignments
          </label>
          {error && (
            <p
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : member ? "Save changes" : "Add team member"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ShootRow({
  shoot,
  assignedCount,
  onEdit,
  onDelete,
  onAssign,
}: {
  shoot: Shoot;
  assignedCount?: number;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onAssign?: (() => void) | undefined;
}) {
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
      {assignedCount !== undefined && (
        <span className="hidden text-[10px] text-[#929086] sm:inline">
          {assignedCount}/{shoot.planned_team_size} crew
        </span>
      )}
      <StatusBadge status={shoot.status} />
      {(onEdit || onDelete || onAssign) && (
        <div className="ml-auto flex items-center gap-1">
          {onAssign && (
            <button
              type="button"
              onClick={onAssign}
              className="rounded-md p-2 text-[#b8adb2] hover:bg-[#242026] hover:text-[#e7a0ad]"
              aria-label={`Manage team for ${shoot.couple_name}`}
            >
              <Users className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md p-2 text-[#b8adb2] hover:bg-[#242026] hover:text-[#e7a0ad]"
              aria-label={`Edit ${shoot.couple_name} shoot`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-2 text-[#b8adb2] hover:bg-[#242026] hover:text-[#f16c78]"
              aria-label={`Delete ${shoot.couple_name} shoot`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
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
      data-status={status.toLowerCase().replaceAll(" ", "-")}
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
      data-available={available}
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

function timeInMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}
