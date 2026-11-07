import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Edit2,
  FolderKanban,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { AvailabilityRequest } from "@/lib/audit";
import {
  calculateStaffingMetrics,
  doEventsOverlap,
  findAllShootConflicts,
  findWorkerConflicts,
  formatScheduleDate,
  formatTime12Hour,
  formatTimingInterval,
  getWorkerScheduleStatus,
} from "@/lib/scheduling";
import { getAllRoles } from "@/lib/roles";

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type Assignment = Tables<"shoot_assignments">;
type ShootInput = TablesInsert<"shoots">;
type AssignmentInput = Pick<Assignment, "team_member_id" | "assignment_type">;

export interface ClientProjectSummary {
  id: string; // normalized project key
  name: string; // Client / Couple name (e.g. "Ayesha & Ahmed")
  events: Shoot[];
  months: string[]; // List of "YYYY-MM"
  earliestDate: string;
  latestDate: string;
  status: string;
  primaryLocation: string;
}

const DEFAULT_EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Engagement",
  "Pre-wedding",
  "Haldi",
  "Mehendi",
  "Sangeet",
  "Nikah",
  "Ruksati",
  "Walima",
  "Birthday",
  "Baby Shower",
  "Maternity",
  "Anniversary",
  "Housewarming",
  "Corporate",
  "Other",
];

const ALL_STUDIO_ROLES = [
  "All roles",
  "Photographer",
  "Videographer",
  "Cinematographer / Creative Director",
  "Drone Operator",
  "Assistant Photographer",
  "Assistant Videographer",
  "Lighting Assistant",
  "Data Manager / Footage Backup Assistant",
  "Photo Editor",
  "Video Editor",
  "Album Designer",
];

function getCustomEventTypes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ta_custom_event_types");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveCustomEventType(type: string): void {
  if (typeof window === "undefined" || !type) return;
  const cleaned = type.trim();
  if (!cleaned || DEFAULT_EVENT_TYPES.includes(cleaned)) return;
  try {
    const existing = getCustomEventTypes();
    if (!existing.includes(cleaned)) {
      localStorage.setItem("ta_custom_event_types", JSON.stringify([...existing, cleaned]));
    }
  } catch {
    // Ignore storage errors
  }
}

