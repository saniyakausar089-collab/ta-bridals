/**
 * TA Bridals - Messaging Utilities
 * Handles phone number normalization for WhatsApp Click-to-Chat,
 * project crew extraction, message template generation, and session status tracking.
 * 
 * FRONTEND ONLY - ZERO BACKEND OR API MODIFICATIONS.
 */

import type { Tables } from "@/integrations/supabase/types";

export type Shoot = Tables<"shoots">;
export type TeamMember = Tables<"team_members">;
export type Assignment = Tables<"shoot_assignments">;

export type MessageDeliveryStatus =
  | "not_started"
  | "whatsapp_opened"
  | "skipped"
  | "invalid_phone";

export interface NormalizedPhoneResult {
  isValid: boolean;
  raw: string;
  waDigits: string; // digits suitable for wa.me URL (country code + subscriber digits)
  displayFormatted: string;
  error?: string;
}

/**
 * Normalizes phone numbers safely for WhatsApp Click to Chat (https://wa.me/<number>).
 * Handles Indian numbers (10 digits, +91, 91, leading 0) and international numbers.
 * Never blindly prepends country code if already present.
 */
export function normalizeWhatsAppPhone(rawInput: string | null | undefined): NormalizedPhoneResult {
  const raw = (rawInput ?? "").trim();

  if (!raw) {
    return {
      isValid: false,
      raw: "",
      waDigits: "",
      displayFormatted: "",
      error: "Phone number is missing",
    };
  }

  // Reject emails or alphabetic strings
  if (/[a-zA-Z@]/.test(raw)) {
    return {
      isValid: false,
      raw,
      waDigits: "",
      displayFormatted: raw,
      error: "Phone number contains invalid characters",
    };
  }

  const isExplicitInternational = raw.startsWith("+");
  const digitsOnly = raw.replace(/\D/g, "");

  if (digitsOnly.length < 10) {
    return {
      isValid: false,
      raw,
      waDigits: "",
      displayFormatted: raw,
      error: "Phone number is too short (must be at least 10 digits)",
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      raw,
      waDigits: "",
      displayFormatted: raw,
      error: "Phone number is too long (maximum 15 digits)",
    };
  }

  // Case 1: Indian number handling
  // If explicitly starts with +91 or is 12 digits starting with 91
  if ((isExplicitInternational && raw.replace(/\s+/g, "").startsWith("+91")) || (digitsOnly.length === 12 && digitsOnly.startsWith("91"))) {
    const subscriber = digitsOnly.slice(2);
    if (subscriber.length === 10) {
      return {
        isValid: true,
        raw,
        waDigits: `91${subscriber}`,
        displayFormatted: `+91 ${subscriber.slice(0, 5)} ${subscriber.slice(5)}`,
      };
    }
  }

  // If 11 digits starting with trunk 0 (e.g. 09876543210 in India)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    const subscriber = digitsOnly.slice(1);
    if (subscriber.length === 10) {
      return {
        isValid: true,
        raw,
        waDigits: `91${subscriber}`,
        displayFormatted: `+91 ${subscriber.slice(0, 5)} ${subscriber.slice(5)}`,
      };
    }
  }

  // If exactly 10 digits (Standard Indian mobile: begins with 6, 7, 8, or 9)
  if (digitsOnly.length === 10) {
    return {
      isValid: true,
      raw,
      waDigits: `91${digitsOnly}`,
      displayFormatted: `+91 ${digitsOnly.slice(0, 5)} ${digitsOnly.slice(5)}`,
    };
  }

  // Case 2: Other International numbers (starts with +, or 11-15 digits)
  if (isExplicitInternational) {
    return {
      isValid: true,
      raw,
      waDigits: digitsOnly,
      displayFormatted: `+${digitsOnly}`,
    };
  }

  // Default fallback for digits between 11 and 15
  return {
    isValid: true,
    raw,
    waDigits: digitsOnly,
    displayFormatted: `+${digitsOnly}`,
  };
}

