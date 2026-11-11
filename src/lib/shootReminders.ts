/**
 * TA Bridals - 24-Hour Shoot Reminder Logic & Utilities
 * 
 * Strict Isolated Implementation:
 * - Calculates upcoming shoot start times using the Asia/Kolkata timezone (+05:30).
 * - Identifies events entering the 24-hour reminder window.
 * - Resolves assigned crew members and their normalized WhatsApp contact numbers.
 * - Formats personalized click-to-chat WhatsApp messages according to specification.
 * - Tracks alert states: Pending -> WhatsApp Opened -> Marked as Sent.
 * - Opening WhatsApp NEVER marks as sent; requires explicit manual admin confirmation.
 * - Recalculates reminder window if rescheduled; drops pending reminder if cancelled.
 * - Deduplicates event alerts to prevent multiple reminders for the same event.
 */

import type { Tables } from "@/integrations/supabase/types";
import {
  normalizeWhatsAppPhone,
  buildWhatsAppClickToChatUrl,
  formatShootDate,
  formatShootTime,
  categorizeCrewRole,
  type CrewCategory,
  type NormalizedPhoneResult,
} from "./messagingUtils";

export type Shoot = Tables<"shoots">;
export type TeamMember = Tables<"team_members">;
export type Assignment = Tables<"shoot_assignments">;

export type ReminderStatus = "pending" | "whatsapp_opened" | "marked_as_sent";

export interface AssignedCrewReminder {
  memberId: string;
  fullName: string;
  role: string;
  phone: string | null;
  phoneInfo: NormalizedPhoneResult;
  status: ReminderStatus;
  whatsAppUrl: string;
  message: string;
}

export interface ShootReminderItem {
  eventId: string;
  shoot: Shoot;
  projectName: string;
  eventName: string;
  dateFormatted: string;
  timeFormatted: string;
  locationFormatted: string;
  startTimestamp: number; // UTC ms representing scheduled start in Asia/Kolkata
  hoursUntilStart: number;
  status: ReminderStatus;
  isPending: boolean; // True if overall or any crew member is still pending
  assignedCrew: AssignedCrewReminder[];
  eligibleRecipientCount: number;
  scheduleKey: string; // Used to detect rescheduling
}

export interface StoredEventStatus {
  status: ReminderStatus;
  scheduleKey: string;
  crewStatuses: Record<string, ReminderStatus>;
  updatedAt: string;
}

const STORAGE_KEY = "ta_shoot_reminders_status_v1";

/**
 * Normalizes time string to standard "HH:mm:ss".
 * Handles formats like "14:30", "9:00", "09:00:00", etc.
 * Defaults to "09:00:00" if empty.
 */
export function normalizeTimeFormat(timeStr: string | null | undefined): string {
  if (!timeStr || !timeStr.trim()) return "09:00:00";
  const clean = timeStr.trim();
  const timeOnly = (clean.includes("T") ? clean.split("T")[1] : clean) || clean;
  const withoutZone = timeOnly.replace(/([+-]\d{2}:?\d{2}|Z).*$/, "");
  const parts = withoutZone.split(":");
  const h = parts[0]?.padStart(2, "0") || "09";
  const m = parts[1]?.padStart(2, "0") || "00";
  const s = parts[2] ? parts[2].slice(0, 2).padStart(2, "0") : "00";
  return `${h}:${m}:${s}`;
}

/**
 * Computes exact epoch timestamp (in ms) of the shoot start in Asia/Kolkata timezone (+05:30).
 * Returns null if eventDate is invalid.
 */
export function calculateEventStartTimestamp(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
): number | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate.trim())) {
    return null;
  }
  const cleanDate = eventDate.trim();
  const normalizedTime = normalizeTimeFormat(startTime);
  const kolkataIso = `${cleanDate}T${normalizedTime}+05:30`;
  const timestamp = Date.parse(kolkataIso);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * Checks whether an event is within the 24-hour reminder window.
 * Window: Scheduled start time is in the future and within <= 24 hours from current time.
 */
export function isWithin24HourReminderWindow(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const startMs = calculateEventStartTimestamp(eventDate, startTime);
  if (!startMs) return false;

  const diffMs = startMs - nowMs;
  const diffHours = diffMs / (1000 * 60 * 60);

  // Starts between 0 and 24 hours from now
  return diffHours > 0 && diffHours <= 24;
}

export interface ShootReminderCrewMember {
  name: string;
  role?: string | null;
  phone?: string | null;
  category?: CrewCategory;
}

export interface GenerateShootReminderMessageParams {
  crewName?: string;
  projectName: string;
  eventName: string;
  dateFormatted: string;
  timeFormatted: string;
  locationFormatted: string;
  clientName?: string;
  clientContact?: string;
  assignedCrew?: ShootReminderCrewMember[];
}

