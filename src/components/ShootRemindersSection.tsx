import React, { useState } from "react";
import {
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MapPin,
  Calendar,
  Users,
  Send,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Phone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "@/components/AdminNotificationCenter";
import { openWhatsAppChat } from "@/lib/messagingUtils";
import {
  type ShootReminderItem,
  type ReminderStatus,
  updateCrewMemberReminderStatus,
  saveEventReminderStatus,
  getStoredReminderStatuses,
} from "@/lib/shootReminders";

interface ShootRemindersSectionProps {
  reminders: ShootReminderItem[];
  onStatusChange?: () => void;
  onNavigateToShoots?: () => void;
}

export function ShootRemindersSection({
  reminders,
  onStatusChange,
  onNavigateToShoots,
}: ShootRemindersSectionProps) {
  // Local state to force re-render on status change
  const [, setTick] = useState(0);
  const rerender = () => {
    setTick((t) => t + 1);
    onStatusChange?.();
  };

  // "Message All Crew" Wizard Stepper state
  const [wizardReminder, setWizardReminder] = useState<ShootReminderItem | null>(null);
  const [wizardIndex, setWizardIndex] = useState(0);

  // Handle single crew member WhatsApp open
  const handleOpenWhatsApp = (
    reminder: ShootReminderItem,
    memberId: string,
    urlFallback?: string,
  ) => {
    const crew = reminder.assignedCrew.find((c) => c.memberId === memberId);
    if (!crew && !urlFallback) return;

    if (crew?.phoneInfo?.isValid) {
      openWhatsAppChat(crew.phoneInfo.waDigits, crew.message);
    } else if (urlFallback) {
      window.open(urlFallback, "_blank", "noopener,noreferrer");
    }

    // Advance status to "whatsapp_opened" (NEVER directly to sent)
    const allIds = reminder.assignedCrew.map((c) => c.memberId);
    updateCrewMemberReminderStatus(
      reminder.eventId,
      reminder.scheduleKey,
      memberId,
      "whatsapp_opened",
      allIds,
    );
    rerender();
  };

  // Handle single crew member Mark as Sent
  const handleMarkSent = (
    reminder: ShootReminderItem,
    memberId: string,
    currentStatus: ReminderStatus,
  ) => {
    const nextStatus: ReminderStatus =
      currentStatus === "marked_as_sent" ? "pending" : "marked_as_sent";
    const allIds = reminder.assignedCrew.map((c) => c.memberId);
    updateCrewMemberReminderStatus(
      reminder.eventId,
      reminder.scheduleKey,
      memberId,
      nextStatus,
      allIds,
    );
    rerender();
  };

  // Handle Mark All as Sent for the event
  const handleMarkAllSent = (reminder: ShootReminderItem) => {
    const crewStatuses: Record<string, ReminderStatus> = {};
    for (const c of reminder.assignedCrew) {
      crewStatuses[c.memberId] = "marked_as_sent";
    }
    saveEventReminderStatus(reminder.eventId, reminder.scheduleKey, "marked_as_sent", crewStatuses);
    rerender();
  };

  // Wizard Stepper helpers
  const handleOpenWizard = (reminder: ShootReminderItem) => {
    setWizardReminder(reminder);
    setWizardIndex(0);
  };

  const handleCloseWizard = () => {
    setWizardReminder(null);
    setWizardIndex(0);
  };

  const currentWizardCrew =
    wizardReminder && wizardReminder.assignedCrew[wizardIndex]
      ? wizardReminder.assignedCrew[wizardIndex]
      : null;

  const storedStatuses = getStoredReminderStatuses();
  const pendingCount = reminders.filter((r) => {
    const s = storedStatuses[r.eventId];
    const isKeyValid = s?.scheduleKey === r.scheduleKey;
    const status = (isKeyValid && s?.status) || r.status;
    return status !== "marked_as_sent";
  }).length;

  return (
    <section
      id="shoot-reminders-section"
      className="rounded-2xl border border-[#30282e] bg-[#151317] p-5 sm:p-6 text-[#f7f0ee] shadow-xl transition-all"
    >
      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30282e] pb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-[#762d40]/40 bg-[#762d40]/20 text-[#e7a0ad] shadow-inner">
            <Bell className="size-5 animate-pulse text-[#e7a0ad]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-medium text-[#f7f0ee]">
                24-Hour Shoot Reminders
              </h2>
              <NotificationBadge
                count={pendingCount}
                variant={pendingCount > 0 ? "warning" : "neutral"}
              />
            </div>
            <p className="mt-0.5 text-xs text-[#b8adb2]">
              Real-time alerts for shoots starting within 24 hours · Dispatches via WhatsApp
              Click-to-Chat (Asia/Kolkata)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
            IST Timezone Active
          </span>
          {onNavigateToShoots && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToShoots}
              className="h-8 border-[#30282e] bg-[#1b181d] text-xs font-medium text-[#b8adb2] hover:bg-[#231e27] hover:text-[#f7f0ee]"
            >
              All Shoots &rarr;
            </Button>
          )}
        </div>
      </div>

      {/* CONTENT: EMPTY STATE OR ALERT CARDS */}
      <div className="mt-5 space-y-4">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#30282e] bg-[#1b181d]/40 py-10 px-4 text-center">
            <CheckCircle2 className="size-8 text-[#71d8aa] opacity-80 mb-2" />
            <p className="text-sm font-medium text-[#f7f0ee]">No shoots in the 24-hour window</p>
            <p className="mt-1 max-w-md text-xs text-[#82767d]">
              When an upcoming shoot enters its final 24 hours before start time, it will
              automatically surface here with personalized WhatsApp reminder dispatches for all
              assigned crew members.
            </p>
          </div>
        ) : (
          reminders.map((reminder) => {
            const hoursLeft = Math.round(reminder.hoursUntilStart);
            const countdownText =
              hoursLeft <= 0
                ? "Starting imminently"
                : hoursLeft === 1
                  ? "Starts in ~1 hr"
                  : `Starts in ~${hoursLeft} hrs`;

            const storedEvent = storedStatuses[reminder.eventId];
            const isKeyValid = storedEvent?.scheduleKey === reminder.scheduleKey;
            const eventStatus: ReminderStatus =
              (isKeyValid && storedEvent?.status) || reminder.status;
            const isAllSent = eventStatus === "marked_as_sent";
            const isOpened = eventStatus === "whatsapp_opened";

            return (
              <div
                key={reminder.eventId}
                className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
                  isAllSent
                    ? "border-emerald-500/30 bg-[#171b18]/60"
                    : isOpened
                      ? "border-sky-500/30 bg-[#161a22]/60"
                      : "border-amber-500/40 bg-[#1e1919]/70 shadow-[0_0_15px_rgba(224,122,56,0.07)]"
                }`}
              >
                {/* CARD TOP BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#762d40]/50 bg-[#762d40]/25 px-2 py-0.5 text-xs font-semibold text-[#e7a0ad]">
                      {reminder.eventName}
                    </span>
                    <h3 className="font-serif text-lg font-medium text-[#f7f0ee]">
                      {reminder.projectName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Time Countdown Pill */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                      <Clock className="size-3" />
                      {countdownText}
                    </span>

                    {/* Event Status Pill */}
                    {isAllSent ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        All Reminders Sent
                      </span>
                    ) : isOpened ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                        <Clock className="size-3" />
                        WhatsApp Opened
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                        <AlertCircle className="size-3" />
                        Pending Action
                      </span>
                    )}
                  </div>
                </div>

                {/* SHOOT DETAILS & ASSIGNED CREW */}
                <div className="p-5">
                  {/* Event Details Grid */}
                  <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 rounded-lg border border-white/5 bg-black/20 p-3 text-xs text-[#b8adb2]">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-[#d9b98c] shrink-0" />
                      <span>
                        <strong className="text-[#f7f0ee]">{reminder.dateFormatted}</strong> at{" "}
                        <strong className="text-[#f7f0ee]">{reminder.timeFormatted}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="size-3.5 text-[#d9b98c] shrink-0" />
                      <span className="truncate" title={reminder.locationFormatted}>
                        {reminder.locationFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-[#d9b98c] shrink-0" />
                      <span>
                        <strong className="text-[#f7f0ee]">
                          {reminder.assignedCrew.length} crew
                        </strong>{" "}
                        assigned
                      </span>
                    </div>
                  </div>

                  {/* Crew Dispatch Section */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a08d96]">
                        Assigned Crew WhatsApp Reminders ({reminder.assignedCrew.length})
                      </p>

                      <div className="flex items-center gap-2">
                        {reminder.assignedCrew.length > 1 && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenWizard(reminder)}
                            className="h-7 border border-[#762d40] bg-[#762d40]/30 text-[11px] font-medium text-[#e7a0ad] hover:bg-[#762d40] hover:text-white transition-colors"
                          >
                            <Send className="size-3 mr-1" />
                            Message All Crew ({reminder.eligibleRecipientCount})
                          </Button>
                        )}

                        {!isAllSent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAllSent(reminder)}
                            className="h-7 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20"
                          >
                            <Check className="size-3 mr-1" />
                            Mark All Sent
                          </Button>
                        )}
                      </div>
                    </div>

                    {reminder.assignedCrew.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                        No crew members have been assigned to this shoot yet. Open All Shoots to
                        assign crew photographers or videographers.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {reminder.assignedCrew.map((crew) => {
                          const crewStatus: ReminderStatus =
                            (isKeyValid && storedEvent?.crewStatuses?.[crew.memberId]) ||
                            crew.status;
                          const crewSent = crewStatus === "marked_as_sent";
                          const crewOpened = crewStatus === "whatsapp_opened";

                          return (
                            <div
                              key={crew.memberId}
                              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                                crewSent
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : crewOpened
                                    ? "border-sky-500/20 bg-sky-500/5"
                                    : "border-[#30282e] bg-[#1a161c]"
                              }`}
                            >
                              {/* Member info */}
                              <div className="flex items-center gap-3 min-w-[200px]">
                                <div className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-[#f7f0ee]">
                                  {crew.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-medium text-[#f7f0ee]">
                                      {crew.fullName}
                                    </p>
                                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#a08d96]">
                                      {crew.role}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#82767d]">
                                    <Phone className="size-2.5" />
                                    {crew.phoneInfo.isValid ? (
                                      <span className="text-[#b8adb2]">
                                        {crew.phoneInfo.displayFormatted}
                                      </span>
                                    ) : (
                                      <span className="text-rose-400 font-medium">
                                        No registered phone
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Member Status & Buttons */}
                              <div className="flex items-center gap-2 ml-auto">
                                {/* Individual Status Badge */}
                                {crewSent ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="size-2.5" />
                                    Marked as Sent
                                  </span>
                                ) : crewOpened ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/30">
                                    <Clock className="size-2.5" />
                                    WhatsApp Opened
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30">
                                    Pending
                                  </span>
                                )}

                                {/* Send WhatsApp Reminder Button */}
                                {crew.phoneInfo.isValid ? (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleOpenWhatsApp(reminder, crew.memberId, crew.whatsAppUrl)
                                    }
                                    className="h-7 bg-[#25D366] hover:bg-[#1ebd59] text-black font-semibold text-[11px] px-2.5 transition-colors shadow-xs"
                                    title="Open WhatsApp Click-to-Chat with pre-filled 24-hr reminder"
                                  >
                                    <Send className="size-3 mr-1" />
                                    Send WhatsApp
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled
                                    className="h-7 opacity-40 bg-zinc-700 text-[11px] px-2.5"
                                  >
                                    No Phone
                                  </Button>
                                )}

                                {/* Confirm Sent Button */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleMarkSent(reminder, crew.memberId, crewStatus)
                                  }
                                  className={`h-7 text-[11px] px-2 transition-colors ${
                                    crewSent
                                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                      : "border-[#30282e] text-[#b8adb2] hover:text-[#f7f0ee] hover:bg-white/5"
                                  }`}
                                  title={
                                    crewSent
                                      ? "Click to unmark"
                                      : "Click to manually confirm that the message was sent"
                                  }
                                >
                                  <Check className="size-3 mr-1" />
                                  {crewSent ? "Sent ✓" : "Confirm Sent"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MESSAGE ALL CREW STEPPER MODAL */}
      {wizardReminder && currentWizardCrew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#30282e] bg-[#151317] p-6 text-[#f7f0ee] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#30282e] pb-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#d9b98c]">
                  BATCH REMINDER STEPPER · STEP {wizardIndex + 1} OF{" "}
                  {wizardReminder.assignedCrew.length}
                </span>
                <h3 className="font-serif text-lg font-medium text-[#f7f0ee] mt-0.5">
                  Message {currentWizardCrew.fullName}
                </h3>
                <p className="text-xs text-[#82767d]">
                  Project: {wizardReminder.projectName} ({wizardReminder.eventName})
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseWizard}
                className="rounded-lg p-1 text-[#82767d] hover:bg-white/5 hover:text-[#f7f0ee]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Crew Member Info */}
            <div className="mt-4 rounded-xl border border-[#30282e] bg-[#1b181d] p-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#f7f0ee]">{currentWizardCrew.fullName}</p>
                  <p className="text-[11px] text-[#82767d]">{currentWizardCrew.role}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[#d9b98c]">
                    {currentWizardCrew.phoneInfo.isValid
                      ? currentWizardCrew.phoneInfo.displayFormatted
                      : "No valid number"}
                  </p>
                  <span
                    className={`inline-block mt-0.5 text-[10px] font-medium ${
                      currentWizardCrew.status === "marked_as_sent"
                        ? "text-emerald-400"
                        : currentWizardCrew.status === "whatsapp_opened"
                          ? "text-sky-400"
                          : "text-amber-400"
                    }`}
                  >
                    Status: {currentWizardCrew.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Message Template Preview Box */}
            <div className="mt-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#a08d96] mb-1.5">
                WhatsApp Message Preview
              </label>
              <pre className="rounded-xl border border-[#30282e] bg-[#100d10] p-3 font-mono text-[11px] text-[#e7a0ad] leading-relaxed whitespace-pre-wrap select-all">
                {currentWizardCrew.message}
              </pre>
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#30282e] pt-4">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={wizardIndex === 0}
                  onClick={() => setWizardIndex((i) => Math.max(0, i - 1))}
                  className="h-8 border-[#30282e] text-xs text-[#b8adb2]"
                >
                  <ChevronLeft className="size-3.5 mr-1" />
                  Back
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={wizardIndex >= wizardReminder.assignedCrew.length - 1}
                  onClick={() =>
                    setWizardIndex((i) =>
                      Math.min(wizardReminder.assignedCrew.length - 1, i + 1),
                    )
                  }
                  className="h-8 border-[#30282e] text-xs text-[#b8adb2]"
                >
                  Skip
                  <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {currentWizardCrew.phoneInfo.isValid && (
                  <Button
                    size="sm"
                    onClick={() =>
                      handleOpenWhatsApp(
                        wizardReminder,
                        currentWizardCrew.memberId,
                        currentWizardCrew.whatsAppUrl,
                      )
                    }
                    className="h-8 bg-[#25D366] hover:bg-[#1ebd59] text-black font-semibold text-xs px-3 shadow-xs"
                  >
                    <Send className="size-3.5 mr-1" />
                    Open WhatsApp
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => {
                    handleMarkSent(
                      wizardReminder,
                      currentWizardCrew.memberId,
                      currentWizardCrew.status,
                    );
                    if (wizardIndex < wizardReminder.assignedCrew.length - 1) {
                      setWizardIndex((i) => i + 1);
                    } else {
                      handleCloseWizard();
                    }
                  }}
                  className="h-8 bg-[#762d40] text-xs font-medium text-white hover:bg-[#c56c7d]"
                >
                  <Check className="size-3.5 mr-1" />
                  Confirm Sent & Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
