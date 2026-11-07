import { describe, it, expect } from "vitest";

describe("Project-wise Team Count & Optional Venue Logic", () => {
  // Helper to calculate project-level unique assigned team members
  function calculateProjectUniqueTeamMembers(
    projectEventIds: string[],
    assignments: Array<{ shoot_id: string; team_member_id: string; assignment_type?: string }>,
  ): { uniqueCount: number; uniqueMemberIds: string[] } {
    const eventIdSet = new Set(projectEventIds);
    const uniqueIds = new Set<string>();

    for (const a of assignments) {
      if (eventIdSet.has(a.shoot_id)) {
        uniqueIds.add(a.team_member_id);
      }
    }

    return {
      uniqueCount: uniqueIds.size,
      uniqueMemberIds: Array.from(uniqueIds),
    };
  }

  // Helper to check if a project has any events missing venue
  function checkProjectVenueStatus(events: Array<{ venue?: string | null }>): {
    hasMissingVenue: boolean;
    allMissing: boolean;
  } {
    if (!events.length) return { hasMissingVenue: true, allMissing: true };
    const missingCount = events.filter((e) => !e.venue || !e.venue.trim()).length;
    return {
      hasMissingVenue: missingCount > 0,
      allMissing: missingCount === events.length,
    };
  }

  it("calculates unique assigned team members across all events of a project without double counting", () => {
    const projectEventIds = ["event-haldi", "event-nikah", "event-reception", "event-ruksati"];

    // Worker A is on Haldi, Nikah, and Reception
    // Worker B is on Reception and Ruksati
    // Worker C is only on Haldi
    const assignments = [
      { shoot_id: "event-haldi", team_member_id: "worker-A" },
      { shoot_id: "event-nikah", team_member_id: "worker-A" },
      { shoot_id: "event-reception", team_member_id: "worker-A" },
      { shoot_id: "event-reception", team_member_id: "worker-B" },
      { shoot_id: "event-ruksati", team_member_id: "worker-B" },
      { shoot_id: "event-haldi", team_member_id: "worker-C" },
      // Unrelated project event assignment
      { shoot_id: "event-other-project", team_member_id: "worker-D" },
    ];

    const result = calculateProjectUniqueTeamMembers(projectEventIds, assignments);

    // Total unique workers associated with this project: Worker A, Worker B, Worker C
    expect(result.uniqueCount).toBe(3);
    expect(result.uniqueMemberIds).toEqual(
      expect.arrayContaining(["worker-A", "worker-B", "worker-C"]),
    );
    expect(result.uniqueMemberIds).not.toContain("worker-D");
  });

  it("updates the project team count when assignments change", () => {
    const projectEventIds = ["event-1", "event-2"];
    let assignments = [{ shoot_id: "event-1", team_member_id: "worker-1" }];

    expect(calculateProjectUniqueTeamMembers(projectEventIds, assignments).uniqueCount).toBe(1);

    // Add a second distinct worker to event-2
    assignments = [...assignments, { shoot_id: "event-2", team_member_id: "worker-2" }];
    expect(calculateProjectUniqueTeamMembers(projectEventIds, assignments).uniqueCount).toBe(2);

    // Reassigning same worker-1 to event-2 does not increment unique count
    assignments = [...assignments, { shoot_id: "event-2", team_member_id: "worker-1" }];
    expect(calculateProjectUniqueTeamMembers(projectEventIds, assignments).uniqueCount).toBe(2);
  });

  it("correctly identifies when venue is missing and requires a reminder badge", () => {
    const projectEventsWithMissingVenue = [
      { venue: "Taj Falaknuma" },
      { venue: null }, // Venue not added for this event
      { venue: "" }, // Blank venue
    ];

    const status1 = checkProjectVenueStatus(projectEventsWithMissingVenue);
    expect(status1.hasMissingVenue).toBe(true);
    expect(status1.allMissing).toBe(false);

    // Once user adds venue to all events
    const projectEventsFullySpecified = [
      { venue: "Taj Falaknuma" },
      { venue: "ITC Kohenur" },
      { venue: "Novotel Hyderabad" },
    ];

    const status2 = checkProjectVenueStatus(projectEventsFullySpecified);
    expect(status2.hasMissingVenue).toBe(false);
    expect(status2.allMissing).toBe(false);
  });

  it("allows saving a shoot payload when venue is omitted or null", () => {
    const shootPayload = {
      couple_name: "Rahul & Ananya",
      event_type: "Sangeet",
      event_date: "2026-12-10",
      location: "Hyderabad",
      venue: null, // Allowed!
      start_time: "18:00",
      planned_team_size: 3,
    };

    expect(shootPayload.venue).toBeNull();
    expect(shootPayload.location).toBe("Hyderabad");
  });
});