/**
 * Builds the official WhatsApp Click to Chat URL:
 * https://wa.me/COUNTRYCODEPHONENUMBER?text=ENCODED_MESSAGE
 */
export function buildWhatsAppClickToChatUrl(waDigits: string, message: string): string {
  const cleanDigits = waDigits.replace(/\D/g, "");
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanDigits}?text=${encodedText}`;
}

/**
 * Formats a 24-hr time string (e.g. "14:30:00" or "09:00") into "02:30 PM" / "9:00 AM".
 */
export function formatShootTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "Time TBA";
  const clean = timeStr.trim();
  const parts = clean.split(":");
  if (parts.length < 2) return clean;

  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return clean;

  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours}:${minutes} ${ampm}`;
}

export interface ProjectCrewAssignment {
  member: TeamMember;
  roles: string[];
  assignedEvents: {
    event: Shoot;
    role: string;
  }[];
  phoneInfo: NormalizedPhoneResult;
}

export interface MessagingProject {
  id: string; // normalized lower-cased couple name
  name: string; // Couple / project name
  events: Shoot[];
  earliestDate: string;
  latestDate: string;
  status: string;
  primaryLocation: string;
  assignedCrew: ProjectCrewAssignment[];
  eligibleRecipientCount: number;
}

/**
 * Derives messaging projects from the existing All Shoots state.
 * Groups shoots by couple_name or "shoot name", maps assignments, and deduplicates crew per project.
 */
export function deriveMessagingProjects(
  shoots: Shoot[],
  assignments: Assignment[],
  team: TeamMember[]
): MessagingProject[] {
  const teamMap = new Map<string, TeamMember>();
  for (const member of team) {
    teamMap.set(member.id, member);
  }

  // Group shoots by couple name
  const projectMap = new Map<string, Shoot[]>();
  for (const shoot of shoots) {
    const rawName = (shoot.couple_name || (shoot as any)["shoot name"] || "Untitled Shoot").trim();
    const key = rawName.toLowerCase();
    if (!projectMap.has(key)) {
      projectMap.set(key, []);
    }
    projectMap.get(key)!.push(shoot);
  }

  const projects: MessagingProject[] = [];

  projectMap.forEach((events) => {
    // Sort events chronologically
    const sortedEvents = [...events].sort((a, b) => {
      const dateCompare = (a.event_date || "").localeCompare(b.event_date || "");
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || "").localeCompare(b.start_time || "");
    });

    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    if (!firstEvent || !lastEvent) return;

    const originalName =
      firstEvent.couple_name || (firstEvent as any)["shoot name"] || "Untitled Shoot";

    // Overall status
    let overallStatus = "Upcoming";
    if (sortedEvents.some((e) => e.status === "In Progress")) {
      overallStatus = "In Progress";
    } else if (sortedEvents.every((e) => e.status === "Completed")) {
      overallStatus = "Completed";
    } else if (sortedEvents.every((e) => e.status === "Cancelled")) {
      overallStatus = "Cancelled";
    }

    const eventIds = new Set(sortedEvents.map((e) => e.id));
    const projectAssignments = assignments.filter((a) => eventIds.has(a.shoot_id));

    // Map unique team members assigned to any event in this project
    const memberAssignmentsMap = new Map<
      string,
      {
        roles: Set<string>;
        assignedEvents: { event: Shoot; role: string }[];
      }
    >();

    for (const pa of projectAssignments) {
      const event = sortedEvents.find((e) => e.id === pa.shoot_id);
      if (!event) continue;

      if (!memberAssignmentsMap.has(pa.team_member_id)) {
        memberAssignmentsMap.set(pa.team_member_id, {
          roles: new Set<string>(),
          assignedEvents: [],
        });
      }

      const memberEntry = memberAssignmentsMap.get(pa.team_member_id)!;
      const role = pa.assignment_type || "Crew Member";
      memberEntry.roles.add(role);
      memberEntry.assignedEvents.push({ event, role });
    }

    const assignedCrew: ProjectCrewAssignment[] = [];
    memberAssignmentsMap.forEach((details, memberId) => {
      const member = teamMap.get(memberId) || {
        id: memberId,
        full_name: "Unknown Member",
        role: Array.from(details.roles)[0] || "Crew Member",
        phone: null,
        email: null,
        available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
      };

      const phoneInfo = normalizeWhatsAppPhone(member.phone);
      assignedCrew.push({
        member,
        roles: Array.from(details.roles),
        assignedEvents: details.assignedEvents,
        phoneInfo,
      });
    });

    // Sort crew alphabetically by full_name
    assignedCrew.sort((a, b) => a.member.full_name.localeCompare(b.member.full_name));

    const eligibleRecipientCount = assignedCrew.filter((c) => c.phoneInfo.isValid).length;

    projects.push({
      id: originalName.toLowerCase(),
      name: originalName,
      events: sortedEvents,
      earliestDate: firstEvent.event_date || "",
      latestDate: lastEvent.event_date || "",
      status: overallStatus,
      primaryLocation: firstEvent.venue || firstEvent.location || "Location TBA",
      assignedCrew,
      eligibleRecipientCount,
    });
  });

  return projects.sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));
}

