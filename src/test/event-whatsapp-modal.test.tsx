import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventWhatsAppModal } from "@/components/EventWhatsAppModal";
import type { Shoot, TeamMember, Assignment } from "@/lib/messagingUtils";

describe("EventWhatsAppModal Component", () => {
  const mockShoot: Shoot = {
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
    notes: "[Client Contact: 9988776655]",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "admin",
  };

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
      id: "crew-invalid",
      full_name: "NoPhone Member",
      role: "Drone Operator",
      phone: null, // missing phone
      email: "nophone@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "crew-other",
      full_name: "Other Event Crew",
      role: "Photographer",
      phone: "9876543299",
      email: "other@tabridals.com",
      available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
  ];

  const mockAssignments: Assignment[] = [
    {
      id: "asg-1",
      shoot_id: "shoot-haldi",
      team_member_id: "crew-arfan",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-2",
      shoot_id: "shoot-haldi",
      team_member_id: "crew-akram",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-3",
      shoot_id: "shoot-haldi",
      team_member_id: "crew-invalid",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
    // Another event assignment (should NOT appear in Haldi modal)
    {
      id: "asg-other",
      shoot_id: "shoot-reception",
      team_member_id: "crew-other",
      assignment_type: "on_site",
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
  });

  it("renders modal with event details, client name, and only assigned crew members", () => {
    render(
      <EventWhatsAppModal
        shoot={mockShoot}
        projectName="Mushtaq Wedding"
        assignments={mockAssignments}
        team={mockTeam}
        onClose={vi.fn()}
      />
    );

    // Event Title & Project
    expect(screen.getByText(/Mushtaq Wedding · Haldi/i)).toBeInTheDocument();
    expect(screen.getByText("Taj Krishna")).toBeInTheDocument();

    // Assigned crew members
    expect(screen.getByText("Arfan Khan")).toBeInTheDocument();
    expect(screen.getByText("Akram Syed")).toBeInTheDocument();
    expect(screen.getByText("NoPhone Member")).toBeInTheDocument();

    // Crew from other events MUST NOT be displayed
    expect(screen.queryByText("Other Event Crew")).not.toBeInTheDocument();
  });

  it("allows editing the message preview text directly", () => {
    render(
      <EventWhatsAppModal
        shoot={mockShoot}
        projectName="Mushtaq Wedding"
        assignments={mockAssignments}
        team={mockTeam}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/Event details message preview/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("TA BRIDALS – EVENT DETAILS");
    expect(textarea.value).toContain("Haldi");

    fireEvent.change(textarea, { target: { value: "Custom Event Message for Team" } });
    expect(textarea.value).toBe("Custom Event Message for Team");
  });

  it("updates contact number and dynamically updates template", () => {
    render(
      <EventWhatsAppModal
        shoot={mockShoot}
        projectName="Mushtaq Wedding"
        assignments={mockAssignments}
        team={mockTeam}
        onClose={vi.fn()}
      />
    );

    const contactInput = screen.getByLabelText(/Client Contact Number/i) as HTMLInputElement;
    fireEvent.change(contactInput, { target: { value: "+91 91234 56789" } });

    const textarea = screen.getByLabelText(/Event details message preview/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("CONTACT NUMBER: +91 91234 56789");
  });

  it("dispatches single crew member and advances delivery status to WhatsApp Opened", () => {
    render(
      <EventWhatsAppModal
        shoot={mockShoot}
        projectName="Mushtaq Wedding"
        assignments={mockAssignments}
        team={mockTeam}
        onClose={vi.fn()}
      />
    );

    const sendBtns = screen.getAllByRole("button", { name: /Send WhatsApp/i });
    expect(sendBtns.length).toBeGreaterThan(0);

    // Click send for Arfan Khan
    fireEvent.click(sendBtns[0]);

    // Status badge should update
    expect(screen.getByText(/WhatsApp Opened/i)).toBeInTheDocument();
  });

  it("flags crew with missing phone number as Cannot send", () => {
    render(
      <EventWhatsAppModal
        shoot={mockShoot}
        projectName="Mushtaq Wedding"
        assignments={mockAssignments}
        team={mockTeam}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Missing \/ Invalid Phone/i)).toBeInTheDocument();
    expect(screen.getByText(/Cannot send/i)).toBeInTheDocument();
  });
});

