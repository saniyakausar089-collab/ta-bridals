import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Search,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Smartphone,
  PhoneOff,
  SkipForward,
  RotateCcw,
  Check,
  CalendarClock,
  Camera,
  Filter,
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  deriveMessagingProjects,
  generatePersonalizedMessage,
  buildWhatsAppClickToChatUrl,
  openWhatsAppChat,
  formatShootDate,
  formatShootTime,
  type Shoot,
  type TeamMember,
  type Assignment,
  type MessagingProject,
  type ProjectCrewAssignment,
  type MessageDeliveryStatus,
} from "@/lib/messagingUtils";

interface MessagingViewProps {
  shoots: Shoot[];
  allShoots?: Shoot[];
  team: TeamMember[];
  assignments: Assignment[];
  loading?: boolean;
}

export function MessagingView({
  shoots,
  allShoots,
  team,
  assignments,
  loading = false,
}: MessagingViewProps) {
  // Use shoots (or allShoots if provided) as the single source of truth
  const activeShoots = allShoots && allShoots.length > 0 ? allShoots : shoots;

  // Selected project drill-down state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Session activity tracking: Map of `${projectId}_${memberId}` -> { status, timestamp }
  const [sessionActivity, setSessionActivity] = useState<
    Record<string, { status: MessageDeliveryStatus; updatedAt: string }>
  >({});

  // Individual Message Modal state
  const [individualModal, setIndividualModal] = useState<{
    project: MessagingProject;
    crewItem: ProjectCrewAssignment;
    messageText: string;
  } | null>(null);

  // Message All Stepper Modal state
  const [stepperState, setStepperState] = useState<{
    project: MessagingProject;
    step: "confirm" | "step" | "complete";
    currentIndex: number;
    eligibleCrew: ProjectCrewAssignment[];
    currentMessageText: string;
  } | null>(null);

  // Derive all projects from the shared shoots, assignments, and team state
  const projects = useMemo(() => {
    return deriveMessagingProjects(activeShoots, assignments, team);
  }, [activeShoots, assignments, team]);

  // Derived studio statistics
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    let upcomingShootsCount = 0;

    for (const s of activeShoots) {
      if (s.status === "Cancelled") continue;
      if (s.event_date) {
        try {
          const shootDate = parseISO(s.event_date);
          if (isAfter(shootDate, today) || s.event_date === format(today, "yyyy-MM-dd")) {
            upcomingShootsCount++;
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    // Unique assigned crew across all projects
    const uniqueAssignedMemberIds = new Set<string>();
    for (const p of projects) {
      for (const c of p.assignedCrew) {
        uniqueAssignedMemberIds.add(c.member.id);
      }
    }

    // Total eligible recipients (with valid phone numbers)
    let totalEligibleRecipients = 0;
    for (const p of projects) {
      totalEligibleRecipients += p.eligibleRecipientCount;
    }

    return {
      totalProjects: projects.length,
      upcomingShoots: upcomingShootsCount,
      uniqueAssignedCrew: uniqueAssignedMemberIds.size,
      totalEligibleRecipients,
    };
  }, [activeShoots, projects]);

  // Filter projects by search query and status filter
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      // Status filter
      if (statusFilter !== "all" && p.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (!q) return true;

      // Match project name
      if (p.name.toLowerCase().includes(q)) return true;

      // Match event types
      if (p.events.some((e) => (e.event_type || "").toLowerCase().includes(q))) return true;

      // Match primary location or venue
      if (p.primaryLocation.toLowerCase().includes(q)) return true;

      // Match assigned crew members' names or roles
      if (
        p.assignedCrew.some(
          (c) =>
            c.member.full_name.toLowerCase().includes(q) ||
            c.roles.some((r) => r.toLowerCase().includes(q))
        )
      ) {
        return true;
      }

      return false;
    });
  }, [projects, searchQuery, statusFilter]);

  // Currently open project details
  const activeProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Helpers for session activity status
  const getMemberStatus = (projectId: string, memberId: string): MessageDeliveryStatus => {
    const key = `${projectId}_${memberId}`;
    return sessionActivity[key]?.status || "not_started";
  };

  const setMemberStatus = (
    projectId: string,
    memberId: string,
    status: MessageDeliveryStatus
  ) => {
    const key = `${projectId}_${memberId}`;
    setSessionActivity((prev) => ({
      ...prev,
      [key]: {
        status,
        updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    }));
  };

  // Open individual message modal
  const handleOpenIndividualModal = (
    project: MessagingProject,
    crewItem: ProjectCrewAssignment
  ) => {
    const generated = generatePersonalizedMessage({
      crewName: crewItem.member.full_name,
      projectName: project.name,
      roles: crewItem.roles,
      assignedEvents: crewItem.assignedEvents,
    });

    setIndividualModal({
      project,
      crewItem,
      messageText: generated,
    });
  };

  // Launch WhatsApp Click to Chat URL
  const handleLaunchWhatsApp = (
    waDigits: string,
    messageText: string,
    projectId: string,
    memberId: string
  ) => {
    openWhatsAppChat(waDigits, messageText);
    setMemberStatus(projectId, memberId, "whatsapp_opened");
  };

  // Start "Message All Crew" stepper
  const handleStartMessageAll = (project: MessagingProject) => {
    const eligible = project.assignedCrew.filter((c) => c.phoneInfo.isValid);
    if (eligible.length === 0) return;

    const firstCrew = eligible[0];
    const firstMsg = generatePersonalizedMessage({
      crewName: firstCrew.member.full_name,
      projectName: project.name,
      roles: firstCrew.roles,
      assignedEvents: firstCrew.assignedEvents,
    });

    setStepperState({
      project,
      step: "confirm",
      currentIndex: 0,
      eligibleCrew: eligible,
      currentMessageText: firstMsg,
    });
  };

  // Stepper: Proceed to next member
  const handleStepperAdvance = (nextIdx: number) => {
    if (!stepperState) return;
    if (nextIdx >= stepperState.eligibleCrew.length) {
      setStepperState({
        ...stepperState,
        step: "complete",
      });
      return;
    }

    const nextCrew = stepperState.eligibleCrew[nextIdx];
    const nextMsg = generatePersonalizedMessage({
      crewName: nextCrew.member.full_name,
      projectName: stepperState.project.name,
      roles: nextCrew.roles,
      assignedEvents: nextCrew.assignedEvents,
    });

    setStepperState({
      ...stepperState,
      currentIndex: nextIdx,
      currentMessageText: nextMsg,
    });
  };

  // Format status badge
  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "in progress") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
          In Progress
        </span>
      );
    }
    if (s === "completed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
          Completed
        </span>
      );
    }
    if (s === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#d9b98c]/30 bg-[#d9b98c]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#d9b98c]">
        Upcoming
      </span>
    );
  };

  // Format session status badge
  const renderSessionStatusBadge = (status: MessageDeliveryStatus) => {
    switch (status) {
      case "whatsapp_opened":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-[#25D366]/40 bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-medium text-[#25D366]">
            <Check className="size-3" /> WhatsApp opened
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            <SkipForward className="size-3" /> Skipped
          </span>
        );
      case "invalid_phone":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            <PhoneOff className="size-3" /> Invalid phone
          </span>
        );
      case "not_started":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#8c828a]">
            Not started
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      {activeProject ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30282e] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center gap-1.5 rounded-lg border border-[#30282e] bg-[#151317] px-3 py-1.5 text-xs font-medium text-[#d9b98c] transition-colors hover:border-[#d9b98c]/50 hover:bg-[#1a171c]"
            >
              <ChevronLeft className="size-4" />
              Back to Projects
            </button>
            <span className="text-xs text-[#8c828a]">/</span>
            <span className="font-serif text-lg font-medium text-[#f7f0ee]">
              {activeProject.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {renderStatusBadge(activeProject.status)}
            <Button
              onClick={() => handleStartMessageAll(activeProject)}
              disabled={activeProject.eligibleRecipientCount === 0}
              className="flex items-center gap-2 bg-[#25D366] text-xs font-semibold text-black transition-transform hover:bg-[#20ba59] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageSquare className="size-4" />
              Message All Crew ({activeProject.eligibleRecipientCount})
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Dashboard Header & Metric Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-4 transition-all hover:border-[#d9b98c]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8c828a]">Total Projects</span>
                <Camera className="size-4 text-[#d9b98c]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#f7f0ee]">{stats.totalProjects}</p>
              <p className="mt-1 text-[11px] text-[#8c828a]">Across All Shoots</p>
            </div>

            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-4 transition-all hover:border-[#d9b98c]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8c828a]">Assigned Crew</span>
                <Users className="size-4 text-[#d9b98c]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#f7f0ee]">{stats.uniqueAssignedCrew}</p>
              <p className="mt-1 text-[11px] text-[#8c828a]">Active on projects</p>
            </div>

            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-4 transition-all hover:border-[#d9b98c]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8c828a]">Upcoming Shoots</span>
                <CalendarClock className="size-4 text-[#d9b98c]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#f7f0ee]">{stats.upcomingShoots}</p>
              <p className="mt-1 text-[11px] text-[#8c828a]">Scheduled celebrations</p>
            </div>

            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-4 transition-all hover:border-[#25D366]/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8c828a]">WhatsApp Ready</span>
                <Smartphone className="size-4 text-[#25D366]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#25D366]">{stats.totalEligibleRecipients}</p>
              <p className="mt-1 text-[11px] text-[#8c828a]">Verified phone numbers</p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8c828a]" />
              <Input
                type="text"
                placeholder="Search projects by client name, event, location or crew..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 border-[#30282e] bg-[#151317] pl-10 text-sm text-[#f7f0ee] placeholder:text-[#8c828a] focus:border-[#d9b98c]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8c828a] hover:text-[#f7f0ee]"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-[#8c828a]" />
              <select
                aria-label="Filter by project status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-[#30282e] bg-[#151317] px-3 text-xs text-[#f7f0ee] focus:border-[#d9b98c] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      {activeProject ? (
        /* PROJECT DETAIL VIEW */
        <div className="space-y-6">
          {/* Project Summary Header Card */}
          <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#d9b98c]">
                  Client Project
                </p>
                <h2 className="mt-1 font-serif text-2xl text-[#f7f0ee]">{activeProject.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#8c828a]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-[#d9b98c]" />
                    {formatShootDate(activeProject.earliestDate)}
                    {activeProject.earliestDate !== activeProject.latestDate &&
                      ` – ${formatShootDate(activeProject.latestDate)}`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-[#d9b98c]" />
                    {activeProject.primaryLocation}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Camera className="size-3.5 text-[#d9b98c]" />
                    {activeProject.events.length} {activeProject.events.length === 1 ? "Event" : "Events"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => handleStartMessageAll(activeProject)}
                  disabled={activeProject.eligibleRecipientCount === 0}
                  className="flex items-center gap-2 bg-[#25D366] text-xs font-semibold text-black transition-transform hover:bg-[#20ba59] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MessageSquare className="size-4" />
                  Message All Crew ({activeProject.eligibleRecipientCount})
                </Button>
              </div>
            </div>

            {/* Events Timeline in Project */}
            <div className="mt-5 border-t border-[#30282e] pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8c828a]">
                Project Events ({activeProject.events.length})
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activeProject.events.map((ev) => {
                  const evAssignments = assignments.filter((a) => a.shoot_id === ev.id);
                  return (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-[#30282e]/80 bg-[#100d10] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#f7f0ee]">
                          {ev.event_type || "Wedding Shoot"}
                        </span>
                        <span className="text-[10px] text-[#8c828a]">{ev.status || "Upcoming"}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-[#8c828a]">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-[#d9b98c]" />
                          {formatShootDate(ev.event_date)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock className="size-3 text-[#d9b98c]" />
                          {formatShootTime(ev.start_time)}
                          {ev.end_time ? ` - ${formatShootTime(ev.end_time)}` : ""}
                        </p>
                        {ev.venue && (
                          <p className="flex items-center gap-1.5 truncate">
                            <MapPin className="size-3 text-[#d9b98c]" />
                            {ev.venue}
                          </p>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-[#30282e]/60 pt-2 text-[11px]">
                        <span className="text-[#8c828a]">Assigned crew:</span>
                        <span className="font-semibold text-[#d9b98c]">{evAssignments.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Assigned Crew Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-[#f7f0ee]">
                  Assigned Crew ({activeProject.assignedCrew.length})
                </h3>
                <p className="text-xs text-[#8c828a]">
                  Crew members assigned to any event in this project. Deduplicated for messaging.
                </p>
              </div>

              {activeProject.assignedCrew.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#25D366]">
                    ● {activeProject.eligibleRecipientCount} eligible
                  </span>
                  {activeProject.assignedCrew.length - activeProject.eligibleRecipientCount > 0 && (
                    <span className="text-rose-400">
                      ● {activeProject.assignedCrew.length - activeProject.eligibleRecipientCount} missing phone
                    </span>
                  )}
                </div>
              )}
            </div>

            {activeProject.assignedCrew.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#30282e] bg-[#151317] p-8 text-center">
                <Users className="mx-auto size-8 text-[#8c828a]" />
                <p className="mt-2 text-sm font-medium text-[#f7f0ee]">No crew members assigned yet</p>
                <p className="mt-1 text-xs text-[#8c828a]">
                  Assign crew members in the All Shoots module, and they will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#30282e] rounded-xl border border-[#30282e] bg-[#151317]">
                {activeProject.assignedCrew.map((crewItem) => {
                  const status = getMemberStatus(activeProject.id, crewItem.member.id);
                  const isEligible = crewItem.phoneInfo.isValid;

                  return (
                    <div
                      key={crewItem.member.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-white/[0.02]"
                    >
                      {/* Member Info */}
                      <div className="flex items-start gap-3.5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#30282e] bg-[#100d10] font-serif text-sm font-semibold text-[#d9b98c]">
                          {crewItem.member.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-medium text-[#f7f0ee]">
                              {crewItem.member.full_name}
                            </h4>
                            {renderSessionStatusBadge(
                              !isEligible ? "invalid_phone" : status
                            )}
                          </div>

                          <p className="text-xs text-[#d9b98c]">
                            {crewItem.roles.join(", ") || crewItem.member.role || "Crew Member"}
                          </p>

                          {/* Assigned Events Badges */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-[#8c828a]">Assigned to:</span>
                            {crewItem.assignedEvents.map((ae, idx) => (
                              <Badge
                                key={`${ae.event.id}-${idx}`}
                                variant="outline"
                                className="border-[#30282e] bg-[#100d10] px-2 py-0.5 text-[10px] text-[#f7f0ee]"
                              >
                                {ae.event.event_type || "Shoot"} ({formatShootDate(ae.event.event_date)})
                              </Badge>
                            ))}
                          </div>

                          {/* Phone Number Display */}
                          <div className="mt-1.5 flex items-center gap-2 text-xs">
                            {isEligible ? (
                              <span className="flex items-center gap-1 text-[#25D366]">
                                <Smartphone className="size-3" />
                                {crewItem.phoneInfo.displayFormatted}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-rose-400">
                                <PhoneOff className="size-3" />
                                {crewItem.phoneInfo.error || "Phone missing"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          onClick={() => handleOpenIndividualModal(activeProject, crewItem)}
                          disabled={!isEligible}
                          className="h-8 gap-1.5 border border-[#25D366]/40 bg-[#25D366]/10 text-xs font-medium text-[#25D366] transition-all hover:bg-[#25D366] hover:text-black disabled:cursor-not-allowed disabled:border-[#30282e] disabled:bg-transparent disabled:text-[#8c828a]"
                        >
                          <MessageSquare className="size-3.5" />
                          Message WhatsApp
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Session Activity Table */}
          <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
            <div className="flex items-center justify-between border-b border-[#30282e] pb-3">
              <div>
                <h4 className="font-serif text-sm font-semibold text-[#f7f0ee]">
                  Session Dispatch Activity
                </h4>
                <p className="text-[11px] text-[#8c828a]">
                  Activity tracked in current session. WhatsApp opens require manual confirmation in WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSessionActivity({})}
                className="flex items-center gap-1 text-xs text-[#8c828a] hover:text-[#d9b98c]"
              >
                <RotateCcw className="size-3" />
                Reset session log
              </button>
            </div>

            <div className="mt-3 divide-y divide-[#30282e]/60 text-xs">
              {activeProject.assignedCrew.map((c) => {
                const actKey = `${activeProject.id}_${c.member.id}`;
                const act = sessionActivity[actKey];
                const status = !c.phoneInfo.isValid ? "invalid_phone" : act?.status || "not_started";

                return (
                  <div
                    key={c.member.id}
                    className="flex items-center justify-between py-2.5 text-[#8c828a]"
                  >
                    <span className="font-medium text-[#f7f0ee]">{c.member.full_name}</span>
                    <div className="flex items-center gap-3">
                      {act?.updatedAt && (
                        <span className="text-[10px] text-[#8c828a]">{act.updatedAt}</span>
                      )}
                      {renderSessionStatusBadge(status)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* PROJECTS GRID / LIST VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-[#f7f0ee]">
              Shoots & Client Projects ({filteredProjects.length})
            </h3>
            <span className="text-xs text-[#8c828a]">
              Synced in real time with All Shoots
            </span>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#30282e] bg-[#151317] p-12 text-center">
              <Camera className="mx-auto size-10 text-[#8c828a]" />
              <p className="mt-3 text-base font-medium text-[#f7f0ee]">
                {searchQuery ? "No matching projects found" : "No projects in All Shoots"}
              </p>
              <p className="mt-1 text-xs text-[#8c828a]">
                {searchQuery
                  ? `No shoots or crew members match "${searchQuery}". Try clearing the search.`
                  : "Create shoots and assign crew in the All Shoots tab to coordinate messaging."}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 border-[#30282e] text-xs"
                >
                  Clear search query
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const nextEvent = project.events[0];
                return (
                  <div
                    key={project.id}
                    className="group flex flex-col justify-between rounded-xl border border-[#30282e] bg-[#151317] p-5 transition-all hover:border-[#d9b98c]/50 hover:shadow-lg"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-serif text-lg font-medium text-[#f7f0ee] transition-colors group-hover:text-[#d9b98c]">
                            {project.name}
                          </h4>
                          <p className="mt-0.5 text-xs text-[#8c828a]">
                            {project.events.length} {project.events.length === 1 ? "Event" : "Events"}
                          </p>
                        </div>
                        {renderStatusBadge(project.status)}
                      </div>

                      {/* Next Event Info */}
                      {nextEvent && (
                        <div className="mt-4 rounded-lg border border-[#30282e]/60 bg-[#100d10] p-3 text-xs">
                          <p className="text-[10px] uppercase tracking-wider text-[#d9b98c]">
                            Upcoming Event
                          </p>
                          <p className="mt-1 font-medium text-[#f7f0ee]">
                            {nextEvent.event_type || "Wedding Shoot"}
                          </p>
                          <div className="mt-2 space-y-1 text-[#8c828a]">
                            <p className="flex items-center gap-1.5">
                              <Calendar className="size-3 text-[#d9b98c]" />
                              {formatShootDate(nextEvent.event_date)}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock className="size-3 text-[#d9b98c]" />
                              {formatShootTime(nextEvent.start_time)}
                            </p>
                            {nextEvent.venue && (
                              <p className="flex items-center gap-1.5 truncate">
                                <MapPin className="size-3 text-[#d9b98c]" />
                                {nextEvent.venue}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Assigned Crew Avatars & Counter */}
                      <div className="mt-4 flex items-center justify-between text-xs text-[#8c828a]">
                        <div className="flex items-center gap-1.5">
                          <Users className="size-3.5 text-[#d9b98c]" />
                          <span>{project.assignedCrew.length} crew assigned</span>
                        </div>
                        <span className="text-[#25D366] font-medium text-[11px]">
                          {project.eligibleRecipientCount} WhatsApp ready
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-5 border-t border-[#30282e] pt-4">
                      <Button
                        onClick={() => setSelectedProjectId(project.id)}
                        className="w-full justify-between bg-[#1f1b22] text-xs font-medium text-[#f7f0ee] transition-colors hover:bg-[#762d40] hover:text-white"
                      >
                        <span>View Crew & Message</span>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* INDIVIDUAL WHATSAPP MODAL */}
      {individualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#30282e] bg-[#151317] p-6 text-[#f7f0ee] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#30282e] pb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#d9b98c]">
                  WhatsApp Dispatch Preview
                </p>
                <h3 className="mt-1 font-serif text-xl font-medium">
                  Message {individualModal.crewItem.member.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIndividualModal(null)}
                className="rounded-lg p-1 text-[#8c828a] hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Recipient Details */}
            <div className="mt-4 rounded-lg border border-[#30282e] bg-[#100d10] p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[#8c828a]">
                <div>
                  <span className="block text-[10px] uppercase text-[#8c828a]">Recipient</span>
                  <span className="font-medium text-[#f7f0ee]">
                    {individualModal.crewItem.member.full_name}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8c828a]">WhatsApp Number</span>
                  <span className="font-medium text-[#25D366]">
                    {individualModal.crewItem.phoneInfo.displayFormatted}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8c828a]">Project</span>
                  <span className="font-medium text-[#f7f0ee]">
                    {individualModal.project.name}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8c828a]">Assigned Role</span>
                  <span className="font-medium text-[#d9b98c]">
                    {individualModal.crewItem.roles.join(", ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Message Editor */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-[#f7f0ee]">Personalized Message (Editable)</label>
                <button
                  type="button"
                  onClick={() => {
                    const fresh = generatePersonalizedMessage({
                      crewName: individualModal.crewItem.member.full_name,
                      projectName: individualModal.project.name,
                      roles: individualModal.crewItem.roles,
                      assignedEvents: individualModal.crewItem.assignedEvents,
                    });
                    setIndividualModal({
                      ...individualModal,
                      messageText: fresh,
                    });
                  }}
                  className="text-[11px] text-[#d9b98c] hover:underline"
                >
                  Reset to Template
                </button>
              </div>
              <textarea
                rows={9}
                value={individualModal.messageText}
                onChange={(e) =>
                  setIndividualModal({
                    ...individualModal,
                    messageText: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-[#30282e] bg-[#100d10] p-3 font-mono text-xs text-[#f7f0ee] focus:border-[#d9b98c] focus:outline-none"
              />
            </div>

            {/* Delivery Note */}
            <div className="mt-3 rounded-lg border border-[#30282e] bg-amber-500/10 p-3 text-[11px] text-amber-300">
              <span className="font-semibold">Notice:</span> Clicking &ldquo;Open WhatsApp&rdquo; will open a
              WhatsApp conversation with this message prefilled. You will press Send inside
              WhatsApp to deliver it.
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end gap-3 border-t border-[#30282e] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndividualModal(null)}
                className="border-[#30282e] text-xs text-[#8c828a] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  handleLaunchWhatsApp(
                    individualModal.crewItem.phoneInfo.waDigits,
                    individualModal.messageText,
                    individualModal.project.id,
                    individualModal.crewItem.member.id
                  );
                  setIndividualModal(null);
                }}
                className="flex items-center gap-2 bg-[#25D366] text-xs font-semibold text-black hover:bg-[#20ba59]"
              >
                <ExternalLink className="size-3.5" />
                Open WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE ALL CREW STEPPER WIZARD */}
      {stepperState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#30282e] bg-[#151317] p-6 text-[#f7f0ee] shadow-2xl">
            {stepperState.step === "confirm" ? (
              /* STEP 1: CONFIRMATION */
              <div>
                <div className="border-b border-[#30282e] pb-4">
                  <p className="text-xs uppercase tracking-wider text-[#d9b98c]">
                    Batch Message Sequence
                  </p>
                  <h3 className="mt-1 font-serif text-xl font-medium">
                    Message All Crew ({stepperState.eligibleCrew.length} Eligible)
                  </h3>
                  <p className="mt-1 text-xs text-[#8c828a]">
                    Project: <span className="text-[#f7f0ee]">{stepperState.project.name}</span>
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-xs text-[#8c828a]">
                    This wizard will walk you through each assigned crew member individually so you can
                    inspect, customize, and open WhatsApp with their personalized shoot details.
                  </p>

                  <div className="rounded-lg border border-[#30282e] bg-[#100d10] p-3 text-xs">
                    <p className="mb-2 font-medium text-[#d9b98c]">Recipients to be messaged:</p>
                    <div className="divide-y divide-[#30282e]/60">
                      {stepperState.eligibleCrew.map((c, i) => (
                        <div key={c.member.id} className="flex items-center justify-between py-1.5">
                          <span className="text-[#f7f0ee]">
                            {i + 1}. {c.member.full_name} ({c.roles.join(", ")})
                          </span>
                          <span className="text-[#25D366] font-mono text-[11px]">
                            {c.phoneInfo.displayFormatted}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
                    <p className="font-semibold">Delivery Safeguard:</p>
                    <p className="mt-0.5">
                      In accordance with WhatsApp policies, each message opens one at a time for your manual
                      review. No automated spam or bulk blasting.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#30282e] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStepperState(null)}
                    className="border-[#30282e] text-xs text-[#8c828a] hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStepperState({ ...stepperState, step: "step" })}
                    className="flex items-center gap-2 bg-[#25D366] text-xs font-semibold text-black hover:bg-[#20ba59]"
                  >
                    Start Sequence (1 of {stepperState.eligibleCrew.length})
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : stepperState.step === "step" ? (
              /* STEP 2: SEQUENTIAL STEPPER */
              <div>
                {/* Progress bar */}
                <div className="border-b border-[#30282e] pb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#d9b98c]">
                      Crew Member {stepperState.currentIndex + 1} of{" "}
                      {stepperState.eligibleCrew.length}
                    </span>
                    <span className="text-[#8c828a]">
                      {Math.round(
                        ((stepperState.currentIndex + 1) / stepperState.eligibleCrew.length) * 100
                      )}
                      % completed
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[#25D366] transition-all duration-300"
                      style={{
                        width: `${((stepperState.currentIndex + 1) / stepperState.eligibleCrew.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Current Recipient Card */}
                {(() => {
                  const current = stepperState.eligibleCrew[stepperState.currentIndex];
                  if (!current) return null;
                  const currentStatus = getMemberStatus(stepperState.project.id, current.member.id);

                  return (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg border border-[#30282e] bg-[#100d10] p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <h4 className="font-serif text-base font-semibold text-[#f7f0ee]">
                            {current.member.full_name}
                          </h4>
                          {renderSessionStatusBadge(currentStatus)}
                        </div>
                        <p className="mt-0.5 text-xs text-[#d9b98c]">
                          {current.roles.join(", ") || "Crew Member"}
                        </p>
                        <p className="mt-1 flex items-center gap-1 font-mono text-xs text-[#25D366]">
                          <Smartphone className="size-3" />
                          {current.phoneInfo.displayFormatted}
                        </p>
                      </div>

                      {/* Editable Text Area */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-medium text-[#f7f0ee]">
                            Personalized Message Preview
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const fresh = generatePersonalizedMessage({
                                crewName: current.member.full_name,
                                projectName: stepperState.project.name,
                                roles: current.roles,
                                assignedEvents: current.assignedEvents,
                              });
                              setStepperState({
                                ...stepperState,
                                currentMessageText: fresh,
                              });
                            }}
                            className="text-[11px] text-[#d9b98c] hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                        <textarea
                          rows={8}
                          value={stepperState.currentMessageText}
                          onChange={(e) =>
                            setStepperState({
                              ...stepperState,
                              currentMessageText: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-[#30282e] bg-[#100d10] p-3 font-mono text-xs text-[#f7f0ee] focus:border-[#d9b98c] focus:outline-none"
                        />
                      </div>

                      {/* Stepper Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#30282e] pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMemberStatus(stepperState.project.id, current.member.id, "skipped");
                            handleStepperAdvance(stepperState.currentIndex + 1);
                          }}
                          className="border-[#30282e] text-xs text-[#8c828a] hover:text-white"
                        >
                          <SkipForward className="size-3 mr-1" />
                          Skip
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              handleLaunchWhatsApp(
                                current.phoneInfo.waDigits,
                                stepperState.currentMessageText,
                                stepperState.project.id,
                                current.member.id
                              );
                            }}
                            className="flex items-center gap-2 bg-[#25D366] text-xs font-semibold text-black hover:bg-[#20ba59]"
                          >
                            <ExternalLink className="size-3.5" />
                            Open WhatsApp
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleStepperAdvance(stepperState.currentIndex + 1)}
                            className="bg-[#762d40] text-xs font-medium text-white hover:bg-[#c56c7d]"
                          >
                            {stepperState.currentIndex + 1 === stepperState.eligibleCrew.length
                              ? "Finish"
                              : "Next Member"}
                            <ChevronRight className="size-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* STEP 3: BATCH COMPLETE */
              <div className="text-center py-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#25D366]/20 text-[#25D366]">
                  <CheckCircle2 className="size-6" />
                </div>
                <h3 className="mt-3 font-serif text-xl font-medium text-[#f7f0ee]">
                  Batch Walkthrough Complete
                </h3>
                <p className="mt-1 text-xs text-[#8c828a]">
                  You have reviewed and prepared messages for all eligible crew members in{" "}
                  <span className="text-[#f7f0ee]">{stepperState.project.name}</span>.
                </p>

                <div className="mt-5 rounded-lg border border-[#30282e] bg-[#100d10] p-4 text-left text-xs">
                  <p className="font-semibold text-[#d9b98c] mb-2">Session Summary:</p>
                  <div className="space-y-1.5">
                    {stepperState.eligibleCrew.map((c) => {
                      const st = getMemberStatus(stepperState.project.id, c.member.id);
                      return (
                        <div key={c.member.id} className="flex items-center justify-between">
                          <span className="text-[#f7f0ee]">{c.member.full_name}</span>
                          {renderSessionStatusBadge(st)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <Button
                    size="sm"
                    onClick={() => setStepperState(null)}
                    className="bg-[#762d40] text-xs font-medium text-white hover:bg-[#c56c7d]"
                  >
                    Done & Return to Project
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
