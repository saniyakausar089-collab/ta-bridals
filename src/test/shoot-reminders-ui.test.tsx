import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShootRemindersSection } from "../components/ShootRemindersSection";
import type { ShootReminderItem } from "../lib/shootReminders";

describe("ShootRemindersSection Component", () => {
  const mockReminder: ShootReminderItem = {
    eventId: "shoot-101",
    shoot: {
      id: "shoot-101",
      couple_name: "Aakash & Priya",
      "shoot name": "Aakash & Priya",
      event_type: "Reception",
      event_date: "2026-11-10",
      start_time: "19:00:00",
      end_time: "23:30:00",
      location: "Chennai",
      venue: "Crowne Plaza",
      planned_team_size: 2,
      status: "Upcoming",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      notes: null,
      package_amount: 200000,
    },
    projectName: "Aakash & Priya",
    eventName: "Reception",
    dateFormatted: "10 Nov 2026",
    timeFormatted: "07:00 PM",
    locationFormatted: "Crowne Plaza, Chennai",
    startTimestamp: Date.parse("2026-11-10T19:00:00+05:30"),
    hoursUntilStart: 18.5,
    status: "pending",
    isPending: true,
    scheduleKey: "2026-11-10_19:00:00",
    eligibleRecipientCount: 2,
    assignedCrew: [
      {
        memberId: "crew-1",
        fullName: "Vikram Rathore",
        role: "Lead Photographer",
        phone: "9840123456",
        phoneInfo: {
          isValid: true,
          raw: "9840123456",
          waDigits: "919840123456",
          displayFormatted: "+91 98401 23456",
        },
        status: "pending",
        whatsAppUrl: "https://wa.me/919840123456?text=test",
        message: "Hi Vikram Rathore! 👋\n\nReminder: You have an upcoming shoot tomorrow.",
      },
      {
        memberId: "crew-2",
        fullName: "Ananya Iyer",
        role: "Cinematographer",
        phone: "9840987654",
        phoneInfo: {
          isValid: true,
          raw: "9840987654",
          waDigits: "919840987654",
          displayFormatted: "+91 98409 87654",
        },
        status: "pending",
        whatsAppUrl: "https://wa.me/919840987654?text=test2",
        message: "Hi Ananya Iyer! 👋\n\nReminder: You have an upcoming shoot tomorrow.",
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders dedicated shoot reminders section with project and event details", () => {
    render(<ShootRemindersSection reminders={[mockReminder]} />);

    expect(screen.getByText("24-Hour Shoot Reminders")).toBeInTheDocument();
    expect(screen.getByText("Aakash & Priya")).toBeInTheDocument();
    expect(screen.getByText("Reception")).toBeInTheDocument();
    expect(screen.getByText("Crowne Plaza, Chennai")).toBeInTheDocument();
    expect(screen.getByText("2 crew")).toBeInTheDocument();
    expect(screen.getByText("Vikram Rathore")).toBeInTheDocument();
    expect(screen.getByText("Ananya Iyer")).toBeInTheDocument();
  });

  it("clicking Send WhatsApp opens window and updates status to 'WhatsApp Opened'", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ShootRemindersSection reminders={[mockReminder]} />);

    const sendButtons = screen.getAllByRole("button", { name: /Send WhatsApp/i });
    expect(sendButtons.length).toBe(2);

    // Click WhatsApp for Vikram Rathore
    fireEvent.click(sendButtons[0]!);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      mockReminder.assignedCrew[0]!.whatsAppUrl,
      "_blank",
      "noopener,noreferrer",
    );

    // Status pill should update to WhatsApp Opened
    expect(screen.getAllByText("WhatsApp Opened").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking Confirm Sent manually marks individual crew member as sent", () => {
    render(<ShootRemindersSection reminders={[mockReminder]} />);

    const confirmButtons = screen.getAllByRole("button", { name: /Confirm Sent/i });
    expect(confirmButtons.length).toBe(2);

    fireEvent.click(confirmButtons[0]!);

    expect(screen.getByText("Sent ✓")).toBeInTheDocument();
  });

  it("opens Message All Crew stepper wizard and allows stepping through crew", () => {
    render(<ShootRemindersSection reminders={[mockReminder]} />);

    const messageAllBtn = screen.getByRole("button", { name: /Message All Crew \(2\)/i });
    fireEvent.click(messageAllBtn);

    expect(screen.getByText(/BATCH REMINDER STEPPER · STEP 1 OF 2/i)).toBeInTheDocument();
    expect(screen.getByText("Message Vikram Rathore")).toBeInTheDocument();

    // Click Skip to next crew member
    const skipBtn = screen.getByRole("button", { name: /Skip/i });
    fireEvent.click(skipBtn);

    expect(screen.getByText(/BATCH REMINDER STEPPER · STEP 2 OF 2/i)).toBeInTheDocument();
    expect(screen.getByText("Message Ananya Iyer")).toBeInTheDocument();
  });

  it("displays empty state when no shoots are in the 24-hour reminder window", () => {
    render(<ShootRemindersSection reminders={[]} />);

    expect(screen.getByText("No shoots in the 24-hour window")).toBeInTheDocument();
  });
});
