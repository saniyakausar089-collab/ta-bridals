import { describe, expect, it } from "vitest";
import {
  calculateStaffingMetrics,
  doEventsOverlap,
  doesCrossMidnight,
  findWorkerConflicts,
  formatScheduleDate,
  formatTime12Hour,
  formatTimingInterval,
  getWorkerScheduleStatus,
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

  it("formats 12-hour AM/PM times and dates cleanly", () => {
    expect(formatTime12Hour("09:00:00")).toBe("9:00 AM");
    expect(formatTime12Hour("13:00")).toBe("1:00 PM");
    expect(formatTime12Hour("17:30")).toBe("5:30 PM");
    expect(formatScheduleDate("2026-11-10")).toBe("10 November 2026");
    expect(formatTimingInterval("09:00", "13:00")).toBe("9:00 AM – 1:00 PM");
  });

  it("detects overlapping events on the same date", () => {
    // Overlapping events: 10:00-14:00 and 12:00-16:00
    const overlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: "14:00" },
      { date: "2026-10-25", startTime: "12:00", endTime: "16:00" },
    );
    expect(overlap).toBe(true);

    // Non-overlapping events: 09:00-12:00 and 13:00-17:00
    const nonOverlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "09:00", endTime: "12:00" },
      { date: "2026-10-25", startTime: "13:00", endTime: "17:00" },
    );
    expect(nonOverlap).toBe(false);

    // Different dates
    const differentDates = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: "14:00" },
      { date: "2026-10-26", startTime: "10:00", endTime: "14:00" },
    );
    expect(differentDates).toBe(false);
  });

  it("strictly enforces same-day rules: allows non-overlapping, blocks overlapping, considers abutting times non-overlapping", () => {
    // Example 1 – ALLOWED:
    // Shoot A: 10 November | 9:00 AM – 1:00 PM (09:00 - 13:00)
    // Shoot B: 10 November | 5:00 PM – 9:00 PM (17:00 - 21:00)
    expect(
      doEventsOverlap(
        { date: "2026-11-10", startTime: "09:00", endTime: "13:00" },
        { date: "2026-11-10", startTime: "17:00", endTime: "21:00" },
      ),
    ).toBe(false);

    // Contiguous / abutting interval (e.g. 9:00 - 1:00 PM and 1:00 PM - 5:00 PM) is non-overlapping
    expect(
      doEventsOverlap(
        { date: "2026-11-10", startTime: "09:00", endTime: "13:00" },
        { date: "2026-11-10", startTime: "13:00", endTime: "17:00" },
      ),
    ).toBe(false);

    // Example 2 – NOT ALLOWED:
    // Shoot A: 10 November | 9:00 AM – 1:00 PM (09:00 - 13:00)
    // Shoot B: 10 November | 11:00 AM – 3:00 PM (11:00 - 15:00)
    expect(
      doEventsOverlap(
        { date: "2026-11-10", startTime: "09:00", endTime: "13:00" },
        { date: "2026-11-10", startTime: "11:00", endTime: "15:00" },
      ),
    ).toBe(true);
  });

  it("handles missing end time by defaulting to standard 3-hour duration", () => {
    // Event A starts at 10:00 with no end time (defaults to 13:00)
    // Event B starts at 12:00
    const overlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: null },
      { date: "2026-10-25", startTime: "12:00", endTime: "15:00" },
    );
    expect(overlap).toBe(true);

    // Event B starts at 14:00 (after 13:00)
    const noOverlap = doEventsOverlap(
      { date: "2026-10-25", startTime: "10:00", endTime: null },
      { date: "2026-10-25", startTime: "14:00", endTime: "16:00" },
    );
    expect(noOverlap).toBe(false);
  });

  it("handles events crossing midnight", () => {
    expect(doesCrossMidnight("22:00", "02:00")).toBe(true);
    expect(doesCrossMidnight("09:00", "17:00")).toBe(false);

    // Event starts at 22:00 and ends at 02:00 (crossing midnight)
    // Event B on same day starts at 23:00
    const overlapSameDay = doEventsOverlap(
      { date: "2026-10-25", startTime: "22:00", endTime: "02:00" },
      { date: "2026-10-25", startTime: "23:00", endTime: "23:59" },
    );
    expect(overlapSameDay).toBe(true);

    // Event A on 2026-10-25 ends at 02:00 next day
    // Event B on 2026-10-26 starts at 01:00 and ends at 05:00
    const overlapNextDay = doEventsOverlap(
      { date: "2026-10-25", startTime: "22:00", endTime: "02:00" },
      { date: "2026-10-26", startTime: "01:00", endTime: "05:00" },
    );
    expect(overlapNextDay).toBe(true);

    // Event B on 2026-10-26 starts at 03:00 (after 02:00)
    const noOverlapNextDay = doEventsOverlap(
      { date: "2026-10-25", startTime: "22:00", endTime: "02:00" },
      { date: "2026-10-26", startTime: "03:00", endTime: "07:00" },
    );
    expect(noOverlapNextDay).toBe(false);
  });

  it("calculates staffing metrics and enforces on-site vs post-production roles", () => {
    const plannedCrew = 7;
    const assignments = [
      { team_member_id: "m1", assignment_type: "on_site" },
      { team_member_id: "m2", assignment_type: "on_site" },
      { team_member_id: "m3", assignment_type: "on_site" },
      { team_member_id: "m4", assignment_type: "post_production" },
      { team_member_id: "m5", assignment_type: "post_production" },
    ];

    const metrics = calculateStaffingMetrics(plannedCrew, assignments);

    expect(metrics.uniqueOnSiteWorkers).toBe(3);
    expect(metrics.assignedCrew).toBe(3);
    expect(metrics.uniqueTotalWorkers).toBe(5);
    expect(metrics.remainingRequired).toBe(4);
    expect(metrics.additionalCrewRequired).toBe(4);
    expect(metrics.remainingCapacity).toBe(17);
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

  it("detects worker conflicts with exact project, event, and timing details", () => {
    const team = [
      { id: "worker-1", full_name: "Ahmed", role: "Photographer", status: "active" },
      { id: "worker-2", full_name: "Sara Ali", role: "Videographer", status: "active" },
    ];
    const shoots = [
      {
        id: "shoot-nikah",
        couple_name: "Ayesha & Ahmed",
        event_type: "Nikah",
        event_date: "2026-11-10",
        start_time: "11:00",
        end_time: "15:00",
        status: "Upcoming",
      },
      {
        id: "shoot-cancelled",
        couple_name: "Zainab & Bilal",
        event_type: "Reception",
        event_date: "2026-11-10",
        start_time: "11:00",
        end_time: "15:00",
        status: "Cancelled",
      },
    ];
    const assignments = [
      { shoot_id: "shoot-nikah", team_member_id: "worker-1", assignment_type: "on_site" },
      { shoot_id: "shoot-cancelled", team_member_id: "worker-2", assignment_type: "on_site" },
    ];

    // Check worker-1 on target shoot at 13:00 to 17:00 -> should conflict with Nikah (11:00-15:00)
    const conflicts1 = findWorkerConflicts({
      shoot: { id: "new-shoot", event_date: "2026-11-10", start_time: "13:00", end_time: "17:00" },
      workerId: "worker-1",
      team,
      shoots,
      assignments,
    });
    expect(conflicts1.length).toBe(1);
    expect(conflicts1[0]?.type).toBe("shoot_overlap");
    expect(conflicts1[0]?.severity).toBe("error");
    expect(conflicts1[0]?.message).toContain("Ayesha & Ahmed");
    expect(conflicts1[0]?.message).toContain("Nikah");
    expect(conflicts1[0]?.conflictingShoot?.coupleName).toBe("Ayesha & Ahmed");
    expect(conflicts1[0]?.conflictingShoot?.eventType).toBe("Nikah");

    // Check worker-2 on target shoot at 12:00 -> cancelled shoot should NOT block worker-2
    const conflicts2 = findWorkerConflicts({
      shoot: { id: "new-shoot", event_date: "2026-11-10", start_time: "12:00", end_time: "18:00" },
      workerId: "worker-2",
      team,
      shoots,
      assignments,
    });
    expect(conflicts2.length).toBe(0);
  });

  it("indicates member availability when member has another assignment on the same day at a different time", () => {
    const team = [{ id: "worker-1", full_name: "Ahmed", role: "Photographer", status: "active" }];
    const shoots = [
      {
        id: "shoot-morning",
        couple_name: "Ayesha & Ahmed",
        event_type: "Haldi",
        event_date: "2026-11-10",
        start_time: "09:00",
        end_time: "13:00",
        status: "Upcoming",
      },
    ];
    const assignments = [
      { shoot_id: "shoot-morning", team_member_id: "worker-1", assignment_type: "on_site" },
    ];

    // Worker has morning shoot (9:00 - 13:00). We test availability for evening shoot (17:00 - 21:00)
    const status = getWorkerScheduleStatus({
      shoot: {
        id: "shoot-evening",
        event_date: "2026-11-10",
        start_time: "17:00",
        end_time: "21:00",
      },
      workerId: "worker-1",
      team,
      shoots,
      assignments,
    });

    expect(status.isAvailable).toBe(true);
    expect(status.hasOverlapConflict).toBe(false);
    expect(status.sameDayAssignments.length).toBe(1);
    expect(status.statusText).toContain("Available · Working on Ayesha & Ahmed");
    expect(status.statusText).toContain("Haldi");
  });

  it("detects worker conflicts for approved leave requests", () => {
    const team = [
      { id: "worker-1", full_name: "Ahmed Khan", role: "Photographer", status: "active" },
    ];
    const availabilityRequests = [
      {
        id: "leave-1",
        worker_id: "worker-1",
        request_type: "leave",
        start_date: "2026-11-08",
        end_date: "2026-11-12",
        status: "approved",
        reason: "Family Vacation",
      },
      {
        id: "leave-pending",
        worker_id: "worker-1",
        request_type: "leave",
        start_date: "2026-11-15",
        end_date: "2026-11-18",
        status: "pending",
        reason: "Medical Checkup",
      },
    ];

    const conflicts = findWorkerConflicts({
      shoot: { id: "shoot-x", event_date: "2026-11-10", start_time: "09:00", end_time: "17:00" },
      workerId: "worker-1",
      team,
      shoots: [],
      assignments: [],
      availabilityRequests,
    });

    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.type).toBe("approved_leave");
    expect(conflicts[0]?.message).toContain("Family Vacation");
  });
});
