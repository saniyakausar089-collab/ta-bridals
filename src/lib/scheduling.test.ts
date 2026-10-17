import { describe, expect, it } from "vitest";
import {
  calculateStaffingMetrics,
  doEventsOverlap,
  parseTimeToMinutes,
} from "./scheduling";

describe("Scheduling and Staffing Calculations", () => {
  it("parses time strings to minutes correctly", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("15:30")).toBe(930);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes(null)).toBe(-1);
    expect(parseTimeToMinutes("invalid")).toBe(-1);
  });

  it("detects overlapping events on the same date", () => {
    // Overlapping events: 10:00-14:00 and 12:00-16:00
    const overlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: "14:00" },
      { date: "2026-10-25", startTime: "12:00", endTime: "16:00" }
    );
    expect(overlap).toBe(true);

    // Non-overlapping events: 09:00-12:00 and 13:00-17:00
    const nonOverlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "09:00", endTime: "12:00" },
      { date: "2026-10-25", startTime: "13:00", endTime: "17:00" }
    );
    expect(nonOverlap).toBe(false);

    // Different dates
    const differentDates = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: "14:00" },
      { date: "2026-10-26", startTime: "10:00", endTime: "14:00" }
    );
    expect(differentDates).toBe(false);
  });

  it("handles missing end time by defaulting to standard 3-hour duration", () => {
    // Event A starts at 10:00 with no end time (defaults to 13:00)
    // Event B starts at 12:00
    const overlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: null },
      { date: "2026-10-25", startTime: "12:00", endTime: "15:00" }
    );
    expect(overlap).toBe(true);

    // Event B starts at 14:00 (after 13:00)
    const noOverlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: null },
      { date: "2026-10-25", startTime: "14:00", endTime: "16:00" }
    );
    expect(noOverlap).toBe(false);
  });

  it("handles events crossing midnight", () => {
    // Event starts at 22:00 and ends at 02:00 (crossing midnight)
    // Event B starts at 23:00
    const overlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "22:00", endTime: "02:00" },
      { date: "2026-10-25", startTime: "23:00", endTime: "23:59" }
    );
    expect(overlap).toBe(true);
  });

  it("calculates staffing metrics and enforces on-site vs post-production roles", () => {
    const plannedCrew = 7;
    const assignments = [
      { team_member_id: "m1", assignment_type: "on_site" },
      { team_member_id: "m2", assignment_type: "on_site" },
      { team_member_id: "m3", assignment_type: "on_site" },
      { team_member_id: "m4", assignment_type: "post_production" }, // Editor: not on-site
      { team_member_id: "m5", assignment_type: "post_production" }, // Album designer: not on-site
    ];

    const metrics = calculateStaffingMetrics(plannedCrew, assignments);

    // Only 3 on-site crew members
    expect(metrics.uniqueOnSiteWorkers).toBe(3);
    expect(metrics.uniqueTotalWorkers).toBe(5);
    expect(metrics.remainingRequired).toBe(4);
    expect(metrics.remainingCapacity).toBe(17); // 20 max limit - 3
    expect(metrics.staffingStatus).toBe("Understaffed");
    expect(metrics.isOverLimit).toBe(false);
  });

  it("detects fully staffed and overstaffed status", () => {
    const plannedCrew = 2;
    const assignments = [
      { team_member_id: "m1", assignment_type: "on_site" },
      { team_member_id: "m2", assignment_type: "on_site" },
    ];

    const fullyStaffed = calculateStaffingMetrics(plannedCrew, assignments);
    expect(fullyStaffed.staffingStatus).toBe("Fully Staffed");
    expect(fullyStaffed.remainingRequired).toBe(0);

    const overstaffedAssignments = [
      ...assignments,
      { team_member_id: "m3", assignment_type: "on_site" },
    ];
    const overstaffed = calculateStaffingMetrics(plannedCrew, overstaffedAssignments);
    expect(overstaffed.staffingStatus).toBe("Overstaffed");
  });
});