/**
 * Generates the official TA Bridals Event Details WhatsApp Message.
 * 
 * Format:
 * TA BRIDALS – EVENT DETAILS
 * 
 * Dear Team,
 * 
 * Please find below the event details.
 * 
 * CLIENT NAME: [Client Name]
 * CONTACT NUMBER: [Client Contact]
 * 
 * EVENT DETAILS:
 * EVENT DATE: [Event Date]
 * EVENT: [Individual Event Name]
 * REPORTING TIME: [Reporting Time]
 * 
 * VENUE:
 * [Complete Venue and Address]
 * 
 * PHOTOGRAPHERS:
 * 
 * 1. [Photographer Name] – [Contact Number]
 * 
 * VIDEOGRAPHERS:
 * 
 * 1. [Videographer Name] – [Contact Number]
 * 
 * DRONE OPERATORS:
 * [Assigned Members, if any]
 * 
 * CINEMATOGRAPHERS:
 * [Assigned Members, if any]
 * 
 * OTHERS:
 * [Assigned Members, if any]
 * 
 * – TA BRIDALS
 */
export function generateShootReminderMessage(params: GenerateShootReminderMessageParams): string {
  const clientName = (params.clientName || params.projectName || "Client").trim();
  const clientContact = (params.clientContact || "Available on request").trim();
  const eventName = (params.eventName || "Event").trim();
  const dateFormatted = (params.dateFormatted || "Date TBA").trim();
  const reportingTime = (params.timeFormatted || "Time TBA").trim();
  const venue = (params.locationFormatted || "Location TBA").trim();

  // Resolve assigned crew list
  let crewList = params.assignedCrew ? [...params.assignedCrew] : [];
  if (crewList.length === 0 && params.crewName) {
    crewList = [
      {
        name: params.crewName,
        role: "Crew Member",
        category: "OTHERS",
      },
    ];
  }

  const photographers: ShootReminderCrewMember[] = [];
  const videographers: ShootReminderCrewMember[] = [];
  const droneOperators: ShootReminderCrewMember[] = [];
  const cinematographers: ShootReminderCrewMember[] = [];
  const others: ShootReminderCrewMember[] = [];

  for (const c of crewList) {
    const category = c.category || categorizeCrewRole(c.role);
    switch (category) {
      case "PHOTOGRAPHERS":
        photographers.push(c);
        break;
      case "VIDEOGRAPHERS":
        videographers.push(c);
        break;
      case "DRONE OPERATORS":
        droneOperators.push(c);
        break;
      case "CINEMATOGRAPHERS":
        cinematographers.push(c);
        break;
      case "OTHERS":
      default:
        others.push(c);
        break;
    }
  }

  const formatCrewLine = (c: ShootReminderCrewMember, index: number, showRole: boolean = false): string => {
    const phonePart = c.phone && c.phone.trim() ? ` – ${c.phone.trim()}` : "";
    const rolePart = showRole && c.role && c.role.trim() && c.role !== "Crew Member" ? ` (${c.role.trim()})` : "";
    return `${index + 1}. ${c.name}${rolePart}${phonePart}`;
  };

  const lines: string[] = [
    `TA BRIDALS – EVENT DETAILS`,
    ``,
    `Dear Team,`,
    ``,
    `Please find below the event details.`,
    ``,
    `CLIENT NAME: ${clientName}`,
    `CONTACT NUMBER: ${clientContact}`,
    ``,
    `EVENT DETAILS:`,
    `EVENT DATE: ${dateFormatted}`,
    `EVENT: ${eventName}`,
    `REPORTING TIME: ${reportingTime}`,
    ``,
    `VENUE:`,
    `${venue}`,
  ];

  if (photographers.length > 0) {
    lines.push(``, `PHOTOGRAPHERS:`, ``);
    photographers.forEach((c, idx) => {
      lines.push(formatCrewLine(c, idx));
    });
  }

  if (videographers.length > 0) {
    lines.push(``, `VIDEOGRAPHERS:`, ``);
    videographers.forEach((c, idx) => {
      lines.push(formatCrewLine(c, idx));
    });
  }

  if (droneOperators.length > 0) {
    lines.push(``, `DRONE OPERATORS:`, ``);
    droneOperators.forEach((c, idx) => {
      lines.push(formatCrewLine(c, idx));
    });
  }

  if (cinematographers.length > 0) {
    lines.push(``, `CINEMATOGRAPHERS:`, ``);
    cinematographers.forEach((c, idx) => {
      lines.push(formatCrewLine(c, idx));
    });
  }

  if (others.length > 0) {
    lines.push(``, `OTHERS:`, ``);
    others.forEach((c, idx) => {
      lines.push(formatCrewLine(c, idx, true));
    });
  }

  lines.push(``, `– TA BRIDALS`);

  return lines.join("\n");
}

