import { describe, expect, it } from "vitest";
import {
  normalizeWhatsAppPhone,
  buildWhatsAppClickToChatUrl,
  deriveMessagingProjects,
  generatePersonalizedMessage,
  formatShootDate,
  formatShootTime,
  type Shoot,
  type TeamMember,
  type Assignment,
} from "@/lib/messagingUtils";

describe("Messaging Module Utilities", () => {
  describe("Phone Number Normalization for WhatsApp", () => {
    it("normalizes a standard 10-digit Indian mobile number", () => {
      const res = normalizeWhatsAppPhone("9876543210");
      expect(res.isValid).toBe(true);
      expect(res.waDigits).toBe("919876543210");
      expect(res.displayFormatted).toBe("+91 98765 43210");
    });

    it("normalizes an Indian number with +91 country code and spaces", () => {
      const res = normalizeWhatsAppPhone("+91 98765 43210");
      expect(res.isValid).toBe(true);
      expect(res.waDigits).toBe("919876543210");
      expect(res.displayFormatted).toBe("+91 98765 43210");
    });

    it("normalizes an Indian number with 91 prefix without plus", () => {
      const res = normalizeWhatsAppPhone("919876543210");
      expect(res.isValid).toBe(true);
      expect(res.waDigits).toBe("919876543210");
    });

    it("normalizes an Indian number with trunk zero (e.g. 09876543210)", () => {
      const res = normalizeWhatsAppPhone("09876543210");
      expect(res.isValid).toBe(true);
      expect(res.waDigits).toBe("919876543210");
    });

    it("handles international numbers starting with +", () => {
      const res = normalizeWhatsAppPhone("+1 415 555 2671");
      expect(res.isValid).toBe(true);
      expect(res.waDigits).toBe("14155552671");
    });

    it("rejects empty or null phone numbers gracefully without crashing", () => {
      expect(normalizeWhatsAppPhone(null).isValid).toBe(false);
      expect(normalizeWhatsAppPhone("").isValid).toBe(false);
      expect(normalizeWhatsAppPhone("   ").isValid).toBe(false);
    });

    it("rejects invalid inputs like letters, emails, or short numbers", () => {
      expect(normalizeWhatsAppPhone("rahul@example.com").isValid).toBe(false);
      expect(normalizeWhatsAppPhone("12345").isValid).toBe(false);
      expect(normalizeWhatsAppPhone("98765abcde").isValid).toBe(false);
    });
  });

  describe("WhatsApp Click to Chat URL Construction", () => {
    it("generates correct official click-to-chat URL with properly encoded message", () => {
      const url = buildWhatsAppClickToChatUrl("919876543210", "Hi Rahul! You have been assigned.");
      expect(url).toBe(
        "https://wa.me/919876543210?text=Hi%20Rahul!%20You%20have%20been%20assigned."
      );
    });
  });

  describe("Deriving Projects & Deduplicating Crew Assignments", () => {
    const mockTeam: TeamMember[] = [
      {
        id: "member-1",
        full_name: "Rahul Sharma",
        phone: "9876543210",
        role: "Photographer",
        available: true,
        email: "rahul@tabridals.com",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
      },
      {
        id: "member-2",
        full_name: "Aakash Varma",
        phone: null, // missing phone
        role: "Cinematographer",
        available: true,
        email: "aakash@tabridals.com",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
      },
      {
        id: "member-3",
        full_name: "Priya Nair",
        phone: "9876512345",
        role: "Drone Operator",
        available: true,
        email: "priya@tabridals.com",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
      },
    ];

    const mockShoots: Shoot[] = [
      {
        id: "shoot-101",
        couple_name: "Fatima & Zaid",
        "shoot name": "Fatima & Zaid",
        event_type: "Haldi",
        event_date: "2026-11-20",
        start_time: "10:00:00",
        end_time: "14:00:00",
        planned_team_size: 2,
        status: "Upcoming",
        location: "Hyderabad",
        venue: "Taj Krishna",
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "admin",
      },
      {
        id: "shoot-102",
        couple_name: "Fatima & Zaid",
        "shoot name": "Fatima & Zaid",
        event_type: "Nikah",
        event_date: "2026-11-21",
        start_time: "11:00:00",
        end_time: "16:00:00",
        planned_team_size: 3,
        status: "Upcoming",
        location: "Hyderabad",
        venue: "Park Hyatt",
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "admin",
      },
    ];

    const mockAssignments: Assignment[] = [
      // Rahul assigned to both Haldi and Nikah
      {
        id: "asg-1",
        shoot_id: "shoot-101",
        team_member_id: "member-1",
        assignment_type: "Lead Photographer",
        created_at: new Date().toISOString(),
      },
      {
        id: "asg-2",
        shoot_id: "shoot-102",
        team_member_id: "member-1",
        assignment_type: "Lead Photographer",
        created_at: new Date().toISOString(),
      },
      // Aakash assigned to Nikah (has no phone)
      {
        id: "asg-3",
        shoot_id: "shoot-102",
        team_member_id: "member-2",
        assignment_type: "Cinematographer",
        created_at: new Date().toISOString(),
      },
    ];

    it("groups shoots into projects and deduplicates crew assigned to multiple events", () => {
      const projects = deriveMessagingProjects(mockShoots, mockAssignments, mockTeam);
      expect(projects).toHaveLength(1);
      const project = projects[0];
      expect(project.name).toBe("Fatima & Zaid");
      expect(project.events).toHaveLength(2);

      // Only 2 unique crew members assigned (Rahul and Aakash), not 3
      expect(project.assignedCrew).toHaveLength(2);

      // Rahul should have 2 assigned events
      const rahul = project.assignedCrew.find((c) => c.member.id === "member-1");
      expect(rahul).toBeDefined();
      expect(rahul?.assignedEvents).toHaveLength(2);
      expect(rahul?.phoneInfo.isValid).toBe(true);

      // Aakash has invalid/missing phone
      const aakash = project.assignedCrew.find((c) => c.member.id === "member-2");
      expect(aakash).toBeDefined();
      expect(aakash?.phoneInfo.isValid).toBe(false);

      // Eligible recipient count should be 1 (only Rahul has valid phone)
      expect(project.eligibleRecipientCount).toBe(1);
    });

    it("does not include crew members from unrelated projects", () => {
      // Priya is not assigned to any shoot
      const projects = deriveMessagingProjects(mockShoots, mockAssignments, mockTeam);
      const project = projects[0];
      const priya = project.assignedCrew.find((c) => c.member.id === "member-3");
      expect(priya).toBeUndefined();
    });

    it("reflects updated assignment data automatically when assignments change", () => {
      // Add Priya to Haldi
      const updatedAssignments: Assignment[] = [
        ...mockAssignments,
        {
          id: "asg-4",
          shoot_id: "shoot-101",
          team_member_id: "member-3",
          assignment_type: "Drone Operator",
          created_at: new Date().toISOString(),
        },
      ];

      const projects = deriveMessagingProjects(mockShoots, updatedAssignments, mockTeam);
      const project = projects[0];
      expect(project.assignedCrew).toHaveLength(3);
      expect(project.eligibleRecipientCount).toBe(2); // Rahul and Priya
    });
  });

  describe("Message Template Generation", () => {
    it("generates personalized single-event message", () => {
      const msg = generatePersonalizedMessage({
        crewName: "Rahul Sharma",
        projectName: "Fatima & Zaid",
        roles: ["Photographer"],
        assignedEvents: [
          {
            event: {
              id: "s1",
              couple_name: "Fatima & Zaid",
              event_type: "Haldi",
              event_date: "2026-11-20",
              start_time: "10:00:00",
              end_time: "14:00:00",
              venue: "Taj Krishna",
            } as Shoot,
            role: "Photographer",
          },
        ],
      });

      expect(msg).toContain("Hi Rahul! 👋");
      expect(msg).toContain("You have been assigned to the Fatima & Zaid project by TA Bridals.");
      expect(msg).toContain("Role: Photographer");
      expect(msg).toContain("Event: Haldi");
      expect(msg).toContain("Shoot Date: 20 Nov 2026");
      expect(msg).toContain("Shoot Time: 10:00 AM");
      expect(msg).toContain("Venue: Taj Krishna");
    });

    it("generates personalized multi-event message for crew assigned to multiple events", () => {
      const msg = generatePersonalizedMessage({
        crewName: "Rahul Sharma",
        projectName: "Fatima & Zaid",
        roles: ["Lead Photographer"],
        assignedEvents: [
          {
            event: {
              id: "s1",
              couple_name: "Fatima & Zaid",
              event_type: "Haldi",
              event_date: "2026-11-20",
              start_time: "10:00:00",
              venue: "Taj Krishna",
            } as Shoot,
            role: "Lead Photographer",
          },
          {
            event: {
              id: "s2",
              couple_name: "Fatima & Zaid",
              event_type: "Nikah",
              event_date: "2026-11-21",
              start_time: "11:00:00",
              venue: "Park Hyatt",
            } as Shoot,
            role: "Lead Photographer",
          },
        ],
      });

      expect(msg).toContain("Hi Rahul! 👋");
      expect(msg).toContain("Assigned Events:");
      expect(msg).toContain("Haldi - 20 Nov 2026, 10:00 AM (Taj Krishna)");
      expect(msg).toContain("Nikah - 21 Nov 2026, 11:00 AM (Park Hyatt)");
    });
  });

  describe("Formatting Helpers", () => {
    it("formats 24-hr time correctly", () => {
      expect(formatShootTime("10:00:00")).toBe("10:00 AM");
      expect(formatShootTime("18:30:00")).toBe("6:30 PM");
      expect(formatShootTime("00:15:00")).toBe("12:15 AM");
      expect(formatShootTime(null)).toBe("Time TBA");
    });

    it("formats shoot dates correctly", () => {
      expect(formatShootDate("2026-11-20")).toBe("20 Nov 2026");
      expect(formatShootDate("2026-05-04")).toBe("4 May 2026");
    });
  });
});