export function ShootsManagementView({
  shoots,
  assignments,
  loading,
  externalQuery = "",
  editable,
  onSaveShoot,
  onDeleteShoot,
  team,
  allShoots,
  availabilityRequests = [],
  onSaveAssignments,
  onRenameProject,
}: {
  shoots: Shoot[];
  assignments: Assignment[];
  loading: boolean;
  externalQuery?: string;
  editable: boolean;
  onSaveShoot: (
    values: ShootInput,
    crewAssignments?: AssignmentInput[],
    shootId?: string,
  ) => Promise<void>;
  onDeleteShoot: (shootId: string) => Promise<void>;
  team: TeamMember[];
  allShoots: Shoot[];
  availabilityRequests?: AvailabilityRequest[];
  onSaveAssignments: (shootId: string, values: AssignmentInput[]) => Promise<void>;
  onRenameProject?: (oldName: string, newName: string) => Promise<void>;
}) {
  const [query, setQuery] = useState(externalQuery);
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);

  const [editingShoot, setEditingShoot] = useState<Shoot | null | undefined>(undefined);
  const [defaultProjectNameForNewEvent, setDefaultProjectNameForNewEvent] = useState<
    string | undefined
  >(undefined);
  const [assigningShoot, setAssigningShoot] = useState<Shoot | null>(null);
  const [renamingProject, setRenamingProject] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => setQuery(externalQuery), [externalQuery]);

  // Group shoots into client projects (Parent entity)
  const clientProjects = useMemo(() => {
    const projectMap = new Map<string, Shoot[]>();
    for (const shoot of shoots) {
      const name = (shoot.couple_name || (shoot as any)["shoot name"] || "Untitled Shoot").trim();
      const key = name.toLowerCase();
      if (!projectMap.has(key)) {
        projectMap.set(key, []);
      }
      projectMap.get(key)!.push(shoot);
    }

    const list: ClientProjectSummary[] = [];
    projectMap.forEach((events) => {
      const sortedEvents = [...events].sort((a, b) => {
        const dateCompare = (a.event_date || "").localeCompare(b.event_date || "");
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });

      const firstEvent = sortedEvents[0];
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      const originalName =
        firstEvent.couple_name || (firstEvent as any)["shoot name"] || "Untitled Shoot";
      const monthsSet = new Set(
        sortedEvents.map((e) => (e.event_date ? e.event_date.slice(0, 7) : "")).filter(Boolean),
      );

      let overallStatus = "Upcoming";
      if (sortedEvents.some((e) => e.status === "In Progress")) {
        overallStatus = "In Progress";
      } else if (sortedEvents.every((e) => e.status === "Completed")) {
        overallStatus = "Completed";
      } else if (sortedEvents.every((e) => e.status === "Cancelled")) {
        overallStatus = "Cancelled";
      }

      list.push({
        id: originalName.toLowerCase(),
        name: originalName,
        events: sortedEvents,
        months: Array.from(monthsSet),
        earliestDate: firstEvent.event_date || "",
        latestDate: lastEvent.event_date || "",
        status: overallStatus,
        primaryLocation: firstEvent.venue || firstEvent.location || "Location TBA",
      });
    });

    return list.sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));
  }, [shoots]);

  // Months list derived dynamically from shoots + current month
  const monthsList = useMemo(() => {
    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        label: string;
        shortLabel: string;
        year: string;
        projectCount: number;
        eventCount: number;
      }
    >();

    const now = new Date();
    const currentMonthKey = format(now, "yyyy-MM");

    for (const shoot of shoots) {
      if (!shoot.event_date) continue;
      const mKey = shoot.event_date.slice(0, 7);
      if (!monthsMap.has(mKey)) {
        try {
          const d = parseISO(`${mKey}-01`);
          monthsMap.set(mKey, {
            monthKey: mKey,
            label: format(d, "MMMM yyyy"),
            shortLabel: format(d, "MMM"),
            year: format(d, "yyyy"),
            projectCount: 0,
            eventCount: 0,
          });
        } catch {
          // ignore parsing error
        }
      }
    }

    if (!monthsMap.has(currentMonthKey)) {
      monthsMap.set(currentMonthKey, {
        monthKey: currentMonthKey,
        label: format(now, "MMMM yyyy"),
        shortLabel: format(now, "MMM"),
        year: format(now, "yyyy"),
        projectCount: 0,
        eventCount: 0,
      });
    }

    monthsMap.forEach((val, mKey) => {
      const projectsInMonth = clientProjects.filter((p) => p.months.includes(mKey));
      val.projectCount = projectsInMonth.length;
      val.eventCount = shoots.filter((s) => s.event_date?.startsWith(mKey)).length;
    });

    return Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [shoots, clientProjects]);

  // If a project name is selected, find the active project
  const activeProject = useMemo(() => {
    if (!selectedProjectName) return null;
    return (
      clientProjects.find(
        (p) => p.name.trim().toLowerCase() === selectedProjectName.trim().toLowerCase(),
      ) ?? null
    );
  }, [clientProjects, selectedProjectName]);

  const activeProjectEventIds = useMemo(
    () => new Set(activeProject?.events.map((e) => e.id) ?? []),
    [activeProject?.events],
  );
  const activeProjectTeamCount = useMemo(() => {
    const matching = assignments.filter((a) => activeProjectEventIds.has(a.shoot_id));
    return new Set(matching.map((a) => a.team_member_id)).size;
  }, [activeProjectEventIds, assignments]);
  const activeProjectHasMissingVenue = useMemo(
    () => activeProject?.events.some((e) => !e.venue || !e.venue.trim()) ?? false,
    [activeProject?.events],
  );

  // Filter projects inside selected month (or all projects if query is typed)
  const displayedProjects = useMemo(() => {
    const normQ = query.trim().toLowerCase();
    let base = clientProjects;

    if (selectedMonth) {
      base = base.filter((p) => p.months.includes(selectedMonth));
    }

    if (statusFilter !== "All statuses") {
      base = base.filter((p) => p.status === statusFilter);
    }

    if (normQ) {
      base = base.filter((p) => {
        const matchesName = p.name.toLowerCase().includes(normQ);
        const matchesLoc = p.primaryLocation.toLowerCase().includes(normQ);
        const matchesEvents = p.events.some(
          (e) =>
            e.event_type.toLowerCase().includes(normQ) ||
            (e.venue || "").toLowerCase().includes(normQ) ||
            (e.location || "").toLowerCase().includes(normQ),
        );
        return matchesName || matchesLoc || matchesEvents;
      });
    }

    return base;
  }, [clientProjects, selectedMonth, statusFilter, query]);

  async function confirmDeleteEvent(shoot: Shoot) {
    if (
      !window.confirm(
        `Delete the event "${shoot.event_type}" for ${shoot.couple_name}? This action cannot be undone.`,
      )
    )
      return;
    setActionError("");
    try {
      await onDeleteShoot(shoot.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete this event.");
    }
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renamingProject || !onRenameProject) return;
    const newName = renamingProject.newName.trim();
    if (!newName || newName === renamingProject.oldName) {
      setRenamingProject(null);
      return;
    }
    setActionError("");
    try {
      await onRenameProject(renamingProject.oldName, newName);
      if (selectedProjectName === renamingProject.oldName) {
        setSelectedProjectName(newName);
      }
      setRenamingProject(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to rename client project.");
    }
  }

  const selectedMonthObj = monthsList.find((m) => m.monthKey === selectedMonth);

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317] shadow-xl">
        {/* TOP HEADER & BREADCRUMBS */}
        <div className="border-b border-[#30282e] bg-[#100d10] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-xs text-[#b8adb2]" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectName(null);
                  setSelectedMonth(null);
                }}
                className={`transition-colors hover:text-[#e7a0ad] ${
                  !selectedMonth && !selectedProjectName
                    ? "font-semibold text-[#e7a0ad]"
                    : "text-[#b8adb2]"
                }`}
              >
                All Shoots
              </button>

              {selectedMonth && (
                <>
                  <span className="text-[#82767d]">/</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProjectName(null);
                      setSelectedEventId(null);
                    }}
                    className={`transition-colors hover:text-[#e7a0ad] ${
                      !selectedProjectName ? "font-semibold text-[#e7a0ad]" : "text-[#b8adb2]"
                    }`}
                  >
                    {selectedMonthObj?.label || selectedMonth}
                  </button>
                </>
              )}

              {selectedProjectName && (
                <>
                  <span className="text-[#82767d]">/</span>
                  <span className="font-semibold text-[#e7a0ad]">{selectedProjectName}</span>
                </>
              )}
            </nav>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              {editable && (
                <Button
                  className="studio-glow-button h-9 gap-1.5 rounded-lg bg-[#762d40] text-xs font-medium text-white hover:bg-[#c56c7d] border border-[#c56c7d]/40 shadow-[0_0_12px_rgba(197,108,125,0.25)]"
                  onClick={() => {
                    setDefaultProjectNameForNewEvent(
                      selectedProjectName || (activeProject ? activeProject.name : undefined),
                    );
                    setEditingShoot(null);
                  }}
                >
                  <Plus className="size-3.5" />
                  {selectedProjectName ? "Add Event to Project" : "New Client Project"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30282e] bg-[#151317] px-5 py-3.5 sm:px-6">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative block min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#82767d]"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  selectedProjectName
                    ? "Search events inside this project…"
                    : selectedMonth
                      ? "Search client projects in this month…"
                      : "Search client projects, events, venues…"
                }
                aria-label="Search shoots"
                className="h-9 border-[#30282e] bg-[#1b181d] text-[#f7f0ee] placeholder:text-[#82767d] pl-9 text-xs focus:border-[#c56c7d]"
              />
            </label>

            <select
              className="h-9 rounded-md border border-[#30282e] bg-[#1b181d] px-3 text-xs text-[#f7f0ee] focus:border-[#c56c7d]"
              aria-label="Filter by shoot status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option>All statuses</option>
              <option>Upcoming</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </div>

          <div className="text-xs text-[#b8adb2]">
            {selectedProjectName ? (
              <span>
                Viewing events for <strong className="text-[#f7f0ee]">{selectedProjectName}</strong>
              </span>
            ) : selectedMonth ? (
              <span>
                <strong className="text-[#f7f0ee]">{displayedProjects.length}</strong> client
                projects in <span className="text-[#e7a0ad]">{selectedMonthObj?.label}</span>
              </span>
            ) : (
              <span>
                <strong className="text-[#f7f0ee]">{clientProjects.length}</strong> client projects
                across <strong className="text-[#f7f0ee]">{monthsList.length}</strong> months
              </span>
            )}
          </div>
        </div>

        {actionError && (
          <div className="border-b border-red-200 bg-red-50/70 px-5 py-3 text-xs text-red-700">
            {actionError}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW LEVEL 3: CLIENT PROJECT DETAILS (All Events inside this project)   */}
        {/* ========================================================================= */}
        {selectedProjectName && activeProject ? (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Back Button & Project Header Banner */}
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#30282e] bg-[#1b181d] p-4 sm:p-5 shadow-sm">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedProjectName(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e7a0ad] hover:text-white mb-2 transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to {selectedMonthObj ? selectedMonthObj.label : "Projects"}
                </button>
                <div className="flex items-center gap-3">
                  <h1 className="font-serif text-2xl font-normal text-[#f7f0ee]">
                    {activeProject.name}
                  </h1>
                  {editable && onRenameProject && (
                    <button
                      type="button"
                      onClick={() =>
                        setRenamingProject({
                          oldName: activeProject.name,
                          newName: activeProject.name,
                        })
                      }
                      title="Rename client project"
                      className="text-[#82767d] hover:text-[#e7a0ad] transition-colors"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
                      activeProject.status === "Completed"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : activeProject.status === "In Progress"
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                          : activeProject.status === "Cancelled"
                            ? "border-gray-500/30 bg-gray-500/10 text-gray-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {activeProject.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#b8adb2]">
                  <span>
                    Wedding celebration project · {activeProject.events.length}{" "}
                    {activeProject.events.length === 1 ? "event" : "events"} linked
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-[#f7f0ee]">
                    <Users className="size-3 text-[#e7a0ad]" />
                    {activeProjectTeamCount}{" "}
                    {activeProjectTeamCount === 1 ? "team member" : "team members"} assigned
                  </span>
                  {activeProjectHasMissingVenue && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      <MapPin className="size-3 text-amber-400" />
                      Venue Not Added
                    </span>
                  )}
                  {activeProject.earliestDate && (
                    <>
                      <span>·</span>
                      <span>
                        Dates:{" "}
                        <strong className="text-[#f7f0ee]">
                          {formatScheduleDate(activeProject.earliestDate)}
                          {activeProject.latestDate &&
                            activeProject.latestDate !== activeProject.earliestDate &&
                            ` – ${formatScheduleDate(activeProject.latestDate)}`}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editable && (
                  <Button
                    className="studio-glow-button h-8 gap-1 rounded-lg bg-[#762d40] text-xs text-white hover:bg-[#c56c7d] border border-[#c56c7d]/40 shadow-[0_0_10px_rgba(197,108,125,0.25)]"
                    onClick={() => {
                      setDefaultProjectNameForNewEvent(activeProject.name);
                      setEditingShoot(null);
                    }}
                  >
                    <Plus className="size-3.5" /> Add Event to Project
                  </Button>
                )}
              </div>
            </div>

            {/* Events List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg text-[#f7f0ee]">
                  Associated Events ({activeProject.events.length})
                </h3>
                <span className="text-xs text-[#b8adb2]">
                  Each event independently maintains its own schedule, crew, and shoot status.
                </span>
              </div>

              {activeProject.events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#30282e] bg-[#151317] p-8 text-center text-xs text-[#82767d]">
                  No events added to this project yet. Click "Add Event to Project" above.
                </div>
              ) : (
                <div className="divide-y divide-[#30282e] rounded-xl border border-[#30282e] bg-[#151317]">
                  {activeProject.events.map((eventItem) => {
                    const eventAssignments = assignments.filter((a) => a.shoot_id === eventItem.id);
                    const assignedMembers = eventAssignments.map((a) => {
                      const member = team.find((t) => t.id === a.team_member_id);
                      return {
                        id: a.team_member_id,
                        name: member?.full_name ?? "Unknown Worker",
                        role: member?.role ?? "Crew",
                        type: a.assignment_type,
                      };
                    });
                    const staffingMetrics = calculateStaffingMetrics(
                      eventItem.planned_team_size,
                      eventAssignments,
                    );

                    return (
                      <article
                        key={eventItem.id}
                        onClick={() =>
                          setSelectedEventId(selectedEventId === eventItem.id ? null : eventItem.id)
                        }
                        className={`studio-glow-card cursor-pointer flex flex-wrap items-center gap-4 px-5 py-4 transition-all duration-200 rounded-xl border ${selectedEventId === eventItem.id ? "studio-active-card border-[#c56c7d] bg-[#1f161c] shadow-[0_0_28px_rgba(197,108,125,0.45),0_0_10px_rgba(217,185,140,0.4)]" : "border-[#30282e]/80 bg-[#151317] hover:border-[#c56c7d]/60 hover:bg-[#1b181d]"}`}
                      >
                        {/* Event Date Block */}
                        <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#30282e] bg-[#1b181d] text-center text-[#e7a0ad]">
                          <span className="text-[9px] font-semibold uppercase leading-none">
                            {eventItem.event_date
                              ? format(parseISO(eventItem.event_date), "MMM")
                              : "—"}
                          </span>
                          <span className="font-serif text-lg leading-none font-medium text-[#f7f0ee]">
                            {eventItem.event_date
                              ? format(parseISO(eventItem.event_date), "d")
                              : "—"}
                          </span>
                        </div>

                        {/* Event Name & Timing */}
                        <div className="min-w-[160px] flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-[#f7f0ee]">
                              {eventItem.event_type}
                            </h4>
                            <span className="text-xs text-[#82767d]">·</span>
                            <span className="text-xs text-[#b8adb2]">
                              {eventItem.event_date
                                ? format(parseISO(eventItem.event_date), "EEEE, MMMM d, yyyy")
                                : "Date TBA"}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#b8adb2]">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="size-3 text-[#82767d]" />
                              {formatTimingInterval(eventItem.start_time, eventItem.end_time)}
                            </span>
                            <span>·</span>
                            <span className="font-medium text-[#f7f0ee]">
                              {staffingMetrics.assignedCrew}/{eventItem.planned_team_size} crew
                            </span>
                            {staffingMetrics.additionalCrewRequired > 0 && (
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                Needs {staffingMetrics.additionalCrewRequired} more
                              </span>
                            )}
                            {staffingMetrics.staffingStatus === "Fully Staffed" && (
                              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                Fully staffed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Location / Venue Reminder */}
                        {!eventItem.venue || !eventItem.venue.trim() ? (
                          <div className="flex min-w-[140px] items-center">
                            <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              <MapPin className="size-3 text-amber-400" />
                              Venue Not Added
                            </span>
                          </div>
                        ) : (
                          <div className="hidden min-w-[140px] items-center gap-1.5 text-xs text-[#b8adb2] md:flex">
                            <MapPin className="size-3.5 shrink-0 text-[#e7a0ad]" />
                            <span className="truncate max-w-[180px] text-[#f7f0ee]">
                              {eventItem.venue}
                            </span>
                          </div>
                        )}

                        {/* Status Badge */}
                        <div className="shrink-0">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                              eventItem.status === "Completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : eventItem.status === "In Progress"
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                  : eventItem.status === "Cancelled"
                                    ? "border-gray-500/30 bg-gray-500/10 text-gray-300"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {eventItem.status}
                          </span>
                        </div>

                        {/* Action buttons */}
                        {editable && (
                          <div className="flex items-center gap-1 sm:ml-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 border-[#30282e] bg-[#1b181d] text-xs text-[#b8adb2] hover:bg-[#242026] hover:text-[#f7f0ee] hover:border-[#c56c7d]/40 transition-colors"
                              onClick={() => setAssigningShoot(eventItem)}
                            >
                              <Users className="size-3.5" /> Assign Crew
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs border-[#30282e] bg-[#1b181d] text-[#b8adb2] hover:bg-[#242026] hover:text-[#f7f0ee] hover:border-[#c56c7d]/40 transition-colors"
                              onClick={() => {
                                setDefaultProjectNameForNewEvent(activeProject.name);
                                setEditingShoot(eventItem);
                              }}
                              aria-label={`Edit ${eventItem.event_type}`}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs border-[#30282e] bg-[#1b181d] text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors"
                              onClick={() => void confirmDeleteEvent(eventItem)}
                              aria-label={`Delete ${eventItem.event_type}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        )}

                        {/* Assigned Crew Members preview */}
                        {assignedMembers.length > 0 && (
                          <div className="mt-1 flex w-full flex-wrap items-center gap-1.5 border-t border-[#30282e] pt-2 text-xs">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#82767d]">
                              Crew ({assignedMembers.length}):
                            </span>
                            {assignedMembers.map((m) => (
                              <span
                                key={m.id + m.type}
                                className="inline-flex items-center gap-1 rounded-md border border-[#30282e] bg-[#1b181d] px-2 py-0.5 text-[11px] text-[#f7f0ee]"
                              >
                                <span className="font-medium">{m.name}</span>
                                <span className="text-[#82767d]">({m.role})</span>
                                {m.type === "post_production" && (
                                  <span className="rounded bg-[#762d40]/40 px-1 text-[9px] text-[#e7a0ad]">
                                    Post
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : selectedMonth ? (
          /* ========================================================================= */
          /* VIEW LEVEL 2: MONTH VIEW (Client Projects associated with that month)    */
          /* ========================================================================= */
          <div className="p-5 sm:p-6 space-y-5">
            {/* Back button and Month Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30282e] pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMonth(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e7a0ad] hover:text-white transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  All Months
                </button>
                <span className="text-[#82767d]">|</span>
                <h2 className="font-serif text-xl font-normal text-[#f7f0ee]">
                  {selectedMonthObj?.label || selectedMonth}
                </h2>
                <span className="rounded-full border border-[#30282e] bg-[#1b181d] px-2.5 py-0.5 text-xs text-[#b8adb2]">
                  {displayedProjects.length}{" "}
                  {displayedProjects.length === 1 ? "Client Project" : "Client Projects"}
                </span>
              </div>

              {/* Month pills selector */}
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {monthsList.map((m) => (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => setSelectedMonth(m.monthKey)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      m.monthKey === selectedMonth
                        ? "bg-[#762d40] text-white border border-[#c56c7d]/40 shadow-[0_0_10px_rgba(197,108,125,0.25)]"
                        : "border border-[#30282e] bg-[#1b181d] text-[#b8adb2] hover:bg-[#242026] hover:text-[#f7f0ee]"
                    }`}
                  >
                    {m.shortLabel} '{m.year.slice(2)}
                  </button>
                ))}
              </div>
            </div>

            {/* Client Projects Listing */}
            {displayedProjects.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#82767d]">
                No client projects found in {selectedMonthObj?.label || selectedMonth}.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayedProjects.map((project) => {
                  const eventsInThisMonth = project.events.filter((e) =>
                    e.event_date?.startsWith(selectedMonth),
                  );
                  const projectEventIds = new Set(project.events.map((e) => e.id));
                  const projectAssignments = assignments.filter((a) =>
                    projectEventIds.has(a.shoot_id),
                  );
                  const uniqueTeamMemberIds = new Set(
                    projectAssignments.map((a) => a.team_member_id),
                  );
                  const projectTeamCount = uniqueTeamMemberIds.size;
                  const isVenueMissing = project.events.some((e) => !e.venue || !e.venue.trim());

                  return (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProjectName(project.name)}
                      className="studio-glow-card group cursor-pointer rounded-xl border border-[#30282e] bg-[#1b181d] p-4 transition-all duration-200 hover:border-[#c56c7d]/50 hover:bg-[#242026] hover:shadow-[0_0_20px_rgba(197,108,125,0.15)] flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-lg font-medium text-[#f7f0ee] group-hover:text-[#e7a0ad] transition-colors">
                            {project.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 ${
                              project.status === "Completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : project.status === "In Progress"
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {project.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-[#b8adb2]">
                          <MapPin className="size-3 text-[#e7a0ad] shrink-0" />
                          <span className="truncate">{project.primaryLocation}</span>
                          {isVenueMissing && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
                              Venue Not Added
                            </span>
                          )}
                        </div>

                        <div className="rounded-lg border border-[#30282e] bg-[#151317] p-2.5 text-xs text-[#b8adb2] space-y-1.5">
                          <div className="flex justify-between font-medium">
                            <span>Events:</span>
                            <span className="text-[#f7f0ee]">
                              {project.events.length}{" "}
                              {project.events.length === 1 ? "event" : "events"}
                              {project.months.length > 1 && (
                                <span className="font-normal text-[#82767d] ml-1">
                                  ({eventsInThisMonth.length} in this month)
                                </span>
                              )}
                            </span>
                          </div>
                          {/* Project-wise team member count across all events */}
                          <div className="flex justify-between font-medium">
                            <span>Project Team:</span>
                            <span className="text-[#e7a0ad] font-semibold flex items-center gap-1">
                              <Users className="size-3 text-[#e7a0ad]" />
                              {projectTeamCount} {projectTeamCount === 1 ? "member" : "members"}
                            </span>
                          </div>
                          {project.earliestDate && (
                            <div className="flex justify-between text-[11px] text-[#82767d]">
                              <span>Dates:</span>
                              <span className="text-[#b8adb2]">
                                {format(parseISO(project.earliestDate), "MMM d")}
                                {project.latestDate &&
                                  project.latestDate !== project.earliestDate &&
                                  ` – ${format(parseISO(project.latestDate), "MMM d, yyyy")}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#30282e] pt-3 text-xs">
                        <span className="font-medium text-[#e7a0ad] group-hover:underline">
                          View Events ({project.events.length}) →
                        </span>
                        {editable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultProjectNameForNewEvent(project.name);
                              setEditingShoot(null);
                            }}
                            className="rounded border border-[#30282e] bg-[#151317] px-2 py-0.5 text-[11px] text-[#b8adb2] hover:bg-[#242026] hover:text-[#f7f0ee] transition-colors"
                          >
                            + Add Event
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW LEVEL 1: ALL SHOOTS (Months-based Organization)                     */
          /* ========================================================================= */
          <div className="p-5 sm:p-6 space-y-6">
            <div>
              <h2 className="font-serif text-xl text-[#f7f0ee]">Celebrations by Month</h2>
              <p className="mt-1 text-xs text-[#b8adb2]">
                Select a month to view its scheduled client wedding projects.
              </p>
            </div>

            {/* MONTH CARDS GRID */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {monthsList.map((m) => {
                const now = new Date();
                const isCurrent = m.monthKey === format(now, "yyyy-MM");

                return (
                  <div
                    key={m.monthKey}
                    onClick={() => setSelectedMonth(m.monthKey)}
                    className={`studio-glow-card group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:border-[#c56c7d]/50 hover:bg-[#242026] hover:shadow-[0_0_20px_rgba(197,108,125,0.15)] ${
                      isCurrent
                        ? "border-[#c56c7d]/60 bg-[#24171e] shadow-[0_0_15px_rgba(197,108,125,0.2)]"
                        : "border-[#30282e] bg-[#1b181d]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="grid size-10 place-items-center rounded-lg border border-[#30282e] bg-[#151317] text-[#e7a0ad] font-serif font-medium">
                        {m.shortLabel}
                      </div>
                      {isCurrent && (
                        <span className="rounded-full bg-[#762d40] border border-[#c56c7d]/40 px-2 py-0.5 text-[10px] font-medium text-white shadow-[0_0_10px_rgba(197,108,125,0.3)]">
                          Current Month
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-serif text-base font-medium text-[#f7f0ee] group-hover:text-[#e7a0ad] transition-colors">
                      {m.label}
                    </h3>

                    <div className="mt-2 flex items-center justify-between text-xs text-[#b8adb2]">
                      <span>
                        <strong className="text-[#e7a0ad] font-semibold">{m.projectCount}</strong>{" "}
                        projects
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-[#e7a0ad] font-semibold">{m.eventCount}</strong>{" "}
                        events
                      </span>
                    </div>

                    <div className="mt-3 border-t border-[#30282e] pt-2.5 text-[11px] font-medium text-[#e7a0ad] group-hover:underline">
                      Explore month →
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ALL CLIENT PROJECTS LISTING BELOW */}
            <div className="pt-4 border-t border-[#30282e] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg text-[#f7f0ee]">All Client Projects</h3>
                  <p className="text-xs text-[#b8adb2]">
                    Every wedding project registered in TA Bridals. Click any project to manage its
                    events.
                  </p>
                </div>
                {editable && (
                  <Button
                    size="sm"
                    className="studio-glow-button h-8 gap-1.5 rounded-lg bg-[#762d40] text-xs text-white hover:bg-[#c56c7d] border border-[#c56c7d]/40 shadow-[0_0_10px_rgba(197,108,125,0.25)]"
                    onClick={() => {
                      setDefaultProjectNameForNewEvent(undefined);
                      setEditingShoot(null);
                    }}
                  >
                    <Plus className="size-3.5" /> New Client Project
                  </Button>
                )}
              </div>

              {clientProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#30282e] bg-[#151317] p-8 text-center text-xs text-[#82767d]">
                  No client projects found. Click "New Client Project" to add your first.
                </div>
              ) : (
                <div className="divide-y divide-[#30282e] rounded-xl border border-[#30282e] bg-[#151317]">
                  {clientProjects.map((project) => {
                    const projectEventIds = new Set(project.events.map((e) => e.id));
                    const projectAssignments = assignments.filter((a) =>
                      projectEventIds.has(a.shoot_id),
                    );
                    const uniqueTeamMemberIds = new Set(
                      projectAssignments.map((a) => a.team_member_id),
                    );
                    const projectTeamCount = uniqueTeamMemberIds.size;
                    const isVenueMissing = project.events.some((e) => !e.venue || !e.venue.trim());

                    return (
                      <article
                        key={project.id}
                        onClick={() => setSelectedProjectName(project.name)}
                        className="studio-glow-card group cursor-pointer flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-xl border border-[#30282e]/80 bg-[#151317] transition-all duration-200 hover:border-[#c56c7d]/60 hover:bg-[#1b181d]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#30282e] bg-[#1b181d] text-[#e7a0ad]">
                            <Camera className="size-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-[#f7f0ee] group-hover:text-[#e7a0ad] transition-colors">
                              {project.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#b8adb2]">
                              <span>
                                {project.events.length}{" "}
                                {project.events.length === 1 ? "event" : "events"}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 font-medium text-[#f7f0ee]">
                                <Users className="size-3 text-[#e7a0ad]" />
                                {projectTeamCount}{" "}
                                {projectTeamCount === 1 ? "team member" : "team members"}
                              </span>
                              {project.earliestDate && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {formatScheduleDate(project.earliestDate)}
                                    {project.latestDate &&
                                      project.latestDate !== project.earliestDate &&
                                      ` – ${formatScheduleDate(project.latestDate)}`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isVenueMissing && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              <MapPin className="size-3 text-amber-400" />
                              Venue Not Added
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
                              project.status === "Completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : project.status === "In Progress"
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {project.status}
                          </span>
                          <span className="text-xs font-medium text-[#e7a0ad] group-hover:underline">
                            View Events →
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* RENAME PROJECT MODAL */}
      {renamingProject && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRenamingProject(null);
          }}
        >
          <div className="studio-modal max-w-md">
            <h3 className="font-serif text-xl text-[#f7f0ee]">Rename Client Project</h3>
            <p className="mt-1 text-xs text-[#82767d]">
              This updates all associated events linked to this client project.
            </p>
            <form onSubmit={handleRenameSubmit} className="mt-4 space-y-4">
              <label className="studio-field">
                Project Name
                <Input
                  value={renamingProject.newName}
                  onChange={(e) =>
                    setRenamingProject((prev) =>
                      prev ? { ...prev, newName: e.target.value } : null,
                    )
                  }
                  required
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRenamingProject(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Name</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHOOT / EVENT EDITOR MODAL WITH GLOBAL AVAILABILITY & CONFLICT PREVENTION */}
      {editingShoot !== undefined && (
        <ShootEditor
          key={editingShoot?.id ?? "new-shoot"}
          shoot={editingShoot}
          defaultCoupleName={defaultProjectNameForNewEvent}
          team={team}
          shoots={allShoots}
          assignments={assignments}
          availabilityRequests={availabilityRequests}
          onClose={() => {
            setEditingShoot(undefined);
            setDefaultProjectNameForNewEvent(undefined);
          }}
          onSave={onSaveShoot}
        />
      )}

      {/* CREW ASSIGNMENT MODAL WITH GLOBAL AVAILABILITY & CONFLICT PREVENTION */}
      {assigningShoot && (
        <AssignmentEditor
          shoot={assigningShoot}
          team={team}
          shoots={allShoots}
          assignments={assignments}
          availabilityRequests={availabilityRequests}
          onClose={() => setAssigningShoot(null)}
          onSave={onSaveAssignments}
        />
      )}
    </>
  );
}

/**
 * Shoot / Event Editor with Global Crew Availability & Conflict Prevention
 */
function ShootEditor({
  shoot,
  defaultCoupleName,
  team,
  shoots,
  assignments,
  availabilityRequests = [],
  onClose,
  onSave,
}: {
  shoot: Shoot | null;
  defaultCoupleName?: string | undefined;
  team: TeamMember[];
  shoots: Shoot[];
  assignments: Assignment[];
  availabilityRequests?: AvailabilityRequest[];
  onClose: () => void;
  onSave: (
    values: ShootInput,
    crewAssignments: AssignmentInput[],
    shootId?: string,
  ) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [plannedTeamSize, setPlannedTeamSize] = useState<number>(shoot?.planned_team_size ?? 2);
  const [eventDate, setEventDate] = useState<string>(
    shoot?.event_date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = useState<string>(shoot?.start_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState<string>(shoot?.end_time?.slice(0, 5) ?? "13:00");

  const [customTypes] = useState<string[]>(() => getCustomEventTypes());
  const [selectedEventType, setSelectedEventType] = useState<string>(
    shoot?.event_type ?? "Wedding",
  );
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customEventTypeName, setCustomEventTypeName] = useState("");

  const availableEventTypes = useMemo(() => {
    const fromShoots = shoots.map((s) => s.event_type).filter(Boolean);
    return Array.from(
      new Set([
        ...DEFAULT_EVENT_TYPES,
        ...fromShoots,
        ...customTypes,
        ...(shoot?.event_type ? [shoot.event_type] : []),
      ]),
    );
  }, [shoots, customTypes, shoot?.event_type]);

  const [workerSearch, setWorkerSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const availableStudioRoles = useMemo(
    () => ["All roles", ...getAllRoles(team.map((m) => m.role))],
    [team],
  );

  const [selectedCrew, setSelectedCrew] = useState<AssignmentInput[]>(() => {
    if (!shoot) return [];
    return assignments
      .filter((a) => a.shoot_id === shoot.id)
      .map(({ team_member_id, assignment_type }) => ({ team_member_id, assignment_type }));
  });

  const activeWorkers = useMemo(() => {
    return team.filter((member) => member.status !== "inactive");
  }, [team]);

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return activeWorkers.filter((member) => {
      const matchesQuery =
        !q || member.full_name.toLowerCase().includes(q) || member.role.toLowerCase().includes(q);
      const matchesRole = roleFilter === "All roles" || member.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [activeWorkers, workerSearch, roleFilter]);

  const staffingMetrics = useMemo(() => {
    return calculateStaffingMetrics(plannedTeamSize, selectedCrew);
  }, [plannedTeamSize, selectedCrew]);

  // Compute real-time schedule status for all active workers
  const workerScheduleStatuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getWorkerScheduleStatus>>();
    for (const worker of activeWorkers) {
      const status = getWorkerScheduleStatus({
        shoot: {
          id: shoot?.id,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime || null,
        },
        workerId: worker.id,
        team,
        shoots,
        assignments,
        availabilityRequests,
      });
      map.set(worker.id, status);
    }
    return map;
  }, [
    activeWorkers,
    shoot?.id,
    eventDate,
    startTime,
    endTime,
    team,
    shoots,
    assignments,
    availabilityRequests,
  ]);

  // Selected crew conflicts
  const selectedConflicts = useMemo(() => {
    const onSiteIds = selectedCrew
      .filter((c) => c.assignment_type === "on_site")
      .map((c) => c.team_member_id);

    return findAllShootConflicts({
      shoot: {
        id: shoot?.id,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
      },
      selectedWorkerIds: onSiteIds,
      team,
      shoots,
      assignments,
      availabilityRequests,
    });
  }, [
    selectedCrew,
    shoot?.id,
    eventDate,
    startTime,
    endTime,
    team,
    shoots,
    assignments,
    availabilityRequests,
  ]);

  const hasOverlapConflict = selectedConflicts.some((c) => c.type === "shoot_overlap");

  function toggleWorker(workerId: string) {
    const workerStatus = workerScheduleStatuses.get(workerId);
    if (workerStatus?.hasOverlapConflict) {
      setError(
        `Cannot assign ${workerStatus.workerName}: Overlapping assignment on another shoot.`,
      );
      return;
    }

    setSelectedCrew((prev) => {
      const exists = prev.some((item) => item.team_member_id === workerId);
      if (exists) {
        return prev.filter((item) => item.team_member_id !== workerId);
      }
      const onSiteCount = prev.filter((item) => item.assignment_type === "on_site").length;
      if (onSiteCount >= 20) {
        setError(
          "Maximum capacity reached: A shoot cannot have more than 20 on-site crew members.",
        );
        return prev;
      }
      return [...prev, { team_member_id: workerId, assignment_type: "on_site" }];
    });
  }

  function removeWorker(workerId: string) {
    setSelectedCrew((prev) => prev.filter((item) => item.team_member_id !== workerId));
  }

  function updateAssignmentType(workerId: string, type: "on_site" | "post_production") {
    setSelectedCrew((prev) => {
      if (type === "on_site") {
        const onSiteCount = prev.filter((item) => item.assignment_type === "on_site").length;
        if (onSiteCount >= 20) {
          setError(
            "Maximum capacity reached: A shoot cannot have more than 20 on-site crew members.",
          );
          return prev;
        }
      }
      return prev.map((item) =>
        item.team_member_id === workerId ? { ...item, assignment_type: type } : item,
      );
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!eventDate || !startTime) {
      setError("Event date and start time are required.");
      setSaving(false);
      return;
    }

    if (endTime && startTime && endTime.slice(0, 5) === startTime.slice(0, 5)) {
      setError("Start time and end time cannot be identical.");
      setSaving(false);
      return;
    }

    if (hasOverlapConflict) {
      setError(
        "Cannot save shoot: One or more assigned crew members have overlapping assignments. Please resolve the schedule conflict first.",
      );
      setSaving(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const venue = String(form.get("venue") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const shootTitle = String(
      form.get("couple_name") ?? defaultCoupleName ?? shoot?.couple_name ?? "",
    ).trim();

    if (!shootTitle) {
      setError("Client Project / Couple Name is required.");
      setSaving(false);
      return;
    }

    if (isAddingCustom && !customEventTypeName.trim()) {
      setError("Please enter the name of the new event type.");
      setSaving(false);
      return;
    }

    const resolvedType = isAddingCustom
      ? customEventTypeName.trim()
      : (selectedEventType || String(form.get("event_type") ?? "Wedding")).trim();

    if (resolvedType && resolvedType !== "__custom__") {
      saveCustomEventType(resolvedType);
    }

    const values: ShootInput = {
      couple_name: shootTitle,
      "shoot name": shootTitle,
      event_type: resolvedType || "Wedding",
      event_date: eventDate,
      location: String(form.get("location") ?? "").trim(),
      venue: venue || null,
      start_time: startTime,
      end_time: endTime || null,
      planned_team_size: plannedTeamSize,
      status: String(form.get("status") ?? "Upcoming"),
      notes: notes || null,
    };

    try {
      await onSave(values, selectedCrew, shoot?.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save this shoot and crew assignments.",
      );
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
        className="studio-modal max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shoot-editor-title"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
              {defaultCoupleName ? `CLIENT PROJECT · ${defaultCoupleName}` : "STUDIO SCHEDULE"}
            </p>
            <h2 id="shoot-editor-title" className="mt-1 font-serif text-2xl text-[#f7f0ee]">
              {shoot
                ? `Edit ${shoot.event_type} (${shoot.couple_name})`
                : defaultCoupleName
                  ? `Add Event to ${defaultCoupleName}`
                  : "New Client Project & Event"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#82767d] hover:text-white"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="studio-field sm:col-span-2">
              Client Project / Couple Name
              <Input
                name="couple_name"
                defaultValue={
                  defaultCoupleName || shoot?.couple_name || (shoot as any)?.["shoot name"] || ""
                }
                maxLength={120}
                required
                autoFocus={!defaultCoupleName}
              />
            </label>

            <div className="studio-field">
              <div className="flex items-center justify-between">
                <span>Event name / Type</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCustom((prev) => !prev);
                    if (!isAddingCustom) {
                      setCustomEventTypeName("");
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#d9b98c] hover:underline"
                >
                  {isAddingCustom ? (
                    "← Choose from list"
                  ) : (
                    <>
                      <Plus className="size-3" /> Add new type
                    </>
                  )}
                </button>
              </div>

              {isAddingCustom ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      name="custom_event_type"
                      value={customEventTypeName}
                      onChange={(e) => setCustomEventTypeName(e.target.value)}
                      placeholder="e.g. Haldi, Nikah, Ruksati, Reception"
                      maxLength={60}
                      autoFocus
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => setIsAddingCustom(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <select
                  name="event_type"
                  value={selectedEventType}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsAddingCustom(true);
                      setCustomEventTypeName("");
                    } else {
                      setSelectedEventType(e.target.value);
                    }
                  }}
                  required
                >
                  {availableEventTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                  <option value="__custom__">+ Add new event type…</option>
                </select>
              )}
            </div>

            <label className="studio-field">
              Event Date
              <Input
                name="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </label>

            <label className="studio-field">
              Start time
              <Input
                name="start_time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>

            <label className="studio-field">
              End time{" "}
              <span className="font-normal text-[#82767d]">
                {endTime && startTime && endTime < startTime ? (
                  <span className="text-amber-300 font-medium">· crosses midnight (overnight)</span>
                ) : (
                  "· required for overlap check"
                )}
              </span>
              <Input
                name="end_time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>

            <label className="studio-field">
              Location / City
              <Input
                name="location"
                defaultValue={shoot?.location ?? "Hyderabad"}
                maxLength={160}
                required
              />
            </label>

            <label className="studio-field">
              <div className="flex items-center justify-between">
                <span>Venue</span>
                <span className="font-normal text-[#82767d]">optional</span>
              </div>
              <Input
                name="venue"
                defaultValue={shoot?.venue ?? ""}
                placeholder="e.g. Taj Falaknuma Palace (optional - can add later)"
                maxLength={160}
              />
            </label>

            <label className="studio-field">
              Required crew count
              <Input
                name="planned_team_size"
                type="number"
                min={1}
                max={20}
                value={plannedTeamSize}
                onChange={(e) =>
                  setPlannedTeamSize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
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
              <textarea
                name="notes"
                maxLength={2000}
                defaultValue={(shoot?.notes ?? "")
                  .replace(/\s*\[Event Type:\s*[^\]]+\]/g, "")
                  .replace(/\s*\[Planned Crew:\s*[^\]]+\]/g, "")
                  .replace(/\s*\[End Time:\s*[^\]]+\]/g, "")
                  .trim()}
                rows={2}
              />
            </label>
          </div>

          {/* CREW ASSIGNMENTS & GLOBAL CONFLICT DETECTION SECTION */}
          <div className="mt-6 border-t border-[#30282e] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg text-[#f7f0ee]">Assigned Crew Members</h3>
                <p className="text-xs text-[#82767d]">
                  Availability checked across all client projects and events. Overlaps are blocked.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg border border-[#30282e] bg-[#120f12] px-2.5 py-1 text-[#f7f0ee]">
                  Selected:{" "}
                  <strong className="font-semibold text-[#d9b98c]">
                    {staffingMetrics.assignedCrew}
                  </strong>{" "}
                  / {staffingMetrics.plannedTeamSize}
                </span>
                <span
                  className={`rounded-lg border px-2.5 py-1 font-medium ${
                    staffingMetrics.additionalCrewRequired > 0
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {staffingMetrics.additionalCrewRequired > 0
                    ? `Needs ${staffingMetrics.additionalCrewRequired} more`
                    : "Fulfilled"}
                </span>
              </div>
            </div>

            {/* INSTANT CONFLICT WARNINGS (Section 5) */}
            {selectedConflicts.length > 0 && (
              <div
                className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-200 space-y-2"
                role="alert"
              >
                <div className="flex items-center gap-2 font-semibold text-red-300">
                  <AlertTriangle className="size-4 shrink-0 text-red-400" />
                  <span>CREW MEMBER UNAVAILABLE</span>
                </div>
                {selectedConflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-red-500/30 bg-[#160f14] p-2.5 text-[11px] leading-relaxed"
                  >
                    <p className="font-medium text-red-200">
                      <strong>{c.workerName}</strong> is already assigned to:
                    </p>
                    {c.conflictingShoot && (
                      <div className="mt-1 pl-2 text-white/90 space-y-0.5 border-l-2 border-red-500/50">
                        <p>
                          <span className="text-[#9a8c77]">Project:</span>{" "}
                          {c.conflictingShoot.coupleName}
                        </p>
                        <p>
                          <span className="text-[#9a8c77]">Event:</span>{" "}
                          {c.conflictingShoot.eventType}
                        </p>
                        <p>
                          <span className="text-[#9a8c77]">Date:</span>{" "}
                          {c.conflictingShoot.formattedDate || c.conflictingShoot.date}
                        </p>
                        <p>
                          <span className="text-[#9a8c77]">Timing:</span>{" "}
                          {c.conflictingShoot.formattedTiming ||
                            `${c.conflictingShoot.startTime} - ${c.conflictingShoot.endTime || "end"}`}
                        </p>
                      </div>
                    )}
                    <p className="mt-1.5 font-medium text-red-400">
                      The selected shoot overlaps with this assignment. You cannot save while
                      conflicting members are selected.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Workers Chips Preview */}
            {selectedCrew.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 p-2 rounded-xl border border-[#30282e]/80 bg-[#161217]">
                {selectedCrew.map((assignment) => {
                  const worker = team.find((m) => m.id === assignment.team_member_id);
                  if (!worker) return null;
                  const hasConflict = selectedConflicts.some(
                    (c) => c.workerId === worker.id && c.type === "shoot_overlap",
                  );

                  return (
                    <span
                      key={assignment.team_member_id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                        hasConflict
                          ? "border-red-500/50 bg-red-500/20 text-red-200"
                          : "border-[#40343e] bg-[#221c25] text-[#f7f0ee]"
                      }`}
                    >
                      <span className="font-medium">{worker.full_name}</span>
                      <span className="text-[10px] text-[#d9b98c]">({worker.role})</span>
                      <span className="text-[9px] uppercase tracking-wider text-[#82767d]">
                        [{assignment.assignment_type === "on_site" ? "On-site" : "Post-prod"}]
                      </span>
                      {hasConflict && <AlertTriangle className="size-3 text-red-400" />}
                      <button
                        type="button"
                        onClick={() => removeWorker(worker.id)}
                        className="ml-1 text-[#82767d] hover:text-red-400"
                        aria-label={`Remove ${worker.full_name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search and Role Filter Bar */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#82767d]" />
                <Input
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  placeholder="Search crew by name or role…"
                  className="h-9 pl-8 text-xs bg-[#120f12] border-[#30282e] text-[#f7f0ee]"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-md border border-[#30282e] bg-[#120f12] px-3 text-xs text-[#f7f0ee]"
              >
                {availableStudioRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Crew Selection List */}
            <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {filteredWorkers.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#82767d]">
                  No active workers matching "{workerSearch || roleFilter}".
                </p>
              ) : (
                filteredWorkers.map((member) => {
                  const isSelected = selectedCrew.some((i) => i.team_member_id === member.id);
                  const currentAssign = selectedCrew.find((i) => i.team_member_id === member.id);
                  const status = workerScheduleStatuses.get(member.id);
                  const isUnavailable = status?.hasOverlapConflict;

                  return (
                    <div
                      key={member.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-2.5 transition-colors text-xs ${
                        isUnavailable
                          ? "border-red-500/30 bg-red-950/20"
                          : isSelected
                            ? "border-[#762d40] bg-[#221c25]"
                            : "border-[#30282e]/80 bg-[#161217] hover:border-[#40343e]"
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isUnavailable && !isSelected}
                          onChange={() => toggleWorker(member.id)}
                          className="mt-0.5 size-4 rounded border-[#40343e] accent-[#762d40] disabled:opacity-40"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#f7f0ee]">{member.full_name}</span>
                            <span className="text-[11px] text-[#82767d]">({member.role})</span>
                          </div>

                          {/* Availability status line */}
                          {isUnavailable ? (
                            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 mt-1">
                              <p className="font-semibold text-red-300">CREW MEMBER UNAVAILABLE</p>
                              <p className="text-[10px] mt-0.5">
                                Assigned to {status?.overlapConflict?.conflictingShoot?.coupleName}{" "}
                                ({status?.overlapConflict?.conflictingShoot?.eventType}) on{" "}
                                {status?.overlapConflict?.conflictingShoot?.formattedTiming}
                              </p>
                            </div>
                          ) : status?.sameDayAssignments && status.sameDayAssignments.length > 0 ? (
                            <p className="text-[11px] text-emerald-400 font-medium">
                              ✓ {status.statusText}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#71d8aa]">✓ Available</p>
                          )}
                        </div>
                      </label>

                      {isSelected && (
                        <select
                          value={currentAssign?.assignment_type ?? "on_site"}
                          onChange={(e) =>
                            updateAssignmentType(
                              member.id,
                              e.target.value as "on_site" | "post_production",
                            )
                          }
                          className="h-7 rounded border border-[#40343e] bg-[#120f12] px-2 text-[11px] text-[#f7f0ee]"
                        >
                          <option value="on_site">On site</option>
                          <option value="post_production">Post production</option>
                        </select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
            <Button
              type="submit"
              disabled={saving || hasOverlapConflict}
              className="bg-[#762d40] hover:bg-[#5e2333] text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : shoot ? "Save changes" : "Add event"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Crew Assignment Editor with Global Double-Booking Prevention
 */
function AssignmentEditor({
  shoot,
  team,
  shoots,
  assignments,
  availabilityRequests = [],
  onClose,
  onSave,
}: {
  shoot: Shoot;
  team: TeamMember[];
  shoots: Shoot[];
  assignments: Assignment[];
  availabilityRequests?: AvailabilityRequest[];
  onClose: () => void;
  onSave: (shootId: string, values: AssignmentInput[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AssignmentInput[]>(() =>
    assignments
      .filter((assignment) => assignment.shoot_id === shoot.id)
      .map(({ team_member_id, assignment_type }) => ({ team_member_id, assignment_type })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedIds = new Set(selected.map((assignment) => assignment.team_member_id));

  const staffingMetrics = useMemo(
    () => calculateStaffingMetrics(shoot.planned_team_size, selected),
    [shoot.planned_team_size, selected],
  );

  // Compute real-time schedule status for all active workers
  const workerScheduleStatuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getWorkerScheduleStatus>>();
    for (const worker of team) {
      const status = getWorkerScheduleStatus({
        shoot: {
          id: shoot.id,
          event_date: shoot.event_date,
          start_time: shoot.start_time,
          end_time: shoot.end_time,
        },
        workerId: worker.id,
        team,
        shoots,
        assignments,
        availabilityRequests,
      });
      map.set(worker.id, status);
    }
    return map;
  }, [shoot, team, shoots, assignments, availabilityRequests]);

  // Compute overlapping conflicts among selected crew
  const selectedConflicts = useMemo(() => {
    const onSiteIds = selected
      .filter((a) => a.assignment_type === "on_site")
      .map((a) => a.team_member_id);

    return findAllShootConflicts({
      shoot: {
        id: shoot.id,
        event_date: shoot.event_date,
        start_time: shoot.start_time,
        end_time: shoot.end_time,
      },
      selectedWorkerIds: onSiteIds,
      team,
      shoots,
      assignments,
      availabilityRequests,
    });
  }, [selected, shoot, team, shoots, assignments, availabilityRequests]);

  const hasOverlapConflict = selectedConflicts.some((c) => c.type === "shoot_overlap");

  function toggleMember(memberId: string) {
    const workerStatus = workerScheduleStatuses.get(memberId);
    if (workerStatus?.hasOverlapConflict) {
      setError(
        `Cannot assign ${workerStatus.workerName}: Overlapping assignment on another shoot.`,
      );
      return;
    }

    setSelected((current) => {
      const exists = current.some((item) => item.team_member_id === memberId);
      if (exists) {
        return current.filter((item) => item.team_member_id !== memberId);
      }
      const onSiteCount = current.filter((i) => i.assignment_type === "on_site").length;
      if (onSiteCount >= 20) {
        setError(
          "Maximum capacity reached: A shoot cannot have more than 20 on-site crew members.",
        );
        return current;
      }
      return [...current, { team_member_id: memberId, assignment_type: "on_site" }];
    });
  }

  function changeType(memberId: string, assignmentType: Assignment["assignment_type"]) {
    setSelected((current) =>
      current.map((item) =>
        item.team_member_id === memberId ? { ...item, assignment_type: assignmentType } : item,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    if (hasOverlapConflict) {
      setError(
        "Cannot save assignments: One or more crew members have overlapping assignments. Please deselect unavailable crew.",
      );
      setSaving(false);
      return;
    }

    try {
      await onSave(shoot.id, selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save assignments.");
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
        className="studio-modal max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-editor-title"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
              CREW ASSIGNMENT
            </p>
            <h2 id="assignment-editor-title" className="mt-1 font-serif text-2xl text-[#f7f0ee]">
              {shoot.couple_name}
            </h2>
            <p className="mt-1 text-xs text-[#82767d]">
              {shoot.event_type} · {formatScheduleDate(shoot.event_date)} ·{" "}
              {formatTimingInterval(shoot.start_time, shoot.end_time)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                staffingMetrics.staffingStatus === "Fully Staffed"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : staffingMetrics.staffingStatus === "Overstaffed"
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {staffingMetrics.staffingStatus} ({staffingMetrics.uniqueOnSiteWorkers}/
              {staffingMetrics.plannedTeamSize} on-site)
            </span>
          </div>
        </div>

        {/* INSTANT CONFLICT WARNINGS (Section 5) */}
        {selectedConflicts.length > 0 && (
          <div
            className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-200 space-y-2"
            role="alert"
          >
            <div className="flex items-center gap-2 font-semibold text-red-300">
              <AlertTriangle className="size-4 shrink-0 text-red-400" />
              <span>CREW MEMBER UNAVAILABLE</span>
            </div>
            {selectedConflicts.map((c, idx) => (
              <div
                key={idx}
                className="rounded-md border border-red-500/30 bg-[#160f14] p-2.5 text-[11px] leading-relaxed"
              >
                <p className="font-medium text-red-200">
                  <strong>{c.workerName}</strong> is already assigned to:
                </p>
                {c.conflictingShoot && (
                  <div className="mt-1 pl-2 text-white/90 space-y-0.5 border-l-2 border-red-500/50">
                    <p>
                      <span className="text-[#9a8c77]">Project:</span>{" "}
                      {c.conflictingShoot.coupleName}
                    </p>
                    <p>
                      <span className="text-[#9a8c77]">Event:</span> {c.conflictingShoot.eventType}
                    </p>
                    <p>
                      <span className="text-[#9a8c77]">Date:</span>{" "}
                      {c.conflictingShoot.formattedDate || c.conflictingShoot.date}
                    </p>
                    <p>
                      <span className="text-[#9a8c77]">Timing:</span>{" "}
                      {c.conflictingShoot.formattedTiming ||
                        `${c.conflictingShoot.startTime} - ${c.conflictingShoot.endTime || "end"}`}
                    </p>
                  </div>
                )}
                <p className="mt-1.5 font-medium text-red-400">
                  The selected shoot overlaps with this assignment. You cannot save while
                  conflicting members are selected.
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {team.map((member) => {
            const isAssigned = selectedIds.has(member.id);
            const current = selected.find((item) => item.team_member_id === member.id);
            const status = workerScheduleStatuses.get(member.id);
            const isUnavailable = status?.hasOverlapConflict;

            return (
              <div
                key={member.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs transition-colors ${
                  isUnavailable
                    ? "border-red-500/30 bg-red-950/20"
                    : isAssigned
                      ? "border-[#762d40] bg-[#221c25]"
                      : "border-[#30282e] bg-[#1d171d]"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-[220px]">
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={isUnavailable && !isAssigned}
                    onChange={() => toggleMember(member.id)}
                    className="mt-0.5 size-4 rounded border-[#40343e] accent-[#762d40] disabled:opacity-40"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#f7f0ee]">{member.full_name}</span>
                      <span className="text-[11px] text-[#82767d]">({member.role})</span>
                    </div>

                    {isUnavailable ? (
                      <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200 mt-1">
                        <span className="font-semibold text-red-300">Unavailable:</span> Overlaps
                        with {status?.overlapConflict?.conflictingShoot?.coupleName} (
                        {status?.overlapConflict?.conflictingShoot?.eventType}) on{" "}
                        {status?.overlapConflict?.conflictingShoot?.formattedTiming}
                      </div>
                    ) : status?.sameDayAssignments && status.sameDayAssignments.length > 0 ? (
                      <p className="text-[11px] text-emerald-400 font-medium">
                        ✓ {status.statusText}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#71d8aa]">✓ Available</p>
                    )}
                  </div>
                </label>

                {isAssigned && (
                  <select
                    className="rounded-md border border-[#30282e] bg-[#120f12] px-2 py-1 text-xs text-[#f7f0ee]"
                    value={current?.assignment_type ?? "on_site"}
                    onChange={(event) =>
                      changeType(member.id, event.target.value as Assignment["assignment_type"])
                    }
                  >
                    <option value="on_site">On site</option>
                    <option value="post_production">Post production</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p
            className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-[#30282e] pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || hasOverlapConflict}
            className="bg-[#762d40] hover:bg-[#5e2333] text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save assignments"}
          </Button>
        </div>
      </section>
    </div>
  );
}