/**
 * Retrieves persisted reminder statuses from localStorage.
 */
export function getStoredReminderStatuses(): Record<string, StoredEventStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredEventStatus>;
  } catch {
    return {};
  }
}

/**
 * Persists status update for an event reminder.
 */
export function saveEventReminderStatus(
  eventId: string,
  scheduleKey: string,
  status: ReminderStatus,
  crewStatuses?: Record<string, ReminderStatus>,
): void {
  if (typeof window === "undefined" || !eventId) return;
  try {
    const store = getStoredReminderStatuses();
    const existing = store[eventId];
    store[eventId] = {
      status,
      scheduleKey,
      crewStatuses: crewStatuses || existing?.crewStatuses || {},
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Updates individual crew member status within an event reminder.
 */
export function updateCrewMemberReminderStatus(
  eventId: string,
  scheduleKey: string,
  memberId: string,
  memberStatus: ReminderStatus,
  allMemberIds?: string[],
): { newEventStatus: ReminderStatus } {
  if (typeof window === "undefined" || !eventId) return { newEventStatus: "pending" };
  try {
    const store = getStoredReminderStatuses();
    const existing = store[eventId] || {
      status: "pending",
      scheduleKey,
      crewStatuses: {},
      updatedAt: new Date().toISOString(),
    };

    const crewStatuses = { ...existing.crewStatuses, [memberId]: memberStatus };
    
    // Derive overall event status based on crew statuses
    let newEventStatus: ReminderStatus = "pending";
    if (allMemberIds && allMemberIds.length > 0) {
      const allSent = allMemberIds.every((id) => crewStatuses[id] === "marked_as_sent");
      const anyActioned = allMemberIds.some(
        (id) => crewStatuses[id] === "whatsapp_opened" || crewStatuses[id] === "marked_as_sent",
      );
      if (allSent) {
        newEventStatus = "marked_as_sent";
      } else if (anyActioned) {
        newEventStatus = "whatsapp_opened";
      }
    } else {
      const allCrewStatuses = Object.values(crewStatuses);
      if (allCrewStatuses.length > 0 && allCrewStatuses.every((s) => s === "marked_as_sent")) {
        newEventStatus = "marked_as_sent";
      } else if (
        allCrewStatuses.some((s) => s === "whatsapp_opened" || s === "marked_as_sent")
      ) {
        newEventStatus = "whatsapp_opened";
      }
    }

    store[eventId] = {
      status: newEventStatus,
      scheduleKey,
      crewStatuses,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return { newEventStatus };
  } catch {
    return { newEventStatus: "pending" };
  }
}

/**
 * Derives eligible 24-hour shoot reminder alerts from active shoots, assignments and team records.
 * 
 * Rules applied:
 * 1. Only upcoming events within exactly <= 24 hours of start time (Asia/Kolkata timezone).
 * 2. Excludes cancelled or completed events.
 * 3. Deduplicates events by event id.
 * 4. Resolves assigned crew members and normalizes their registered WhatsApp mobile numbers.
 * 5. Handles rescheduling: if date or start_time changed, previous sent status resets to pending.
 * 6. Sorts by start time ascending (most imminent shoot first).
 */
export function getEligibleShootReminders(
  shoots: Shoot[],
  assignments: Assignment[],
  team: TeamMember[],
  nowMs: number = Date.now(),
): ShootReminderItem[] {
  const teamMap = new Map<string, TeamMember>();
  for (const member of team) {
    teamMap.set(member.id, member);
  }

  const storedStatuses = getStoredReminderStatuses();
  const seenEventIds = new Set<string>();
  const reminders: ShootReminderItem[] = [];

  for (const shoot of shoots) {
    // Prevent duplicate alerts for the same event
    if (seenEventIds.has(shoot.id)) continue;

    // Rule: Exclude cancelled or completed shoots
    if (shoot.status === "Cancelled" || shoot.status === "Completed") {
      continue;
    }

    const startMs = calculateEventStartTimestamp(shoot.event_date, shoot.start_time);
    if (!startMs) continue;

    const diffMs = startMs - nowMs;
    const diffHours = diffMs / (1000 * 60 * 60);

    // Rule: Event must be within the 24-hour reminder window
    if (diffHours <= 0 || diffHours > 24) {
      continue;
    }

    seenEventIds.add(shoot.id);

    // Rescheduling key: detects if event date or start time changed
    const scheduleKey = `${shoot.event_date}_${shoot.start_time || "09:00:00"}`;
    const stored = storedStatuses[shoot.id];

    // If rescheduled, reset stored status to pending
    const isRescheduled = stored && stored.scheduleKey !== scheduleKey;
    const currentStored = isRescheduled ? undefined : stored;

    const projectName = (
      shoot.couple_name ||
      (shoot as any)["shoot name"] ||
      "Untitled Project"
    ).trim();
    const eventName = (shoot.event_type || "Shoot").trim();
    const dateFormatted = formatShootDate(shoot.event_date);
    const timeFormatted = formatShootTime(shoot.start_time);
    const locationFormatted =
      shoot.venue && shoot.location && shoot.venue !== shoot.location
        ? `${shoot.venue}, ${shoot.location}`
        : shoot.venue || shoot.location || "Location TBA";

    // Resolve client contact from shoot.client_phone or shoot.notes
    let clientContact = "";
    if ((shoot as any).client_phone) {
      clientContact = (shoot as any).client_phone.trim();
    }
    if (!clientContact && shoot.notes) {
      const match = shoot.notes.match(/(?:Client\s*Contact|Contact|Phone|Mobile):\s*([+0-9\s-]+)/i);
      if (match && match[1]) {
        clientContact = match[1].trim();
      }
    }
    if (!clientContact) {
      clientContact = "Available on request";
    }

    // Resolve assigned crew strictly for this specific event
    const eventAssignments = assignments.filter((a) => a.shoot_id === shoot.id);

    // Group unique crew members for this event to avoid duplicate recipients
    const uniqueMemberMap = new Map<string, { member: TeamMember; roles: Set<string> }>();
    for (const a of eventAssignments) {
      const member = teamMap.get(a.team_member_id);
      if (!member) continue;
      if (!uniqueMemberMap.has(member.id)) {
        uniqueMemberMap.set(member.id, { member, roles: new Set<string>() });
      }
      const role = a.assignment_type || member.role || "Crew Member";
      uniqueMemberMap.get(member.id)!.roles.add(role);
    }

    // Build event-specific crew list for message generation
    const eventCrewList: ShootReminderCrewMember[] = [];
    uniqueMemberMap.forEach(({ member, roles }) => {
      const rolesArr = Array.from(roles);
      const primaryRole = member.role || rolesArr[0] || "Crew Member";
      const phoneInfo = normalizeWhatsAppPhone(member.phone);
      const displayPhone = phoneInfo.isValid ? phoneInfo.displayFormatted : (member.phone || null);
      eventCrewList.push({
        name: member.full_name,
        role: primaryRole,
        phone: displayPhone,
        category: categorizeCrewRole(primaryRole),
      });
    });

    // Generate the official TA BRIDALS – EVENT DETAILS message for this specific event
    const eventMessage = generateShootReminderMessage({
      projectName,
      eventName,
      dateFormatted,
      timeFormatted,
      locationFormatted,
      clientName: projectName,
      clientContact,
      assignedCrew: eventCrewList,
    });

    const assignedCrew: AssignedCrewReminder[] = [];

    uniqueMemberMap.forEach(({ member, roles }) => {
      const fullName = member.full_name || "Assigned Crew";
      const rolesArr = Array.from(roles);
      const role = rolesArr.join(", ") || member.role || "Crew Member";
      const phone = member.phone || null;
      const phoneInfo = normalizeWhatsAppPhone(phone);

      const crewStatus: ReminderStatus =
        currentStored?.crewStatuses?.[member.id] || "pending";

      const whatsAppUrl = phoneInfo.isValid
        ? buildWhatsAppClickToChatUrl(phoneInfo.waDigits, eventMessage)
        : "";

      assignedCrew.push({
        memberId: member.id,
        fullName,
        role,
        phone,
        phoneInfo,
        status: crewStatus,
        whatsAppUrl,
        message: eventMessage,
      });
    });

    // Sort crew alphabetically by name
    assignedCrew.sort((a, b) => a.fullName.localeCompare(b.fullName));

    // Determine overall event status
    let eventStatus: ReminderStatus = currentStored?.status || "pending";
    if (assignedCrew.length > 0) {
      if (assignedCrew.every((c) => c.status === "marked_as_sent")) {
        eventStatus = "marked_as_sent";
      } else if (
        assignedCrew.some((c) => c.status === "whatsapp_opened" || c.status === "marked_as_sent")
      ) {
        eventStatus = "whatsapp_opened";
      }
    }

    const isPending =
      eventStatus !== "marked_as_sent" ||
      (assignedCrew.length > 0 && assignedCrew.some((c) => c.status !== "marked_as_sent"));

    const eligibleRecipientCount = assignedCrew.filter((c) => c.phoneInfo.isValid).length;

    reminders.push({
      eventId: shoot.id,
      shoot,
      projectName,
      eventName,
      dateFormatted,
      timeFormatted,
      locationFormatted,
      startTimestamp: startMs,
      hoursUntilStart: Math.max(0, diffHours),
      status: eventStatus,
      isPending,
      assignedCrew,
      eligibleRecipientCount,
      scheduleKey,
    });
  }

  // Sort by start timestamp ascending (most urgent first)
  return reminders.sort((a, b) => a.startTimestamp - b.startTimestamp);
}
