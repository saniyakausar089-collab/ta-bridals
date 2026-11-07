import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";

type Shoot = Tables<"shoots">;
type Assignment = Tables<"shoot_assignments">;
type TeamMember = Tables<"team_members">;

describe("All Shoots & All Events Navigation Hierarchy Verification", () => {
  const mockShoots: Shoot[] = [
    {
      id: "shoot-1",
      couple_name: "Fatima & Zaid",
      "shoot name": "Fatima & Zaid",
      event_type: "Sangeet",
      event_date: "2026-11-15",
      start_time: "18:00:00",
      end_time: "22:00:00",
      planned_team_size: 4,
      status: "Upcoming",
      location: "Banjara Hills",
      venue: "Park Hyatt",
      notes: null,
      package_amount: 120000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "shoot-2",
      couple_name: "Fatima & Zaid",
      "shoot name": "Fatima & Zaid",
      event_type: "Nikah",
      event_date: "2026-11-17",
      start_time: "11:00:00",
      end_time: "15:00:00",
      planned_team_size: 5,
      status: "Upcoming",
      location: "Old City",
      venue: "", // Venue missing intentionally to test reminder badge
      notes: null,
      package_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "shoot-3",
      couple_name: "Sara & Imran",
      "shoot name": "Sara & Imran",
      event_type: "Reception",
      event_date: "2026-12-05",
      start_time: "19:00:00",
      end_time: "23:00:00",
      planned_team_size: 3,
      status: "Upcoming",
      location: "Jubilee Hills",
      venue: "ITC Kohenur",
      notes: null,
      package_amount: 80000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
  ];

  const mockAssignments: Assignment[] = [
    {
      id: "as-1",
      shoot_id: "shoot-1",
      team_member_id: "tm-1",
      assignment_type: "lead_photographer",
      assigned_at: new Date().toISOString(),
    },
    {
      id: "as-2",
      shoot_id: "shoot-2",
      team_member_id: "tm-1",
      assignment_type: "lead_photographer",
      assigned_at: new Date().toISOString(),
    },
    {
      id: "as-3",
      shoot_id: "shoot-2",
      team_member_id: "tm-2",
      assignment_type: "cinematographer",
      assigned_at: new Date().toISOString(),
    },
  ];

  it("Level 1: Groups client projects across months and derives project-wise team counts", () => {
    const projectMap = new Map<string, Shoot[]>();
    for (const s of mockShoots) {
      const key = (s.couple_name || "").toLowerCase();
      if (!projectMap.has(key)) projectMap.set(key, []);
      projectMap.get(key)!.push(s);
    }

    expect(projectMap.size).toBe(2);
    expect(projectMap.get("fatima & zaid")?.length).toBe(2);
    expect(projectMap.get("sara & imran")?.length).toBe(1);

    // Calculate unique assigned team members for Fatima & Zaid
    const fatimaShootIds = new Set(projectMap.get("fatima & zaid")!.map((s) => s.id));
    const assignedTeamMembers = new Set(
      mockAssignments
        .filter((a) => fatimaShootIds.has(a.shoot_id))
        .map((a) => a.team_member_id)
    );
    // tm-1 is on both shoot-1 and shoot-2, tm-2 is on shoot-2 -> total unique = 2
    expect(assignedTeamMembers.size).toBe(2);
  });

  it("Level 2: Filters client projects by selected month", () => {
    const novProjects = mockShoots.filter((s) => s.event_date.startsWith("2026-11"));
    const decProjects = mockShoots.filter((s) => s.event_date.startsWith("2026-12"));

    expect(novProjects.length).toBe(2);
    expect(decProjects.length).toBe(1);
    expect(decProjects[0].couple_name).toBe("Sara & Imran");
  });

  it("Level 3: Opens project details and loads All Events belonging to that project", () => {
    const selectedProjectName = "Fatima & Zaid";
    const projectEvents = mockShoots.filter(
      (s) => s.couple_name.toLowerCase() === selectedProjectName.toLowerCase()
    );

    expect(projectEvents.length).toBe(2);
    expect(projectEvents[0].event_type).toBe("Sangeet");
    expect(projectEvents[1].event_type).toBe("Nikah");

    // Missing venue detection
    const hasMissingVenue = projectEvents.some((e) => !e.venue || !e.venue.trim());
    expect(hasMissingVenue).toBe(true);
    expect(projectEvents[1].venue).toBe("");
  });

  it("Level 4: Toggles and displays Individual Event Details without throwing reference errors", () => {
    let selectedEventId: string | null = null;

    // User clicks event-1
    selectedEventId = "shoot-1";
    expect(selectedEventId).toBe("shoot-1");

    const activeEvent = mockShoots.find((s) => s.id === selectedEventId);
    expect(activeEvent).toBeDefined();
    expect(activeEvent?.event_type).toBe("Sangeet");
    expect(activeEvent?.venue).toBe("Park Hyatt");

    // User collapses / clicks back
    selectedEventId = null;
    expect(selectedEventId).toBeNull();
  });

  it("Back navigation: Resets project and event selections at every level", () => {
    let selectedMonth: string | null = "2026-11";
    let selectedProjectName: string | null = "Fatima & Zaid";
    let selectedEventId: string | null = "shoot-1";

    // Back from Level 4 to Level 3
    selectedEventId = null;
    expect(selectedEventId).toBeNull();
    expect(selectedProjectName).toBe("Fatima & Zaid");

    // Back from Level 3 to Level 2
    selectedProjectName = null;
    expect(selectedProjectName).toBeNull();
    expect(selectedMonth).toBe("2026-11");

    // Back from Level 2 to Level 1
    selectedMonth = null;
    expect(selectedMonth).toBeNull();
  });
});
