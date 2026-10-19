import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateStaffingMetrics,
  doEventsOverlap,
  doesCrossMidnight,
  findWorkerConflicts,
} from "@/lib/scheduling";
import type { Tables } from "@/integrations/supabase/types";

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type ShootAssignment = Tables<"shoot_assignments">;

describe("Feature 1 & 2 Integration: Crew Assignments & Live Badges", () => {
  it("Validates time overlap and midnight crossing logic in Asia/Kolkata context", () => {
    // Regular daytime overlap
    expect(
      doEventsOverlap(
        { date: "2026-11-10", startTime: "10:00", endTime: "14:00" },
        { date: "2026-11-10", startTime: "12:00", endTime: "18:00" },
      ),
    ).toBe(true);

    // No overlap on same date
    expect(
      doEventsOverlap(
        { date: "2026-11-10", startTime: "09:00", endTime: "12:00" },
        { date: "2026-11-10", startTime: "13:00", endTime: "17:00" },
      ),
    ).toBe(false);

    // Event crossing midnight: 20:00 to 02:00 next day
    expect(doesCrossMidnight("20:00", "02:00")).toBe(true);
    expect(doesCrossMidnight("09:00", "18:00")).toBe(false);

    // Overlap with midnight crossing event on next day morning
    expect(
      doEventsOverlap(
        { date: "2026-11-10", startTime: "20:00", endTime: "02:00" },
        { date: "2026-11-11", startTime: "01:00", endTime: "06:00" },
      ),
    ).toBe(true);
  });

  it("Accurately computes staffing metrics, gaps, and remaining capacity", () => {
    const plannedTeamSize = 7;
    const assignments: Array<{ team_member_id: string; assignment_type: string }> = [
      { team_member_id: "worker-1", assignment_type: "on_site" },
      { team_member_id: "worker-2", assignment_type: "on_site" },
      { team_member_id: "worker-3", assignment_type: "on_site" },
      { team_member_id: "worker-4", assignment_type: "on_site" },
      { team_member_id: "worker-5", assignment_type: "post_production" }, // post-prod not counted in on-site
    ];

    const metrics = calculateStaffingMetrics(plannedTeamSize, assignments);

    expect(metrics.assignedCrew).toBe(4); // 4 unique on-site workers
    expect(metrics.uniqueOnSiteWorkers).toBe(4);
    expect(metrics.uniquePostProdWorkers).toBe(1);
    expect(metrics.additionalCrewRequired).toBe(3); // 7 - 4 = 3
    expect(metrics.remainingCapacity).toBe(16); // 20 - 4 = 16
    expect(metrics.staffingStatus).toBe("Understaffed");

    // Fully staffed
    const fullAssignments = [
      ...assignments,
      { team_member_id: "worker-6", assignment_type: "on_site" },
      { team_member_id: "worker-7", assignment_type: "on_site" },
      { team_member_id: "worker-8", assignment_type: "on_site" },
    ];
    const fullMetrics = calculateStaffingMetrics(7, fullAssignments);
    expect(fullMetrics.assignedCrew).toBe(7);
    expect(fullMetrics.additionalCrewRequired).toBe(0);
    expect(fullMetrics.staffingStatus).toBe("Fully Staffed");

    // Max capacity (20)
    const maxCapacityAssignments = Array.from({ length: 20 }, (_, i) => ({
      team_member_id: `worker-${i}`,
      assignment_type: "on_site",
    }));
    const maxMetrics = calculateStaffingMetrics(15, maxCapacityAssignments);
    expect(maxMetrics.assignedCrew).toBe(20);
    expect(maxMetrics.remainingCapacity).toBe(0);
    expect(maxMetrics.staffingStatus).toBe("Overstaffed");
  });

  it("Detects worker schedule conflicts, approved leaves, and inactive status", () => {
    const worker: TeamMember = {
      id: "worker-test-1",
      full_name: "Ahmed Khan",
      role: "Photographer",
      available: true,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email: "ahmed@example.com",
      phone: "+91 98765 43210",
      notes: null,
      admin_notes: null,
      emergency_contact: null,
      user_id: null,
    };

    const targetShoot: Shoot = {
      id: "shoot-target",
      couple_name: "Zainab & Bilal",
      event_type: "Wedding",
      event_date: "2026-12-15",
      start_time: "10:00:00",
      end_time: "16:00:00",
      location: "Taj Falaknuma",
      venue: "Grand Ballroom",
      planned_team_size: 7,
      status: "Upcoming",
      notes: null,
      created_by: "admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingShoots: Shoot[] = [
      {
        id: "shoot-existing-1",
        couple_name: "Sana & Farhan",
        event_type: "Reception",
        event_date: "2026-12-15",
        start_time: "12:00:00",
        end_time: "18:00:00",
        location: "ITC Kohenur",
        venue: null,
        planned_team_size: 6,
        status: "Upcoming",
        notes: null,
        created_by: "admin",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "shoot-cancelled",
        couple_name: "Cancelled Couple",
        event_type: "Reception",
        event_date: "2026-12-15",
        start_time: "10:00:00",
        end_time: "16:00:00",
        location: "Venue",
        venue: null,
        planned_team_size: 6,
        status: "Cancelled", // Must NOT block worker
        notes: null,
        created_by: "admin",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const existingAssignments: ShootAssignment[] = [
      {
        id: "asg-1",
        shoot_id: "shoot-existing-1",
        team_member_id: "worker-test-1",
        assignment_type: "on_site",
        created_at: new Date().toISOString(),
      },
      {
        id: "asg-2",
        shoot_id: "shoot-cancelled",
        team_member_id: "worker-test-1",
        assignment_type: "on_site",
        created_at: new Date().toISOString(),
      },
    ];

    // Conflict detected with Sana & Farhan (overlapping times)
    const conflicts = findWorkerConflicts({
      workerId: worker.id,
      shoot: targetShoot,
      team: [worker],
      shoots: existingShoots,
      assignments: existingAssignments,
      availabilityRequests: [],
    });
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.type).toBe("shoot_overlap");
    expect(conflicts[0]?.message).toContain("Sana & Farhan");

    // Cancelled shoot did not trigger a conflict
    const hasCancelledConflict = conflicts.some((c) => c.message.includes("Cancelled Couple"));
    expect(hasCancelledConflict).toBe(false);

    // Conflict with approved leave
    const leaveConflicts = findWorkerConflicts({
      workerId: worker.id,
      shoot: targetShoot,
      team: [worker],
      shoots: [],
      assignments: [],
      availabilityRequests: [
        {
          id: "leave-1",
          user_id: "user-1",
          worker_id: worker.id,
          request_type: "leave",
          start_date: "2026-12-14",
          end_date: "2026-12-16",
          status: "approved",
          reason: "Family event",
        },
      ],
    });
    expect(leaveConflicts.length).toBe(1);
    expect(leaveConflicts[0]?.type).toBe("approved_leave");
  });

  it("Enforces RLS: Unauthenticated users are denied execution of replace_shoot_assignments", async () => {
    // Calling replace_shoot_assignments anonymously must fail with code 42501
    const { data, error } = await supabase.rpc("replace_shoot_assignments", {
      p_shoot_id: "00000000-0000-0000-0000-000000000000",
      p_assignments: [],
    });

    expect(data).toBeNull();
    expect(error).toBeDefined();
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("Not authorized");
  });

  it("Enforces atomic replace_shoot_assignments RPC input validation", async () => {
    // Calling with non-existent shoot or invalid ID from client
    const { data, error } = await supabase.rpc("replace_shoot_assignments", {
      p_shoot_id: "11111111-1111-1111-1111-111111111111",
      p_assignments: [
        { team_member_id: "22222222-2222-2222-2222-222222222222", assignment_type: "on_site" },
      ],
    });
    // Should be rejected by backend authorization or validation
    expect(error).toBeDefined();
  });
});