/**
 * Formats shoot date into readable string, e.g. "15 Nov 2026"
 */
export function formatShootDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Date TBA";
  try {
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${parseInt(day, 10)} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Generates personalized message template based on actual project and crew assignment information.
 */
export function generatePersonalizedMessage(params: {
  crewName: string;
  projectName: string;
  roles: string[];
  assignedEvents: {
    event: Shoot;
    role: string;
  }[];
}): string {
  const { crewName, projectName, roles, assignedEvents } = params;
  const firstName = crewName.trim().split(/\s+/)[0] || crewName;
  const roleDisplay = roles.length > 0 ? roles.join(", ") : "Crew Member";

  if (assignedEvents.length <= 1) {
    const eventItem = assignedEvents[0]?.event;
    const eventType = eventItem?.event_type || "Shoot";
    const dateStr = formatShootDate(eventItem?.event_date);
    const timeStr = formatShootTime(eventItem?.start_time);
    const venueStr = eventItem?.venue || eventItem?.location || "";

    const lines = [
      `Hi ${firstName}! 👋`,
      ``,
      `You have been assigned to the ${projectName} project by TA Bridals.`,
      ``,
      `Role: ${roleDisplay}`,
      `Event: ${eventType}`,
      `Shoot Date: ${dateStr}`,
    ];

    if (timeStr && timeStr !== "Time TBA") {
      lines.push(`Shoot Time: ${timeStr}`);
    }

    if (venueStr && venueStr !== "Location TBA") {
      lines.push(`Venue: ${venueStr}`);
    }

    lines.push(
      ``,
      `Please be ready for your assigned shoot.`,
      ``,
      `Thank you!`,
      `Team TA Bridals`
    );

    return lines.join("\n");
  }

  // Multiple events in the same project
  const eventDetails = assignedEvents.map((ae) => {
    const e = ae.event;
    const type = e.event_type || "Event";
    const date = formatShootDate(e.event_date);
    const time = formatShootTime(e.start_time);
    const venue = e.venue || e.location || "";
    let item = `• ${type} - ${date}`;
    if (time && time !== "Time TBA") {
      item += `, ${time}`;
    }
    if (venue && venue !== "Location TBA") {
      item += ` (${venue})`;
    }
    return item;
  });

  return [
    `Hi ${firstName}! 👋`,
    ``,
    `You have been assigned to the ${projectName} project by TA Bridals.`,
    ``,
    `Role: ${roleDisplay}`,
    `Assigned Events:`,
    ...eventDetails,
    ``,
    `Please be ready for your assigned shoot.`,
    ``,
    `Thank you!`,
    `Team TA Bridals`,
  ].join("\n");
}
