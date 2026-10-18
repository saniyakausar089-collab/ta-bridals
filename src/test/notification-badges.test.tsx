import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationBadge, AdminNotificationCenter } from "../components/AdminNotificationCenter";

describe("Admin Notification Badges & Notification Center", () => {
  it("renders WhatsApp/Instagram style badge and hides on zero count", () => {
    const { container: containerZero } = render(<NotificationBadge count={0} />);
    expect(containerZero.firstChild).toBeNull();

    const { unmount } = render(<NotificationBadge count={5} variant="danger" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    unmount();

    render(<NotificationBadge count={142} variant="danger" />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("lists pending requests in the review center and routes to appropriate section", () => {
    const onNavigate = vi.fn();
    const mockRegistrations = [
      {
        user_id: "user-1",
        display_name: "Applicant Farhan",
        email: "farhan@example.com",
        approval_status: "pending" as const,
        reviewed_at: null,
        reviewed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockAvailability = [
      {
        id: "avail-1",
        worker_id: "worker-1",
        user_id: "user-2",
        worker_name: "Crew Sara",
        request_type: "leave" as const,
        start_date: "2026-11-01",
        end_date: "2026-11-03",
        start_time: null,
        end_time: null,
        reason: "Family event",
        status: "pending" as const,
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockUnderstaffed = [
      {
        shoot: {
          id: "shoot-1",
          couple_name: "Zoya & Faizan",
          event_type: "Wedding",
          event_date: "2026-12-01",
          start_time: "10:00",
          end_time: "18:00",
          location: "Udaipur",
          venue: "Taj Lake Palace",
          planned_team_size: 7,
          status: "Upcoming",
          notes: null,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        metrics: {
          plannedTeamSize: 7,
          assignedCrew: 3,
          uniqueOnSiteWorkers: 3,
          uniquePostProdWorkers: 0,
          uniqueTotalWorkers: 3,
          additionalCrewRequired: 4,
          remainingRequired: 4,
          remainingCapacity: 17,
          staffingStatus: "Understaffed" as const,
          isOverLimit: false,
        },
      },
    ];

    render(
      <AdminNotificationCenter
        pendingRegistrations={mockRegistrations}
        pendingAvailability={mockAvailability}
        understaffedShoots={mockUnderstaffed}
        pendingExpenses={[]}
        pendingPayroll={[]}
        pendingSongClientsCount={2}
        onNavigate={onNavigate}
      />,
    );

    // Open notification center by clicking the bell button
    const bellBtn = screen.getByRole("button", { name: /studio notifications/i });
    fireEvent.click(bellBtn);

    // Check items listed
    expect(screen.getByText("Applicant Farhan")).toBeInTheDocument();
    expect(screen.getByText("Crew Sara")).toBeInTheDocument();
    expect(screen.getByText("Zoya & Faizan")).toBeInTheDocument();
    expect(screen.getByText("Song Library Client Signups")).toBeInTheDocument();

    // Clicking registration routes to approvals
    fireEvent.click(screen.getByText("Applicant Farhan"));
    expect(onNavigate).toHaveBeenCalledWith("approvals");
  });
});
