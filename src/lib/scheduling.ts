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
 * Checks if two events on the same or crossing date overlap in time.
 * Handles missing end times (defaults to 3 hours or end of day)
 * and events crossing midnight (where endTime < startTime).
 */
export function doEventsOverlap(
  eventA: TimeInterval,
  eventB: TimeInterval
): boolean {
  if (eventA.date !== eventB.date) {
    // If dates differ, check for crossing midnight if needed
    return false;
  }

  const startA = parseTimeToMinutes(eventA.startTime);
  let endA = parseTimeToMinutes(eventA.endTime);
  if (endA === -1) {
    // Missing end time: assume 3 hours duration, capped at 23:59
    endA = Math.min(startA + 180, 23 * 60 + 59);
  }
  // Crossing midnight: if endA <= startA, spans into next day
  if (endA <= startA) {
    endA = 24 * 60; // up to midnight on current day
  }

  const startB = parseTimeToMinutes(eventB.startTime);
  let endB = parseTimeToMinutes(eventB.endTime);
  if (endB === -1) {
    endB = Math.min(startB + 180, 23 * 60 + 59);
  }
  if (endB <= startB) {
    endB = 24 * 60;
  }

  // Overlap condition: startA < endB && startB < endA
  return startA < endB && startB < endA;
}

/**
 * Automatically calculates staffing metrics for a shoot.
 * Enforces the maximum 20 on-site crew members.
 * Only on-site assignments count towards the on-site crew capacity.
 */
export function calculateStaffingMetrics(
  plannedTeamSize: number,
  assignments: { team_member_id: string; assignment_type: string }[]
) {
  // Count unique on-site workers
  const onSiteAssignments = assignments.filter((a) => a.assignment_type === "on_site");
  const uniqueOnSiteWorkers = new Set(onSiteAssignments.map((a) => a.team_member_id)).size;
  const uniqueTotalWorkers = new Set(assignments.map((a) => a.team_member_id)).size;

  const maxOnSiteLimit = 20;
  const remainingRequired = Math.max(0, plannedTeamSize - uniqueOnSiteWorkers);
  const remainingCapacity = Math.max(0, maxOnSiteLimit - uniqueOnSiteWorkers);

  let staffingStatus: "Understaffed" | "Fully Staffed" | "Overstaffed" = "Understaffed";
  if (uniqueOnSiteWorkers === plannedTeamSize) {
    staffingStatus = "Fully Staffed";
  } else if (uniqueOnSiteWorkers > plannedTeamSize) {
    staffingStatus = "Overstaffed";
  }

  return {
    plannedTeamSize,
    uniqueOnSiteWorkers,
    uniqueTotalWorkers,
    remainingRequired,
    remainingCapacity,
    staffingStatus,
    isOverLimit: uniqueOnSiteWorkers > maxOnSiteLimit,
  };
}
