import { describe, expect, it } from "vitest";
import {
  doEventsOverlap,
  findWorkerConflicts,
  formatScheduleDate,
  formatTime12Hour,
  formatTimingInterval,
  getWorkerScheduleStatus,
} from "@/lib/scheduling";
import type { Tables } from "@/integrations/supabase/types";

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;

describe("All Shoots Hierarchy & Global Crew Availability (TURBO MODE)", () => {
  it("groups multiple events under one parent client project without duplicate projects", () => {
    // A client project with 4 events across 2 months
    const shoots: Shoot[] = [
      {
        id: "event-1",
        couple_name: "Ayesha & Ahmed",
        "shoot name": "Ayesha & Ahmed",
        event_type: "Haldi",
        event_date: "2026-11-10",
        start_time: "09:00:00",
        end_time: "13:00:00",
        planned_team_size: 4,
        status: "Upcoming",
        location: "Hyderabad",
        venue: "Taj Krishna",
        notes: null,
        package_amount: 150000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "admin",
      },
      {
        id: "event-2",
        couple_name: "Ayesha & Ahmed",
        "shoot name": "Ayesha & Ahmed",
        event_type: "Nikah",
        event_date: "2026-11-12",
        start_time: "11:00:00",
        end_time: "15:00:00",
        planned_team_size: 5,
        status: "Upcoming",
        location: "Hyderabad",
        venue: "Chowmahalla Palace",
        notes: null,
        package_amount: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "admin",
      },
      {
        id: "event-3",
        couple_name: "Ayesha & Ahmed",
        "shoot name": "Ayesha & Ahmed",
        event_type: "Ruksati",
        event_date: "2026-11-14",
        start_time: "18:00:00",
        end_time: "22:00:00",
        planned_team_size: 4,
        status: "Upcoming",
        location: "Hyderabad",
        venue: "ITC Kohenur",
        notes: null,
        package_amount: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "admin",
      },
      {
        id: "event-4",
        couple_name: "Ayesha & Ahmed",
        "shoot name": "Ayesha & Ahmed",
        event_type: "Reception",
        event_date: "2026-12-02",
        start_time: "19:00:00",
        end_time: "23:00:00",
        planned_team_size: 6,
        status: "Upcoming",
        location: "Hyderabad",
        venue: "Gachibowli Stadium",
        notes: null,
        package_amount: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "admin",
      },
    ];

    // Group by project name
    const projectMap = new Map<string, Shoot[]>();
    for (const s of shoots) {
      const name = (s.couple_name || (s as any)["shoot name"]).trim();
      const key = name.toLowerCase();
      if (!projectMap.has(key)) projectMap.set(key, []);
      projectMap.get(key)!.push(s);
    }

    // Must yield exactly 1 client project
    expect(projectMap.size).toBe(1);
    const events = projectMap.get("ayesha & ahmed")!;
    expect(events.length).toBe(4);

    // Events must maintain their individual event types and dates
    expect(events.map((e) => e.event_type)).toEqual(["Haldi", "Nikah", "Ruksati", "Reception"]);

    // Months spanning November 2026 and December 2026
    const months = Array.from(new Set(events.map((e) => e.event_date.slice(0, 7))));
    expect(months).toContain("2026-11");
    expect(months).toContain("2026-12");
  });

  it("SAME-DAY ASSIGNMENTS: Allows same-day non-overlapping shoots (Example 1 from prompt)", () => {
    // Shoot A: 10 November | 9:00 AM – 1:00 PM
    // Shoot B: 10 November | 5:00 PM – 9:00 PM
    const overlap = doEventsOverlap(
      { date: "2026-11-10", startTime: "09:00", endTime: "13:00" },
      { date: "2026-11-10", startTime: "17:00", endTime: "21:00" },
    );
    expect(overlap).toBe(false);

    const team: TeamMember[] = [
      {
        id: "w-1",
        full_name: "Ahmed",
        role: "Photographer",
        status: "active",
        available: true,
        created_at: "",
        updated_at: "",
        email: null,
        phone: null,
        notes: null,
        admin_notes: null,
      },
    ];
    const shoots = [
      {
        id: "shoot-a",
        couple_name: "Fatima & Zaid",
        event_type: "Haldi",
        event_date: "2026-11-10",
        start_time: "09:00",
        end_time: "13:00",
        status: "Upcoming",
      },
    ];
    const assignments = [
      { shoot_id: "shoot-a", team_member_id: "w-1", assignment_type: "on_site" },
    ];

    // Status check for evening shoot (17:00 - 21:00)
    const status = getWorkerScheduleStatus({
      shoot: { id: "shoot-b", event_date: "2026-11-10", start_time: "17:00", end_time: "21:00" },
      workerId: "w-1",
      team,
      shoots,
      assignments,
    });

    expect(status.isAvailable).toBe(true);
    expect(status.hasOverlapConflict).toBe(false);
    expect(status.sameDayAssignments.length).toBe(1);
    expect(status.statusText).toContain("Available · Working on Fatima & Zaid (Haldi)");
  });

  it("SAME-DAY ASSIGNMENTS: Blocks same-day overlapping shoots and produces clear warning (Example 2 from prompt)", () => {
    // Shoot A: 10 November | 9:00 AM – 1:00 PM
    // Shoot B: 10 November | 11:00 AM – 3:00 PM
    const overlap = doEventsOverlap(
      { date: "2026-11-10", startTime: "09:00", endTime: "13:00" },
      { date: "2026-11-10", startTime: "11:00", endTime: "15:00" },
    );
    expect(overlap).toBe(true);

    const team: TeamMember[] = [
      {
        id: "w-1",
        full_name: "Ahmed",
        role: "Photographer",
        status: "active",
        available: true,
        created_at: "",
        updated_at: "",
        email: null,
        phone: null,
        notes: null,
        admin_notes: null,
      },
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
    ];
    const assignments = [
      { shoot_id: "shoot-nikah", team_member_id: "w-1", assignment_type: "on_site" },
    ];

    const conflicts = findWorkerConflicts({
      shoot: { id: "shoot-new", event_date: "2026-11-10", start_time: "13:00", end_time: "17:00" },
      workerId: "w-1",
      team,
      shoots,
      assignments,
    });

    expect(conflicts.length).toBe(1);
    expect(conflicts[0].severity).toBe("error");
    expect(conflicts[0].conflictingShoot?.coupleName).toBe("Ayesha & Ahmed");
    expect(conflicts[0].conflictingShoot?.eventType).toBe("Nikah");
    expect(conflicts[0].conflictingShoot?.formattedTiming).toBe("11:00 AM – 3:00 PM");

    const status = getWorkerScheduleStatus({
      shoot: { id: "shoot-new", event_date: "2026-11-10", start_time: "13:00", end_time: "17:00" },
      workerId: "w-1",
      team,
      shoots,
      assignments,
    });

    expect(status.isAvailable).toBe(false);
    expect(status.hasOverlapConflict).toBe(true);
    expect(status.statusBadge).toBe("unavailable");
  });

  it("considers contiguous / abutting assignments (e.g. 9-1 and 1-5) non-overlapping", () => {
    const overlap = doEventsOverlap(
      { date: "2026-11-10", startTime: "09:00", endTime: "13:00" },
      { date: "2026-11-10", startTime: "13:00", endTime: "17:00" },
    );
    expect(overlap).toBe(false);
  });
});
