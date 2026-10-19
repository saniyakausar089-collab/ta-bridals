// Scheduling Conflict Detection and Crew Capacity Calculator
// Default Studio Timezone: Asia/Kolkata (IST)

export interface TimeInterval {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm or HH:mm:ss
  endTime?: string | null; // HH:mm or HH:mm:ss (or null)
}

export interface ShootConflictCheck {
  shootId: string;
  coupleName: string;
  eventType: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  status: string;
}

export interface WorkerConflictResult {
  workerId: string;
  workerName: string;
  conflictingShoot: ShootConflictCheck;
  reason: string;
}

export interface WorkerCrewConflict {
  workerId: string;
  workerName: string;
  type: "shoot_overlap" | "approved_leave" | "status_inactive" | "status_on_leave";
  severity: "warning" | "error";
  message: string;
  conflictingShoot?: {
    id: string;
    coupleName: string;
    eventType: string;
    date: string;
    startTime: string;
    endTime?: string | null;
  };
  leaveRequest?: {
    id: string;
    requestType: string;
    startDate: string;
    endDate: string;
    reason?: string | null;
  };
}

/**
 * Converts HH:mm(:ss) time string into total minutes from start of day.
 * Returns -1 if invalid.
 */
export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return -1;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return -1;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

/**
 * Checks if a given time interval crosses midnight.
 * e.g., 22:00 to 02:00.
 */
export function doesCrossMidnight(startTime: string, endTime?: string | null): boolean {
  if (!endTime) return false;
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === -1 || end === -1) return false;
  return end < start;
}

/**
 * Checks if two events on the same or crossing date overlap in time.
 * Handles missing end times (defaults to 3 hours or end of day)
 * and events crossing midnight (where endTime < startTime).
 */
