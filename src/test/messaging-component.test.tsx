import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessagingView } from "@/components/MessagingView";
import type { Shoot, TeamMember, Assignment } from "@/lib/messagingUtils";

describe("MessagingView Component Full Story Verification", () => {
  const mockTeam: TeamMember[] = [
    {
      id: "member-1",
      full_name: "Rahul Sharma",
      phone: "9876543210",
      role: "Lead Photographer",
      available: true,
      email: "rahul@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "member-2",
      full_name: "Aakash Varma",
      phone: null, // intentionally missing phone
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
      phone: "+91 91234 56789",
      role: "Drone Pilot",
      available: true,
      email: "priya@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
  ];

  const mockShoots: Shoot[] = [
    {
      id: "shoot-1",
      couple_name: "Ayesha & Ahmed",
      "shoot name": "Ayesha & Ahmed",
      event_type: "Haldi",
      event_date: "2026-11-25",
      start_time: "10:00:00",
      end_time: "14:00:00",
      planned_team_size: 2,
      status: "Upcoming",
      location: "Hyderabad",
      venue: "Grand Palace",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "shoot-2",
      couple_name: "Ayesha & Ahmed",
      "shoot name": "Ayesha & Ahmed",
      event_type: "Reception",
      event_date: "2026-11-27",
      start_time: "19:00:00",
      end_time: "23:00:00",
      planned_team_size: 3,
      status: "Upcoming",
      location: "Hyderabad",
      venue: "ITC Kohenur",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "shoot-3",
      couple_name: "Fatima & Zaid",
      "shoot name": "Fatima & Zaid",
      event_type: "Nikah",
      event_date: "2026-12-05",
      start_time: "11:00:00",
      end_time: "16:00:00",
      planned_team_size: 2,
      status: "Upcoming",
      location: "Secunderabad",
      venue: "Imperial Hall",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
  ];

  const mockAssignments: Assignment[] = [
    // Rahul assigned to both Haldi and Reception for Ayesha & Ahmed
    {
      id: "asg-1",
      shoot_id: "shoot-1",
      team_member_id: "member-1",
      assignment_type: "Lead Photographer",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-2",
      shoot_id: "shoot-2",
      team_member_id: "member-1",
      assignment_type: "Lead Photographer",
      created_at: new Date().toISOString(),
    },
    // Aakash assigned to Reception for Ayesha & Ahmed (missing phone)
    {
      id: "asg-3",
      shoot_id: "shoot-2",
      team_member_id: "member-2",
      assignment_type: "Cinematographer",
      created_at: new Date().toISOString(),
    },
    // Priya assigned to Nikah for Fatima & Zaid
    {
      id: "asg-4",
      shoot_id: "shoot-3",
      team_member_id: "member-3",
      assignment_type: "Drone Pilot",
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    window.open = vi.fn();
  });

  it("renders messaging dashboard with real studio metrics", () => {
    render(
      <MessagingView
        shoots={mockShoots}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // 2 projects: Ayesha & Ahmed, Fatima & Zaid
    expect(screen.getByText("Total Projects")).toBeInTheDocument();
    expect(screen.getByText("Across All Shoots")).toBeInTheDocument();

    // Both projects appear in the list
    expect(screen.getByText("Ayesha & Ahmed")).toBeInTheDocument();
    expect(screen.getByText("Fatima & Zaid")).toBeInTheDocument();
  });

  it("filters projects accurately via search bar", () => {
    render(
      <MessagingView
        shoots={mockShoots}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search projects/i);
    fireEvent.change(searchInput, { target: { value: "Ayesha" } });

    expect(screen.getByText("Ayesha & Ahmed")).toBeInTheDocument();
    expect(screen.queryByText("Fatima & Zaid")).not.toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByText("Clear");
    fireEvent.click(clearBtn);
    expect(screen.getByText("Fatima & Zaid")).toBeInTheDocument();
  });

  it("opens project details and displays events and deduplicated crew", () => {
    render(
      <MessagingView
        shoots={mockShoots}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // Click "View Crew & Message" on Ayesha & Ahmed
    const viewButtons = screen.getAllByText(/View Crew & Message/i);
    fireEvent.click(viewButtons[0]);

    // Should drill into project
    expect(screen.getByText("Back to Projects")).toBeInTheDocument();

    // Events in project
    expect(screen.getByText("Project Events (2)")).toBeInTheDocument();
    expect(screen.getByText("Haldi")).toBeInTheDocument();
    expect(screen.getByText("Reception")).toBeInTheDocument();

    // Assigned crew: Rahul and Aakash
    expect(screen.getByText("Assigned Crew (2)")).toBeInTheDocument();
    expect(screen.getAllByText("Rahul Sharma").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aakash Varma").length).toBeGreaterThan(0);

    // Priya should NOT appear here because she is assigned to Fatima & Zaid
    expect(screen.queryByText("Priya Nair")).not.toBeInTheDocument();

    // Rahul's phone is valid; Aakash's phone is missing
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();
    expect(screen.getByText("Phone number is missing")).toBeInTheDocument();

    // Eligible recipient count for Message All Crew should be 1 (only Rahul)
    expect(screen.getAllByText(/Message All Crew \(1\)/i).length).toBeGreaterThan(0);
  });

  it("opens individual message modal, allows editing, and generates correct wa.me link", () => {
    render(
      <MessagingView
        shoots={mockShoots}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // Open project
    fireEvent.click(screen.getAllByText(/View Crew & Message/i)[0]);

    // Rahul Sharma is eligible (Aakash Varma is index 0 but disabled because phone is missing)
    // Find the enabled "Message WhatsApp" button
    const messageBtns = screen.getAllByRole("button", { name: /Message WhatsApp/i });
    const rahulBtn = messageBtns.find((b) => !b.hasAttribute("disabled"));
    expect(rahulBtn).toBeDefined();
    fireEvent.click(rahulBtn!);

    // Modal opens
    expect(screen.getByText("WhatsApp Dispatch Preview")).toBeInTheDocument();
    expect(screen.getByText("Message Rahul Sharma")).toBeInTheDocument();

    // Check textarea has personalized message
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("Hi Rahul! 👋");
    expect(textarea.value).toContain("Ayesha & Ahmed");

    // User edits message
    fireEvent.change(textarea, { target: { value: "Custom shoot instruction for Rahul" } });
    expect(textarea).toHaveValue("Custom shoot instruction for Rahul");

    // Click "Open WhatsApp"
    const openWaBtn = screen.getByRole("button", { name: /Open WhatsApp/i });
    fireEvent.click(openWaBtn);

    expect(window.open).toHaveBeenCalledWith(
      "https://wa.me/919876543210?text=Custom%20shoot%20instruction%20for%20Rahul",
      "_blank",
      "noopener,noreferrer"
    );

    // Session status updated to "WhatsApp opened"
    expect(screen.getAllByText(/WhatsApp opened/i).length).toBeGreaterThan(0);
  });

  it("runs Message All Crew sequential stepper 1-by-1 with Skip and Next Crew Member", () => {
    // Add valid phone to Priya and assign her to Ayesha & Ahmed as well to have 2 eligible recipients
    const updatedAssignments: Assignment[] = [
      ...mockAssignments,
      {
        id: "asg-5",
        shoot_id: "shoot-1",
        team_member_id: "member-3",
        assignment_type: "Drone Pilot",
        created_at: new Date().toISOString(),
      },
    ];

    render(
      <MessagingView
        shoots={mockShoots}
        team={mockTeam}
        assignments={updatedAssignments}
      />
    );

    // Open project
    fireEvent.click(screen.getAllByText(/View Crew & Message/i)[0]);

    // Now 2 eligible recipients (Rahul and Priya)
    const messageAllBtns = screen.getAllByRole("button", { name: /Message All Crew \(2\)/i });
    fireEvent.click(messageAllBtns[0]);

    // Step 1: Confirmation
    expect(screen.getByText("Batch Message Sequence")).toBeInTheDocument();
    expect(screen.getByText(/Message All Crew \(2 Eligible\)/i)).toBeInTheDocument();

    // Start Sequence
    fireEvent.click(screen.getByRole("button", { name: /Start Sequence/i }));

    // Step 2: Member 1 (Priya Nair, sorted alphabetically)
    expect(screen.getByText("Crew Member 1 of 2")).toBeInTheDocument();
    expect(screen.getAllByText("Priya Nair").length).toBeGreaterThan(0);

    // Skip Priya
    const skipBtn = screen.getByRole("button", { name: /Skip/i });
    fireEvent.click(skipBtn);

    // Member 2 (Rahul Sharma)
    expect(screen.getByText("Crew Member 2 of 2")).toBeInTheDocument();
    expect(screen.getAllByText("Rahul Sharma").length).toBeGreaterThan(0);

    // Open WhatsApp for Rahul
    const openBtn = screen.getByRole("button", { name: /Open WhatsApp/i });
    fireEvent.click(openBtn);

    expect(window.open).toHaveBeenCalled();

    // Finish
    const finishBtn = screen.getByRole("button", { name: /Finish/i });
    fireEvent.click(finishBtn);

    // Step 3: Batch Walkthrough Complete
    expect(screen.getByText("Batch Walkthrough Complete")).toBeInTheDocument();

    // Return to project
    fireEvent.click(screen.getByRole("button", { name: /Done & Return to Project/i }));

    // Back in project details, check session statuses
    expect(screen.getAllByText(/Skipped/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WhatsApp opened/i).length).toBeGreaterThan(0);
  });
});
