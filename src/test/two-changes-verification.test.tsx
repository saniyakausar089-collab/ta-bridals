import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MessagingView } from "@/components/MessagingView";
import { CalendarView } from "@/routes/index";
import type { Shoot, TeamMember, Assignment } from "@/lib/messagingUtils";

describe("Change 1: Edit Option to Draft Messages Verification", () => {
  const mockTeam: TeamMember[] = [
    {
      id: "member-1",
      full_name: "Rahul Sharma",
      phone: "+91 98765 43210",
      role: "Lead Photographer",
      available: true,
      email: "rahul@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "member-2",
      full_name: "Aman Gupta",
      phone: "9123456780",
      role: "Cinematographer",
      available: true,
      email: "aman@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
  ];

  const mockShoots: Shoot[] = [
    {
      id: "shoot-1",
      couple_name: "Zara & Farhan",
      "shoot name": "Zara & Farhan",
      event_type: "Sangeet",
      event_date: "2026-11-20",
      start_time: "18:00:00",
      end_time: "22:00:00",
      planned_team_size: 2,
      status: "Upcoming",
      location: "Banjara Hills, Hyderabad",
      venue: "Taj Krishna",
      notes: "Stage lighting setup required early",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
  ];

  const mockAssignments: Assignment[] = [
    {
      id: "asg-1",
      shoot_id: "shoot-1",
      team_member_id: "member-1",
      assignment_type: "Lead Photographer",
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("displays draft preview initially, then allows editing complete message directly", () => {
    render(
      <MessagingView
        shoots={mockShoots}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // Open project drilldown
    fireEvent.click(screen.getByRole("button", { name: /View Crew & Message/i }));

    // Click Message WhatsApp on Rahul
    const messageBtn = screen.getByRole("button", { name: /Message WhatsApp/i });
    fireEvent.click(messageBtn);

    // Modal opens
    expect(screen.getByText("WhatsApp Dispatch Preview")).toBeInTheDocument();
    expect(screen.getByText("Message Rahul Sharma")).toBeInTheDocument();

    // Draft Preview is visible with generated event details
    const preview = screen.getByTestId("draft-preview");
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toContain("Hi Rahul! 👋");
    expect(preview.textContent).toContain("Zara & Farhan");
    expect(preview.textContent).toContain("Sangeet");
    expect(preview.textContent).toContain("Taj Krishna");

    // Edit Draft button is clearly visible near generated draft
    const editBtn = screen.getByRole("button", { name: /Edit Draft/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    // Editable text area containing the complete generated message is now displayed
    const textarea = screen.getByRole("textbox", { name: /Editable draft message text/i }) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain("Hi Rahul! 👋");

    // Modify names, event details, timings, venues, and custom instructions
    const customMessage =
      "Hi Rahul! Updated timings: Please arrive at Taj Krishna at 5:00 PM for sound check before the Sangeet starts.";
    fireEvent.change(textarea, { target: { value: customMessage } });
    expect(textarea.value).toBe(customMessage);

    // Cancel option works: reverts changes
    const cancelBtn = screen.getByRole("button", { name: /Cancel edit/i });
    fireEvent.click(cancelBtn);

    // Preview still displays original message
    expect(screen.getByTestId("draft-preview").textContent).toContain("Hi Rahul! 👋");
    expect(screen.getByTestId("draft-preview").textContent).not.toContain("Updated timings");

    // Click Edit Draft again, edit, and click Save Changes
    fireEvent.click(screen.getByRole("button", { name: /Edit Draft/i }));
    const textarea2 = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea2, { target: { value: customMessage } });

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // After saving, preview displays updated message
    expect(screen.getByTestId("draft-preview").textContent).toBe(customMessage);

    // Copy Message copies the edited draft
    const copyBtn = screen.getByRole("button", { name: /Copy draft message/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(customMessage);

    // Sending WhatsApp uses the edited draft
    const openWaBtn = screen.getByRole("button", { name: /Open WhatsApp/i });
    fireEvent.click(openWaBtn);

    expect(window.open).toHaveBeenCalledWith(
      `https://wa.me/919876543210?text=${encodeURIComponent(customMessage)}`,
      "_blank",
      "noopener,noreferrer"
    );

    // Original shoot, event, or crew records are not modified
    expect(mockShoots[0].couple_name).toBe("Zara & Farhan");
    expect(mockShoots[0].venue).toBe("Taj Krishna");
    expect(mockTeam[0].full_name).toBe("Rahul Sharma");
  });
});

describe("Change 2: Calendar - Display All Events for Each Date Verification", () => {
  const mockTeam: TeamMember[] = [
    {
      id: "team-1",
      full_name: "Karan Johar",
      role: "Lead Photographer",
      phone: "+91 99999 11111",
      available: true,
      email: "karan@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "team-2",
      full_name: "Sameer Verma",
      role: "Cinematographer",
      phone: "+91 99999 22222",
      available: true,
      email: "sameer@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
    {
      id: "team-3",
      full_name: "Sneha Reddy",
      role: "Drone Operator",
      phone: "+91 99999 33333",
      available: true,
      email: "sneha@tabridals.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    },
  ];

  // 3 events on 2026-11-25 (More than 2 events to test "+1 more" and revealing ALL events)
  // 1 event on 2026-11-26
  // 2 events on 2026-11-27
  // 0 events on other days (e.g. 2026-11-28)
  const mockShoots: Shoot[] = [
    {
      id: "event-1",
      couple_name: "Pooja & Rohan",
      "shoot name": "Pooja & Rohan",
      event_type: "Haldi",
      event_date: "2026-11-25",
      start_time: "09:00:00",
      end_time: "12:00:00",
      planned_team_size: 2,
      status: "Upcoming",
      location: "Jubilee Hills, Hyderabad",
      venue: "Royal Manor",
      notes: "Yellow color theme dress code",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "event-2",
      couple_name: "Ananya & Kabir",
      "shoot name": "Ananya & Kabir",
      event_type: "Nikah",
      event_date: "2026-11-25",
      start_time: "14:00:00",
      end_time: "18:00:00",
      planned_team_size: 2,
      status: "In Progress",
      location: "Secunderabad",
      venue: "Grand Crystal Hall",
      notes: "Traditional setup",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "event-3",
      couple_name: "Sana & Imran",
      "shoot name": "Sana & Imran",
      event_type: "Reception",
      event_date: "2026-11-25",
      start_time: "19:30:00",
      end_time: "23:30:00",
      planned_team_size: 3,
      status: "Upcoming",
      location: "Gachibowli, Hyderabad",
      venue: "ITC Kohenur",
      notes: "VIP reception",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    // Date with 1 event: 2026-11-26
    {
      id: "event-4",
      couple_name: "Meera & Arjun",
      "shoot name": "Meera & Arjun",
      event_type: "Mehendi",
      event_date: "2026-11-26",
      start_time: "15:00:00",
      end_time: "19:00:00",
      planned_team_size: 1,
      status: "Upcoming",
      location: "Madhapur, Hyderabad",
      venue: "Green Meadows Resort",
      notes: "Outdoor lawn",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    // Date with 2 events: 2026-11-27
    {
      id: "event-5",
      couple_name: "Deepa & Vikram",
      "shoot name": "Deepa & Vikram",
      event_type: "Pheras/Ceremony",
      event_date: "2026-11-27",
      start_time: "10:00:00",
      end_time: "14:00:00",
      planned_team_size: 2,
      status: "Completed",
      location: "Hyderabad",
      venue: "Taj Falaknuma Palace",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
    {
      id: "event-6",
      couple_name: "Deepa & Vikram",
      "shoot name": "Deepa & Vikram",
      event_type: "Reception",
      event_date: "2026-11-27",
      start_time: "19:00:00",
      end_time: "23:00:00",
      planned_team_size: 2,
      status: "Completed",
      location: "Hyderabad",
      venue: "Taj Falaknuma Palace",
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "admin",
    },
  ];

  const mockAssignments: Assignment[] = [
    // Event 1 assignments
    {
      id: "asg-1",
      shoot_id: "event-1",
      team_member_id: "team-1", // Karan (Lead Photographer)
      assignment_type: "photographer",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-2",
      shoot_id: "event-1",
      team_member_id: "team-2", // Sameer (Cinematographer / Videographer)
      assignment_type: "videographer",
      created_at: new Date().toISOString(),
    },
    // Event 3 assignments (has other crew member: Sneha, Drone Operator)
    {
      id: "asg-3",
      shoot_id: "event-3",
      team_member_id: "team-1",
      assignment_type: "photographer",
      created_at: new Date().toISOString(),
    },
    {
      id: "asg-4",
      shoot_id: "event-3",
      team_member_id: "team-3", // Sneha (Drone Operator)
      assignment_type: "drone_operator",
      created_at: new Date().toISOString(),
    },
  ];

  it("reveals ALL events when clicking the '+N more' indicator on a date with 3+ events", () => {
    render(
      <CalendarView
        shoots={mockShoots}
        loading={false}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // On 2026-11-25 there are 3 events, so the grid displays 2 events and "+1 more"
    const moreBtn = screen.getByRole("button", { name: /\+1 more/i });
    expect(moreBtn).toBeInTheDocument();

    // Click "+1 more"
    fireEvent.click(moreBtn);

    // The detailed modal opens
    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/Detailed Schedule · 3 Events/i)).toBeInTheDocument();
    expect(within(modal).getByRole("heading", { name: /Wednesday, November 25, 2026/i })).toBeInTheDocument();

    // Verify EVERY event on that date is displayed (all 3 events, not limited)
    expect(within(modal).getByText("Pooja & Rohan")).toBeInTheDocument();
    expect(within(modal).getByText("Haldi")).toBeInTheDocument();

    expect(within(modal).getByText("Ananya & Kabir")).toBeInTheDocument();
    expect(within(modal).getByText("Nikah")).toBeInTheDocument();

    expect(within(modal).getByText("Sana & Imran")).toBeInTheDocument();
    expect(within(modal).getByText("Reception")).toBeInTheDocument();

    // Verify relevant information for Event 1:
    // - Timings
    expect(within(modal).getByText(/9:00 AM – 12:00 PM/i)).toBeInTheDocument();
    // - Location & Venue
    expect(within(modal).getByText(/Royal Manor · Jubilee Hills, Hyderabad/i)).toBeInTheDocument();
    // - Status information (Upcoming and In Progress)
    expect(within(modal).getAllByText("Upcoming").length).toBe(2);
    expect(within(modal).getByText("In Progress")).toBeInTheDocument();
    // - Photographers (Karan Johar)
    expect(within(modal).getAllByText(/Karan Johar/i).length).toBeGreaterThan(0);
    // - Videographers (Sameer Verma)
    expect(within(modal).getAllByText(/Sameer Verma/i).length).toBeGreaterThan(0);

    // Verify relevant information for Event 3:
    // - Other crew (Sneha Reddy - Drone Operator)
    expect(within(modal).getByText(/Sneha Reddy/i)).toBeInTheDocument();
    expect(within(modal).getByText(/drone operator/i)).toBeInTheDocument();

    // Close the modal
    fireEvent.click(within(modal).getByRole("button", { name: /Close date schedule view/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens detailed event view when clicking the date cell directly on date with 3+ events", () => {
    render(
      <CalendarView
        shoots={mockShoots}
        loading={false}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // Find the cell for 25th November 2026
    const dateCell = screen.getByTestId("calendar-day-2026-11-25");
    expect(dateCell).toBeInTheDocument();

    // Click the date cell
    fireEvent.click(dateCell);

    // Detailed schedule modal opens showing all 3 events
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/Detailed Schedule · 3 Events/i)).toBeInTheDocument();
    expect(within(modal).getByText("Pooja & Rohan")).toBeInTheDocument();
    expect(within(modal).getByText("Ananya & Kabir")).toBeInTheDocument();
    expect(within(modal).getByText("Sana & Imran")).toBeInTheDocument();
  });

  it("handles date with 1 event correctly", () => {
    render(
      <CalendarView
        shoots={mockShoots}
        loading={false}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // 2026-11-26 has 1 event (Meera & Arjun · Mehendi)
    const dateCell = screen.getByTestId("calendar-day-2026-11-26");
    fireEvent.click(dateCell);

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/Detailed Schedule · 1 Event/i)).toBeInTheDocument();
    expect(within(modal).getByText("Meera & Arjun")).toBeInTheDocument();
    expect(within(modal).getByText("Mehendi")).toBeInTheDocument();
    expect(within(modal).getByText(/Green Meadows Resort · Madhapur, Hyderabad/i)).toBeInTheDocument();
  });

  it("handles date with 2 events correctly", () => {
    render(
      <CalendarView
        shoots={mockShoots}
        loading={false}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // 2026-11-27 has 2 events (Deepa & Vikram Pheras & Reception)
    const dateCell = screen.getByTestId("calendar-day-2026-11-27");
    fireEvent.click(dateCell);

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/Detailed Schedule · 2 Events/i)).toBeInTheDocument();
    expect(within(modal).getAllByText("Deepa & Vikram").length).toBe(2);
    expect(within(modal).getByText("Pheras/Ceremony")).toBeInTheDocument();
    expect(within(modal).getByText("Reception")).toBeInTheDocument();
    expect(within(modal).getAllByText("Completed").length).toBe(2);
  });

  it("handles date with 0 events cleanly without breaking", () => {
    render(
      <CalendarView
        shoots={mockShoots}
        loading={false}
        team={mockTeam}
        assignments={mockAssignments}
      />
    );

    // 2026-11-28 has 0 events
    const dateCell = screen.getByTestId("calendar-day-2026-11-28");
    fireEvent.click(dateCell);

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/Detailed Schedule · 0 Events/i)).toBeInTheDocument();
    expect(within(modal).getByText(/No events scheduled for this date/i)).toBeInTheDocument();
  });
});
