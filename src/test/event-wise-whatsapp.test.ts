import { describe, expect, it } from "vitest";
import {
  generateEventWhatsAppDetails,
  getEventAssignedCrew,
  categorizeCrewRole,
  formatEventFullDate,
  normalizeWhatsAppPhone,
  type Shoot,
  type TeamMember,
  type Assignment,
} from "@/lib/messagingUtils";

describe("Event-Wise WhatsApp Event Details Messaging — TA Bridals", () => {
  // Test Setup: Mushtaq Wedding with 3 distinct events and different crew assignments
  const mockTeam: TeamMember[] = [
    {
      id: "crew-arfan",
      full_name: "Arfan Khan",
      role: "Photographer",
      phone: "9876543210",
      email: "arfan@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "crew-akram",
      full_name: "Akram Syed",
      role: "Videographer",
      phone: "9876543211",
      email: "akram@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "crew-vamsi",
      full_name: "Vamsi Krishna",
      role: "Photographer",
      phone: "9876543212",
      email: "vamsi@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "crew-sameer",
      full_name: "Sameer Ahmed",
      role: "Videographer",
      phone: "9876543213",
      email: "sameer@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "crew-toufeeq",
      full_name: "Toufeeq Drone",
      role: "Drone Operator",
      phone: "9876543214",
      email: "toufeeq@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
  ];

  // Mushtaq Wedding: 3 separate events
  const haldiShoot: Shoot = {
    id: "shoot-haldi",
    couple_name: "Mushtaq Wedding",
    "shoot name": "Mushtaq Wedding",
    event_type: "Haldi",
    event_date: "2026-11-20",
    start_time: "09:00:00",
    end_time: "13:00:00",
    planned_team_size: 2,
    status: "Upcoming",
    venue: "Taj Krishna",
    location: "Road No 1, Banjara Hills, Hyderabad",
    notes: "[Client Contact: +91 99887 76655]",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "admin",
  };

  const nikahShoot: Shoot = {
    id: "shoot-nikah",
    couple_name: "Mushtaq Wedding",
    "shoot name": "Mushtaq Wedding",
    event_type: "Nikah",
    event_date: "2026-11-21",
    start_time: "11:30:00",
    end_time: "16:00:00",
    planned_team_size: 2,
    status: "Upcoming",
    venue: "Imperial Gardens",
    location: "Secunderabad",
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "admin",
  };

  const receptionShoot: Shoot = {
    id: "shoot-reception",
    couple_name: "Mushtaq Wedding",
    "shoot name": "Mushtaq Wedding",
    event_type: "Reception",
    event_date: "2026-11-22",
    start_time: "19:00:00",
    end_time: "23:30:00",
    planned_team_size: 2,
    status: "Upcoming",
    venue: "ITC Kohenur",
    location: "HITEC City, Hyderabad",
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "admin",
  };

  const mockAssignments: Assignment[] = [
    // Haldi: Arfan (Photographer) & Akram (Videographer)
    {
      id: "asg-h1",
      shoot_id: "shoot-haldi",
      team_member_id: "crew-arfan",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-h2",
      shoot_id: "shoot-haldi",
      team_member_id: "crew-akram",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },

    // Nikah: Vamsi (Photographer) & Akram (Videographer)
    {
      id: "asg-n1",
      shoot_id: "shoot-nikah",
      team_member_id: "crew-vamsi",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-n2",
      shoot_id: "shoot-nikah",
      team_member_id: "crew-akram",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },

    // Reception: Arfan (Photographer) & Sameer (Videographer)
    {
      id: "asg-r1",
      shoot_id: "shoot-reception",
      team_member_id: "crew-arfan",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-r2",
      shoot_id: "shoot-reception",
      team_member_id: "crew-sameer",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
  ];

  describe("Requirement 1: Event-Wise Crew Isolation", () => {
    it("fetches ONLY Arfan and Akram for Haldi event", () => {
      const haldiCrew = getEventAssignedCrew("shoot-haldi", mockAssignments, mockTeam);
      const crewNames = haldiCrew.map((c) => c.member.full_name);

      expect(crewNames).toHaveLength(2);
      expect(crewNames).toContain("Arfan Khan");
      expect(crewNames).toContain("Akram Syed");
      expect(crewNames).not.toContain("Vamsi Krishna");
      expect(crewNames).not.toContain("Sameer Ahmed");
    });

    it("fetches ONLY Vamsi and Akram for Nikah event", () => {
      const nikahCrew = getEventAssignedCrew("shoot-nikah", mockAssignments, mockTeam);
      const crewNames = nikahCrew.map((c) => c.member.full_name);

      expect(crewNames).toHaveLength(2);
      expect(crewNames).toContain("Vamsi Krishna");
      expect(crewNames).toContain("Akram Syed");
      expect(crewNames).not.toContain("Arfan Khan");
      expect(crewNames).not.toContain("Sameer Ahmed");
    });

    it("fetches ONLY Arfan and Sameer for Reception event", () => {
      const receptionCrew = getEventAssignedCrew("shoot-reception", mockAssignments, mockTeam);
      const crewNames = receptionCrew.map((c) => c.member.full_name);

      expect(crewNames).toHaveLength(2);
      expect(crewNames).toContain("Arfan Khan");
      expect(crewNames).toContain("Sameer Ahmed");
      expect(crewNames).not.toContain("Vamsi Krishna");
      expect(crewNames).not.toContain("Akram Syed");
    });
  });

  describe("Requirement 2: Event Details Message Format", () => {
    it("generates correct message format with client, date, time, venue, and assigned categories for Haldi", () => {
      const haldiCrew = getEventAssignedCrew("shoot-haldi", mockAssignments, mockTeam);
      const message = generateEventWhatsAppDetails({
        shoot: haldiShoot,
        clientName: "Mushtaq Wedding",
        assignedCrew: haldiCrew,
      });

      // Headers & Core sections
      expect(message).toContain("TA BRIDALS – EVENT DETAILS");
      expect(message).toContain("Dear Team,");
      expect(message).toContain("Please find below the event details.");
      expect(message).toContain("- CLIENT NAME: Mushtaq Wedding");
      expect(message).toContain("- CONTACT NUMBER: +91 99887 76655");

      // Event Details
      expect(message).toContain("EVENT DETAILS");
      expect(message).toContain("- EVENT DATE: 20 November 2026");
      expect(message).toContain("- EVENT NAME: Haldi");
      expect(message).toContain("- REPORTING TIME: 9:00 AM");

      // Venue
      expect(message).toContain("VENUE");
      expect(message).toContain("- Taj Krishna");
      expect(message).toContain("- Road No 1, Banjara Hills, Hyderabad");

      // Photographers category
      expect(message).toContain("PHOTOGRAPHERS");
      expect(message).toContain("- Arfan Khan");
      expect(message).toContain("- +91 98765 43210");

      // Videographers category
      expect(message).toContain("VIDEOGRAPHERS");
      expect(message).toContain("- Akram Syed");
      expect(message).toContain("- +91 98765 43211");

      // MUST NOT include unassigned categories
      expect(message).not.toContain("DRONE OPERATORS");
      expect(message).not.toContain("CINEMATOGRAPHERS");
      expect(message).not.toContain("OTHERS");

      // MUST NOT include unassigned crew from other events
      expect(message).not.toContain("Vamsi Krishna");
      expect(message).not.toContain("Sameer Ahmed");
    });

    it("displays DRONE OPERATORS and CINEMATOGRAPHERS only when assigned", () => {
      const customCrew = [
        {
          member: mockTeam[4], // Toufeeq (Drone Operator)
          roles: ["Drone Operator"],
          category: categorizeCrewRole("Drone Operator"),
          phoneInfo: normalizeWhatsAppPhone("9876543214"),
        },
      ];

      const message = generateEventWhatsAppDetails({
        shoot: haldiShoot,
        clientName: "Mushtaq Wedding",
        assignedCrew: customCrew,
      });

      expect(message).toContain("DRONE OPERATORS");
      expect(message).toContain("- Toufeeq Drone");
      expect(message).not.toContain("PHOTOGRAPHERS");
      expect(message).not.toContain("VIDEOGRAPHERS");
      expect(message).not.toContain("CINEMATOGRAPHERS");
      expect(message).not.toContain("OTHERS");
    });
  });

  describe("Requirement 3: Dynamic Updates & Deduplication", () => {
    it("deduplicates a member if assigned to multiple roles in the same event", () => {
      const multiRoleAssignments: Assignment[] = [
        {
          id: "asg-m1",
          shoot_id: "shoot-haldi",
          team_member_id: "crew-arfan",
          assignment_type: "on_site",
          created_at: new Date().toISOString(),
        },
        {
          id: "asg-m2",
          shoot_id: "shoot-haldi",
          team_member_id: "crew-arfan", // Arfan assigned twice (e.g. post production + on site)
          assignment_type: "post_production",
          created_at: new Date().toISOString(),
        },
      ];

      const crew = getEventAssignedCrew("shoot-haldi", multiRoleAssignments, mockTeam);
      expect(crew).toHaveLength(1);
      expect(crew[0].member.full_name).toBe("Arfan Khan");
    });

    it("immediately reflects crew reassignment/removal", () => {
      // Arfan removed, replaced by Vamsi
      const updatedAssignments: Assignment[] = [
        {
          id: "asg-h1-new",
          shoot_id: "shoot-haldi",
          team_member_id: "crew-vamsi",
          assignment_type: "on_site",
          created_at: new Date().toISOString(),
        },
      ];

      const updatedCrew = getEventAssignedCrew("shoot-haldi", updatedAssignments, mockTeam);
      const names = updatedCrew.map((c) => c.member.full_name);

      expect(names).toEqual(["Vamsi Krishna"]);
      expect(names).not.toContain("Arfan Khan");

      const message = generateEventWhatsAppDetails({
        shoot: haldiShoot,
        clientName: "Mushtaq Wedding",
        assignedCrew: updatedCrew,
      });

      expect(message).toContain("Vamsi Krishna");
      expect(message).not.toContain("Arfan Khan");
    });
  });
});

