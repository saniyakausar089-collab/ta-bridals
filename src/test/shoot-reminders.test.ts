import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateEventStartTimestamp,
  isWithin24HourReminderWindow,
  generateShootReminderMessage,
  getEligibleShootReminders,
  updateCrewMemberReminderStatus,
  saveEventReminderStatus,
  getStoredReminderStatuses,
  type Shoot,
  type TeamMember,
  type Assignment,
} from "../lib/shootReminders";

describe("24-Hour Shoot Reminder System", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("Asia/Kolkata Timezone & 24-Hour Calculation", () => {
    it("correctly parses event date and start time with Asia/Kolkata (+05:30) offset", () => {
      // 2026-11-10 10:00:00 IST is 2026-11-10 04:30:00 UTC
      const ts = calculateEventStartTimestamp("2026-11-10", "10:00:00");
      expect(ts).not.toBeNull();
      const date = new Date(ts!);
      expect(date.toISOString()).toBe("2026-11-10T04:30:00.000Z");
    });

    it("normalizes short time formats like '9:00' to '09:00:00'", () => {
      const ts = calculateEventStartTimestamp("2026-11-10", "9:00");
      expect(ts).not.toBeNull();
      const date = new Date(ts!);
      expect(date.toISOString()).toBe("2026-11-10T03:30:00.000Z");
    });

    it("detects an event starting in 12 hours as within the 24-hour window", () => {
      // Reference 'now': 2026-11-09T20:00:00+05:30
      const now = Date.parse("2026-11-09T20:00:00+05:30");
      // Event: 2026-11-10T08:00:00+05:30 (12 hours ahead)
      const withinWindow = isWithin24HourReminderWindow("2026-11-10", "08:00:00", now);
      expect(withinWindow).toBe(true);
    });

    it("detects an event starting in 23.5 hours as within the 24-hour window", () => {
      const now = Date.parse("2026-11-09T10:00:00+05:30");
      // Event in 23.5 hours: 2026-11-10T09:30:00+05:30
      const withinWindow = isWithin24HourReminderWindow("2026-11-10", "09:30:00", now);
      expect(withinWindow).toBe(true);
    });

    it("excludes events starting in 25 hours (outside the 24-hour window)", () => {
      const now = Date.parse("2026-11-09T10:00:00+05:30");
      // Event in 25 hours: 2026-11-10T11:00:00+05:30
      const withinWindow = isWithin24HourReminderWindow("2026-11-10", "11:00:00", now);
      expect(withinWindow).toBe(false);
    });

    it("excludes past events (start time already passed)", () => {
      const now = Date.parse("2026-11-09T15:00:00+05:30");
      // Event was at 10:00 AM same day (5 hours ago)
      const withinWindow = isWithin24HourReminderWindow("2026-11-09", "10:00:00", now);
      expect(withinWindow).toBe(false);
    });
  });

  describe("Personalized WhatsApp Message Template", () => {
    it("generates the exact required WhatsApp reminder message format", () => {
      const message = generateShootReminderMessage({
        crewName: "Arjun Verma",
        projectName: "Sneha & Rahul Wedding",
        eventName: "Muhurtham & Reception",
        dateFormatted: "10 Nov 2026",
        timeFormatted: "06:30 AM",
        locationFormatted: "Leela Palace, Chennai",
      });

      const expected = [
        "Hi Arjun Verma! 👋",
        "",
        "Reminder: You have an upcoming shoot tomorrow.",
        "",
        "Project: Sneha & Rahul Wedding",
        "Event: Muhurtham & Reception",
        "Date: 10 Nov 2026",
        "Time: 06:30 AM",
        "Location: Leela Palace, Chennai",
        "",
        "Please be available on time.",
        "",
        "– TA Bridals",
      ].join("\n");

      expect(message).toBe(expected);
    });
  });

  describe("Eligible Shoot Reminders Filtering & Crew Mapping", () => {
    const mockTeam: TeamMember[] = [
      {
        id: "worker-1",
        full_name: "Kavita Pillai",
        phone: "9876543210",
        role: "Lead Photographer",
        available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: "kavita@example.com",
        notes: null,
      },
      {
        id: "worker-2",
        full_name: "Manoj Kumar",
        phone: "+91 9123456789",
        role: "Cinematographer",
        available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: "manoj@example.com",
        notes: null,
      },
    ];

    const mockShoots: Shoot[] = [
      {
        id: "shoot-1",
        couple_name: "Pooja & Vicky",
        "shoot name": "Pooja & Vicky",
        event_type: "Sangeet",
        event_date: "2026-11-10",
        start_time: "18:00:00",
        end_time: "23:00:00",
        location: "Bengaluru",
        venue: "Taj West End",
        planned_team_size: 2,
        status: "Upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        notes: null,
        package_amount: 150000,
      },
      {
        id: "shoot-cancelled",
        couple_name: "Divya & Karan",
        "shoot name": "Divya & Karan",
        event_type: "Engagement",
        event_date: "2026-11-10",
        start_time: "10:00:00",
        end_time: null,
        location: "Chennai",
        venue: null,
        planned_team_size: 1,
        status: "Cancelled",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        notes: null,
        package_amount: null,
      },
      {
        id: "shoot-far-future",
        couple_name: "Anita & Rohan",
        "shoot name": "Anita & Rohan",
        event_type: "Wedding",
        event_date: "2026-11-20",
        start_time: "09:00:00",
        end_time: null,
        location: "Hyderabad",
        venue: null,
        planned_team_size: 2,
        status: "Upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        notes: null,
        package_amount: null,
      },
    ];

    const mockAssignments: Assignment[] = [
      {
        id: "assign-1",
        shoot_id: "shoot-1",
        team_member_id: "worker-1",
        assignment_type: "Lead Photographer",
        created_at: new Date().toISOString(),
      },
      {
        id: "assign-2",
        shoot_id: "shoot-1",
        team_member_id: "worker-2",
        assignment_type: "Cinematographer",
        created_at: new Date().toISOString(),
      },
    ];

    it("generates reminder for event within 24 hours, excluding cancelled and far future events", () => {
      // Now is 2026-11-09T22:00:00+05:30 (event is in 20 hours)
      const now = Date.parse("2026-11-09T22:00:00+05:30");
      const reminders = getEligibleShootReminders(mockShoots, mockAssignments, mockTeam, now);

      expect(reminders).toHaveLength(1);
      const reminder = reminders[0]!;
      expect(reminder.eventId).toBe("shoot-1");
      expect(reminder.projectName).toBe("Pooja & Vicky");
      expect(reminder.eventName).toBe("Sangeet");
      expect(reminder.assignedCrew).toHaveLength(2);
      expect(reminder.assignedCrew.map((c) => c.fullName)).toEqual([
        "Kavita Pillai",
        "Manoj Kumar",
      ]);
      expect(reminder.status).toBe("pending");
      expect(reminder.isPending).toBe(true);
    });

    it("generates valid wa.me URLs for assigned crew using their registered phone numbers", () => {
      const now = Date.parse("2026-11-09T22:00:00+05:30");
      const reminders = getEligibleShootReminders(mockShoots, mockAssignments, mockTeam, now);
      const crew1 = reminders[0]!.assignedCrew[0]!; // Kavita Pillai
      expect(crew1.phoneInfo.isValid).toBe(true);
      expect(crew1.phoneInfo.waDigits).toBe("919876543210");
      expect(crew1.whatsAppUrl).toContain("https://wa.me/919876543210?text=");
      expect(crew1.whatsAppUrl).toContain(encodeURIComponent("Hi Kavita Pillai! 👋"));
      expect(crew1.whatsAppUrl).toContain(encodeURIComponent("– TA Bridals"));
    });

    it("prevents duplicate alerts even if the same shoot appears more than once in input", () => {
      const duplicatedShoots = [...mockShoots, mockShoots[0]!];
      const now = Date.parse("2026-11-09T22:00:00+05:30");
      const reminders = getEligibleShootReminders(duplicatedShoots, mockAssignments, mockTeam, now);
      expect(reminders).toHaveLength(1);
    });
  });

  describe("Alert Status Progression: Pending -> WhatsApp Opened -> Marked as Sent", () => {
    it("opening WhatsApp marks status as 'whatsapp_opened', NOT 'marked_as_sent'", () => {
      saveEventReminderStatus("shoot-1", "2026-11-10_18:00:00", "pending");
      const res = updateCrewMemberReminderStatus(
        "shoot-1",
        "2026-11-10_18:00:00",
        "worker-1",
        "whatsapp_opened",
      );
      expect(res.newEventStatus).toBe("whatsapp_opened");

      const store = getStoredReminderStatuses();
      expect(store["shoot-1"]!.status).toBe("whatsapp_opened");
      expect(store["shoot-1"]!.crewStatuses["worker-1"]).toBe("whatsapp_opened");
      // Never claimed as sent
      expect(store["shoot-1"]!.status).not.toBe("marked_as_sent");
    });

    it("manual confirmation is required to transition to 'marked_as_sent'", () => {
      const allMembers = ["worker-1", "worker-2"];
      // Worker 1 marked as sent
      const res1 = updateCrewMemberReminderStatus(
        "shoot-1",
        "2026-11-10_18:00:00",
        "worker-1",
        "marked_as_sent",
        allMembers,
      );
      expect(res1.newEventStatus).toBe("whatsapp_opened"); // Worker 2 still pending

      // Worker 2 marked as sent
      const res2 = updateCrewMemberReminderStatus(
        "shoot-1",
        "2026-11-10_18:00:00",
        "worker-2",
        "marked_as_sent",
        allMembers,
      );
      expect(res2.newEventStatus).toBe("marked_as_sent"); // All sent!
    });

    it("rescheduling an event resets previous status to pending", () => {
      // Event was marked as sent for old date
      saveEventReminderStatus("shoot-1", "2026-11-10_18:00:00", "marked_as_sent", {
        "worker-1": "marked_as_sent",
        "worker-2": "marked_as_sent",
      });

      // Shoot is now rescheduled to 2026-11-11 18:00:00
      const rescheduledShoot: Shoot = {
        id: "shoot-1",
        couple_name: "Pooja & Vicky",
        "shoot name": "Pooja & Vicky",
        event_type: "Sangeet",
        event_date: "2026-11-11", // Changed date
        start_time: "18:00:00",
        end_time: null,
        location: "Bengaluru",
        venue: "Taj West End",
        planned_team_size: 2,
        status: "Upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        notes: null,
        package_amount: 150000,
      };

      const mockAssignments: Assignment[] = [
        {
          id: "assign-1",
          shoot_id: "shoot-1",
          team_member_id: "worker-1",
          assignment_type: "Lead Photographer",
          created_at: new Date().toISOString(),
        },
      ];

      const mockTeam: TeamMember[] = [
        {
          id: "worker-1",
          full_name: "Kavita Pillai",
          phone: "9876543210",
          role: "Lead Photographer",
          available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email: "kavita@example.com",
          notes: null,
        },
      ];

      // Now is 2026-11-10T20:00:00+05:30 (rescheduled event is in 22 hours)
      const now = Date.parse("2026-11-10T20:00:00+05:30");
      const reminders = getEligibleShootReminders(
        [rescheduledShoot],
        mockAssignments,
        mockTeam,
        now,
      );

      expect(reminders).toHaveLength(1);
      // Status must be reset to pending because schedule changed
      expect(reminders[0]!.status).toBe("pending");
      expect(reminders[0]!.isPending).toBe(true);
    });
  });
});
