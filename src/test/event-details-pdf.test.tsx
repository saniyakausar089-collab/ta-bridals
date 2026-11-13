import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventDetailsPdfModal,
  formatPdfOrdinalDate,
  formatPdfTime,
} from "../components/EventDetailsPdfModal";
import type { Tables } from "@/integrations/supabase/types";

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type Assignment = Tables<"shoot_assignments">;

describe("EventDetailsPdfModal & Formatting", () => {
  describe("Date & Time Helpers", () => {
    it("formats dates with ordinal day and uppercase month", () => {
      expect(formatPdfOrdinalDate("2022-04-14")).toBe("14th APR 2022");
      expect(formatPdfOrdinalDate("2026-11-01")).toBe("1st NOV 2026");
      expect(formatPdfOrdinalDate("2026-11-02")).toBe("2nd NOV 2026");
      expect(formatPdfOrdinalDate("2026-11-03")).toBe("3rd NOV 2026");
      expect(formatPdfOrdinalDate("2026-11-20")).toBe("20th NOV 2026");
      expect(formatPdfOrdinalDate(null)).toBe("DATE TBA");
    });

    it("formats 24-hr time strings to 12-hr AM/PM format", () => {
      expect(formatPdfTime("07:00:00")).toBe("7:00 AM");
      expect(formatPdfTime("19:30:00")).toBe("7:30 PM");
      expect(formatPdfTime("12:00:00")).toBe("12:00 PM");
      expect(formatPdfTime(null)).toBe("TIME TBA");
    });
  });

  describe("Event Details Flyer Modal Component", () => {
    const mockShoot: Shoot = {
      id: "shoot-101",
      couple_name: "Meghana + Praveen",
      event_type: "Groom Ceremony",
      event_date: "2022-04-14",
      start_time: "07:00:00",
      end_time: "11:00:00",
      venue: "Siddamsetty Towers",
      location: "Jawahar Nagar, RTC Cross road, New nallakunta, Hyderabad",
      planned_team_size: 3,
      notes: "[Client Contact: Mr. Praveen – 99597 44907]",
      status: "Upcoming",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockTeam: TeamMember[] = [
      {
        id: "m-1",
        full_name: "Arfan",
        role: "Lead Photographer",
        phone: "9246556478",
        available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: "arfan@example.com",
        notes: null,
      },
      {
        id: "m-2",
        full_name: "Vamsi",
        role: "Photographer",
        phone: "9849966635",
        available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: "vamsi@example.com",
        notes: null,
      },
      {
        id: "m-3",
        full_name: "Akram",
        role: "Videographer",
        phone: "9347636054",
        available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: "akram@example.com",
        notes: null,
      },
    ];

    const mockAssignments: Assignment[] = [
      {
        id: "a-1",
        shoot_id: "shoot-101",
        team_member_id: "m-1",
        assignment_type: "Photographer",
        created_at: new Date().toISOString(),
      },
      {
        id: "a-2",
        shoot_id: "shoot-101",
        team_member_id: "m-2",
        assignment_type: "Photographer",
        created_at: new Date().toISOString(),
      },
      {
        id: "a-3",
        shoot_id: "shoot-101",
        team_member_id: "m-3",
        assignment_type: "Videographer",
        created_at: new Date().toISOString(),
      },
    ];

    it("renders the event details flyer styled like the reference flyer", () => {
      render(
        <EventDetailsPdfModal
          shoot={mockShoot}
          projectName="Meghana + Praveen"
          assignments={mockAssignments}
          team={mockTeam}
          onClose={vi.fn()}
        />
      );

      // Top banner
      expect(screen.getByText("EVENT DETAILS")).toBeInTheDocument();
      expect(screen.getByText("TA BRIDALS")).toBeInTheDocument();

      // Client block
      expect(screen.getByText("* MEGHANA + PRAVEEN *")).toBeInTheDocument();
      expect(screen.getByText(/\* MR\. PRAVEEN – 99597 44907 \*/i)).toBeInTheDocument();

      // Event details
      expect(screen.getByText("* 14TH APR 2022 *")).toBeInTheDocument();
      expect(screen.getByText("* GROOM CEREMONY *")).toBeInTheDocument();
      expect(screen.getByText("* 7:00 AM *")).toBeInTheDocument();

      // Venue
      expect(screen.getByText("Siddamsetty Towers")).toBeInTheDocument();

      // Photographers & Videographers
      expect(screen.getByText("* PHOTOGRAPHERS *")).toBeInTheDocument();
      expect(screen.getByText(/Mr\. ARFAN/i)).toBeInTheDocument();
      expect(screen.getByText(/Mr\. VAMSI/i)).toBeInTheDocument();
      expect(screen.getByText("* VIDEOGRAPHER *")).toBeInTheDocument();
      expect(screen.getByText(/Mr\. AKRAM/i)).toBeInTheDocument();
    });

    it("allows editing client name and contact with live update on the flyer sheet", () => {
      render(
        <EventDetailsPdfModal
          shoot={mockShoot}
          projectName="Meghana + Praveen"
          assignments={mockAssignments}
          team={mockTeam}
          onClose={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/Client Name/i) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Aisha & Zaid" } });

      expect(screen.getByText("* AISHA & ZAID *")).toBeInTheDocument();
    });
  });
});