export function doEventsOverlap(eventA: TimeInterval, eventB: TimeInterval): boolean {
  const startA = parseTimeToMinutes(eventA.startTime);
  let endA = parseTimeToMinutes(eventA.endTime);
  if (endA === -1) {
    endA = Math.min(startA + 180, 23 * 60 + 59);
  }

  const startB = parseTimeToMinutes(eventB.startTime);
  let endB = parseTimeToMinutes(eventB.endTime);
  if (endB === -1) {
    endB = Math.min(startB + 180, 23 * 60 + 59);
  }

  const crossesA = endA < startA;
  const crossesB = endB < startB;

  // Case 1: Same date
  if (eventA.date === eventB.date) {
    // If eventA crosses midnight: it runs on this date from startA to 24*60
    const effEndA = crossesA ? 24 * 60 : endA;
    // If eventB crosses midnight: it runs on this date from startB to 24*60
    const effEndB = crossesB ? 24 * 60 : endB;

    return startA < effEndB && startB < effEndA;
  }

  // Case 2: Adjacent dates and one crosses midnight into the next day
  // Check if eventA is on Day 1, crosses midnight, and eventB is on Day 2 (Day 1 + 1 day)
  const dateADate = new Date(`${eventA.date}T00:00:00Z`);
  const dateBDate = new Date(`${eventB.date}T00:00:00Z`);
  const diffDays = Math.round((dateBDate.getTime() - dateADate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1 && crossesA) {
    // Event A spills into Day 2 from 00:00 to endA
    const spillStartA = 0;
    const spillEndA = endA;
    const effEndB = crossesB ? 24 * 60 : endB;
    return spillStartA < effEndB && startB < spillEndA;
  }

  if (diffDays === -1 && crossesB) {
    // Event B spills into Day 1 (Event A's date) from 00:00 to endB
    const spillStartB = 0;
    const spillEndB = endB;
    const effEndA = crossesA ? 24 * 60 : endA;
    return startA < spillEndB && spillStartB < effEndA;
  }

  return false;
}

/**
 * Checks if a worker has any scheduling conflicts for a target shoot.
 * Checks for:
 * 1. Overlapping assignments with other active shoots
 * 2. Approved leave or unavailability requests
 * 3. Worker active / leave status
 */
export function findWorkerConflicts({
  shoot,
  workerId,
  team,
  shoots,
  assignments,
  availabilityRequests = [],
}: {
  shoot: {
    id?: string;
    event_date: string;
    start_time: string;
    end_time?: string | null;
  };
  workerId: string;
  team: {
    id: string;
    full_name: string;
    role: string;
    status?: string;
    available?: boolean;
    user_id?: string | null;
  }[];
  shoots: {
    id: string;
    couple_name: string;
    event_type: string;
    event_date: string;
    start_time: string;
    end_time?: string | null;
    status: string;
  }[];
  assignments: {
    shoot_id: string;
    team_member_id: string;
    assignment_type: string;
  }[];
  availabilityRequests?: {
    id: string;
    worker_id?: string | null;
    user_id?: string | null;
    request_type: string;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
    status: string;
    reason?: string | null;
  }[];
}): WorkerCrewConflict[] {
  const conflicts: WorkerCrewConflict[] = [];
  const member = team.find((m) => m.id === workerId);
  const workerName = member?.full_name || "Crew member";

  if (!member) {
    return conflicts;
  }

  // 1. Worker profile status check
  if (member.status === "inactive") {
    conflicts.push({
      workerId,
      workerName,
      type: "status_inactive",
      severity: "error",
      message: `${workerName} is marked inactive in team records.`,
    });
  } else if (member.status === "on_leave") {
    conflicts.push({
      workerId,
      workerName,
      type: "status_on_leave",
      severity: "warning",
      message: `${workerName} is currently marked on leave in team status.`,
    });
  }

  // 2. Overlapping assignments with other active shoots
  const otherAssignments = assignments.filter(
    (a) => a.team_member_id === workerId && (!shoot?.id || a.shoot_id !== shoot.id)
  );

  for (const assign of otherAssignments) {
    const otherShoot = shoots.find((s) => s.id === assign.shoot_id);
    if (!otherShoot || otherShoot.status === "Cancelled") {
      continue; // Cancelled shoots do NOT block worker availability
    }

    const overlap = doEventsOverlap(
      {
        date: shoot.event_date,
        startTime: shoot.start_time,
        endTime: shoot.end_time,
      },
      {
        date: otherShoot.event_date,
        startTime: otherShoot.start_time,
        endTime: otherShoot.end_time,
      }
    );

    if (overlap) {
      const timeStr = otherShoot.end_time
        ? `${otherShoot.start_time.slice(0, 5)} – ${otherShoot.end_time.slice(0, 5)}`
        : `from ${otherShoot.start_time.slice(0, 5)}`;
      conflicts.push({
        workerId,
        workerName,
        type: "shoot_overlap",
        severity: "warning",
        message: `${workerName} is already assigned to "${otherShoot.couple_name}" (${otherShoot.event_type}) on ${otherShoot.event_date} (${timeStr}).`,
        conflictingShoot: {
          id: otherShoot.id,
          coupleName: otherShoot.couple_name,
          eventType: otherShoot.event_type,
          date: otherShoot.event_date,
          startTime: otherShoot.start_time,
          endTime: otherShoot.end_time,
        },
      });
    }
  }

  // 3. Approved leave or unavailability requests
  const relevantLeaveRequests = availabilityRequests.filter(
    (req) =>
      req.status === "approved" &&
      (req.request_type === "leave" || req.request_type === "unavailable") &&
      (req.worker_id === workerId || (member.user_id && req.user_id === member.user_id))
  );

  for (const req of relevantLeaveRequests) {
    // Check if shoot date falls within leave date range
    if (shoot.event_date >= req.start_date && shoot.event_date <= req.end_date) {
      // If time window is specified on the leave request, verify overlap
      if (req.start_time && req.end_time) {
        const overlap = doEventsOverlap(
          {
            date: shoot.event_date,
            startTime: shoot.start_time,
            endTime: shoot.end_time,
          },
          {
            date: shoot.event_date,
            startTime: req.start_time,
            endTime: req.end_time,
          }
        );
        if (!overlap) continue;
      }

      const reasonPart = req.reason ? ` (${req.reason})` : "";
      conflicts.push({
        workerId,
        workerName,
        type: "approved_leave",
        severity: "warning",
        message: `${workerName} has approved leave from ${req.start_date} to ${req.end_date}${reasonPart}.`,
        leaveRequest: {
          id: req.id,
          requestType: req.request_type,
          startDate: req.start_date,
          endDate: req.end_date,
          reason: req.reason,
        },
      });
    }
  }

  return conflicts;
}

/**
 * Checks all selected workers for conflicts on a shoot.
 */
export function findAllShootConflicts({
  shoot,
  selectedWorkerIds,
  team,
  shoots,
  assignments,
  availabilityRequests = [],
}: {
  shoot: {
    id?: string;
    event_date: string;
    start_time: string;
    end_time?: string | null;
  };
  selectedWorkerIds: string[];
  team: {
    id: string;
    full_name: string;
    role: string;
    status?: string;
    available?: boolean;
    user_id?: string | null;
  }[];
  shoots: {
    id: string;
    couple_name: string;
    event_type: string;
    event_date: string;
    start_time: string;
    end_time?: string | null;
    status: string;
  }[];
  assignments: {
    shoot_id: string;
    team_member_id: string;
    assignment_type: string;
  }[];
  availabilityRequests?: {
    id: string;
    worker_id?: string | null;
    user_id?: string | null;
    request_type: string;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
    status: string;
    reason?: string | null;
  }[];
}): WorkerCrewConflict[] {
  return selectedWorkerIds.flatMap((workerId) =>
    findWorkerConflicts({
      shoot,
      workerId,
      team,
      shoots,
      assignments,
      availabilityRequests,
    })
  );
}

/**
 * Automatically calculates staffing metrics for a shoot.
 * Enforces the maximum 20 on-site crew members.
 * Only on-site assignments count towards the on-site crew capacity.
 */
export function calculateStaffingMetrics(
  plannedTeamSize: number,
  assignments: { team_member_id: string; assignment_type: string }[],
) {
  // Count unique on-site workers and post-production workers
  const onSiteAssignments = assignments.filter((a) => a.assignment_type === "on_site");
  const postProdAssignments = assignments.filter((a) => a.assignment_type === "post_production");
  const uniqueOnSiteWorkers = new Set(onSiteAssignments.map((a) => a.team_member_id)).size;
  const uniquePostProdWorkers = new Set(postProdAssignments.map((a) => a.team_member_id)).size;
  const uniqueTotalWorkers = new Set(assignments.map((a) => a.team_member_id)).size;

  const maxOnSiteLimit = 20;
  // Assigned crew count equals unique on-site crew
  const assignedCrew = uniqueOnSiteWorkers;
  const additionalCrewRequired = Math.max(0, plannedTeamSize - assignedCrew);
  const remainingCapacity = Math.max(0, maxOnSiteLimit - assignedCrew);

  let staffingStatus: "Understaffed" | "Fully Staffed" | "Overstaffed" = "Understaffed";
  if (assignedCrew === plannedTeamSize) {
    staffingStatus = "Fully Staffed";
  } else if (assignedCrew > plannedTeamSize) {
    staffingStatus = "Overstaffed";
  }

  return {
    plannedTeamSize,
    assignedCrew,
    uniqueOnSiteWorkers,
    uniquePostProdWorkers,
    uniqueTotalWorkers,
    additionalCrewRequired,
    remainingRequired: additionalCrewRequired,
    remainingCapacity,
    staffingStatus,
    isOverLimit: assignedCrew > maxOnSiteLimit,
  };
}
