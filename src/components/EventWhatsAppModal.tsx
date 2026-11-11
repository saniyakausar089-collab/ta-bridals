import React, { useState, useMemo, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Users,
  Calendar,
  Clock,
  MapPin,
  X,
  RotateCcw,
  Sparkles,
  Phone,
  PhoneOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  generateEventWhatsAppDetails,
  getEventAssignedCrew,
  openWhatsAppChat,
  formatShootDate,
  formatShootTime,
  type Shoot,
  type TeamMember,
  type Assignment,
  type EventAssignedCrewMember,
} from "@/lib/messagingUtils";

export type EventDispatchStatus = "not_sent" | "whatsapp_opened" | "invalid_phone";

interface EventWhatsAppModalProps {
  shoot: Shoot;
  projectName?: string;
  assignments: Assignment[];
  team: TeamMember[];
  clientProfiles?: { full_name?: string | null; partner_name?: string | null; phone?: string | null }[];
  onClose: () => void;
}

export function EventWhatsAppModal({
  shoot,
  projectName: customProjectName,
  assignments,
  team,
  clientProfiles = [],
  onClose,
}: EventWhatsAppModalProps) {
  const resolvedProjectName = (
    customProjectName ||
    shoot.couple_name ||
    (shoot as any)["shoot name"] ||
    "Client Project"
  ).trim();

  // Dynamic crew extraction: strictly for this individual event
  const eventCrew: EventAssignedCrewMember[] = useMemo(() => {
    return getEventAssignedCrew(shoot.id, assignments, team);
  }, [shoot.id, assignments, team]);

  // Try auto-resolving client contact from notes or matching client profile
  const initialClientContact = useMemo(() => {
    if (shoot.notes) {
      const match = shoot.notes.match(
        /(?:Client\s*Contact|Contact|Phone|Mobile):\s*([+0-9\s-]+)/i
      );
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    // Match client profile by project/couple name
    const lowerName = resolvedProjectName.toLowerCase();
    const matchedProfile = clientProfiles.find((cp) => {
      const fn = (cp.full_name || "").toLowerCase();
      const pn = (cp.partner_name || "").toLowerCase();
      return (
        (fn && lowerName.includes(fn)) ||
        (pn && lowerName.includes(pn)) ||
        (fn && pn && `${fn} & ${pn}` === lowerName)
      );
    });
    if (matchedProfile?.phone) {
      return matchedProfile.phone.trim();
    }
    return "";
  }, [shoot.notes, resolvedProjectName, clientProfiles]);

  const [clientContact, setClientContact] = useState(initialClientContact);
  const [copied, setCopied] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  // Recipient delivery statuses
  const [deliveryStatuses, setDeliveryStatuses] = useState<
    Record<string, { status: EventDispatchStatus; error?: string; timestamp?: string }>
  >(() => {
    const initial: Record<string, { status: EventDispatchStatus; error?: string }> = {};
    for (const c of eventCrew) {
      if (!c.phoneInfo.isValid) {
        initial[c.member.id] = {
          status: "invalid_phone",
          error: c.phoneInfo.error || "Missing or invalid phone number",
        };
      } else {
        initial[c.member.id] = {
          status: "not_sent",
        };
      }
    }
    return initial;
  });

  // Message preview text state
  const defaultTemplate = useMemo(() => {
    return generateEventWhatsAppDetails({
      shoot,
      clientName: resolvedProjectName,
      clientContact: clientContact || undefined,
      assignedCrew: eventCrew,
    });
  }, [shoot, resolvedProjectName, clientContact, eventCrew]);

  const [messageText, setMessageText] = useState(defaultTemplate);
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);

  // Update template if contact changes and user hasn't heavily customized
  const handleClientContactChange = (val: string) => {
    setClientContact(val);
    if (!isManuallyEdited) {
      setMessageText(
        generateEventWhatsAppDetails({
          shoot,
          clientName: resolvedProjectName,
          clientContact: val || undefined,
          assignedCrew: eventCrew,
        })
      );
    }
  };

  const handleResetTemplate = () => {
    setIsManuallyEdited(false);
    setMessageText(
      generateEventWhatsAppDetails({
        shoot,
        clientName: resolvedProjectName,
        clientContact: clientContact || undefined,
        assignedCrew: eventCrew,
      })
    );
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback copy
    }
  };

  // Launch single recipient
  const handleSendToMember = (crewItem: EventAssignedCrewMember) => {
    if (!crewItem.phoneInfo.isValid) {
      setDeliveryStatuses((prev) => ({
        ...prev,
        [crewItem.member.id]: {
          status: "invalid_phone",
          error: crewItem.phoneInfo.error || "Missing phone number",
        },
      }));
      return;
    }

    openWhatsAppChat(crewItem.phoneInfo.waDigits, messageText);

    setDeliveryStatuses((prev) => ({
      ...prev,
      [crewItem.member.id]: {
        status: "whatsapp_opened",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    }));
  };

  // Eligible crew with valid phone numbers
  const eligibleCrew = useMemo(
    () => eventCrew.filter((c) => c.phoneInfo.isValid),
    [eventCrew]
  );

  const openedCount = useMemo(
    () =>
      eventCrew.filter((c) => deliveryStatuses[c.member.id]?.status === "whatsapp_opened")
        .length,
    [eventCrew, deliveryStatuses]
  );

  const invalidCount = useMemo(
    () =>
      eventCrew.filter((c) => deliveryStatuses[c.member.id]?.status === "invalid_phone").length,
    [eventCrew, deliveryStatuses]
  );

  const unsentEligible = useMemo(
    () =>
      eligibleCrew.filter((c) => deliveryStatuses[c.member.id]?.status !== "whatsapp_opened"),
    [eligibleCrew, deliveryStatuses]
  );

  // Sequential Dispatch Stepper
  const handleStartSequentialDispatch = () => {
    if (unsentEligible.length === 0) return;
    setActiveStepIndex(0);
  };

  const handleSequentialStepDispatch = () => {
    if (activeStepIndex === null) return;
    const targetMember = unsentEligible[activeStepIndex];
    if (targetMember) {
      handleSendToMember(targetMember);
    }
    if (activeStepIndex + 1 < unsentEligible.length) {
      setActiveStepIndex(activeStepIndex + 1);
    } else {
      setActiveStepIndex(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-[#40343e] bg-[#161217] p-5 sm:p-6 text-[#f7f0ee] shadow-2xl space-y-5 my-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="event-whatsapp-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#30282e] pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/15 px-2.5 py-1 text-xs font-semibold text-[#25D366]">
                <MessageSquare className="size-3.5" />
                WhatsApp Event Dispatch
              </span>
              <span className="rounded-lg border border-[#c56c7d]/40 bg-[#c56c7d]/15 px-2.5 py-1 text-xs font-medium text-[#f7f0ee]">
                {shoot.event_type}
              </span>
            </div>
            <h2 id="event-whatsapp-modal-title" className="font-serif text-xl sm:text-2xl text-[#f7f0ee]">
              {resolvedProjectName} · {shoot.event_type}
            </h2>
            <p className="text-xs text-[#8c828a]">
              Delivers event-specific details exclusively to crew members assigned to this event.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8c828a] hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Event Quick Info Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-[#30282e] bg-[#120f12] p-3 text-xs">
          <div className="flex items-center gap-2 text-[#b8adb2]">
            <Calendar className="size-4 text-[#d9b98c] shrink-0" />
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#82767d]">Event Date</span>
              <span className="text-[#f7f0ee] font-medium">{formatShootDate(shoot.event_date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#b8adb2]">
            <Clock className="size-4 text-[#d9b98c] shrink-0" />
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#82767d]">Reporting Time</span>
              <span className="text-[#f7f0ee] font-medium">{formatShootTime(shoot.start_time)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#b8adb2]">
            <MapPin className="size-4 text-[#d9b98c] shrink-0" />
            <div className="truncate">
              <span className="block text-[10px] uppercase font-semibold text-[#82767d]">Venue</span>
              <span className="text-[#f7f0ee] font-medium truncate block">
                {shoot.venue || shoot.location || "Location TBA"}
              </span>
            </div>
          </div>
        </div>

        {/* Client Contact Number Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="client-contact-input" className="font-medium text-[#d9b98c] flex items-center gap-1.5">
              <Phone className="size-3.5" />
              Client Contact Number
            </label>
            <span className="text-[11px] text-[#8c828a]">Appears under &ldquo;CONTACT NUMBER&rdquo; in WhatsApp</span>
          </div>
          <Input
            id="client-contact-input"
            value={clientContact}
            onChange={(e) => handleClientContactChange(e.target.value)}
            placeholder="e.g. +91 98765 43210 (or leave empty if available on request)"
            className="border-[#40343e] bg-[#120f12] text-xs text-[#f7f0ee] placeholder:text-[#5a5258]"
          />
        </div>

        {/* Message Preview Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#d9b98c] flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              WhatsApp Message Preview
            </span>
            <div className="flex items-center gap-2">
              {isManuallyEdited && (
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1 text-[11px] text-[#b8adb2] hover:text-[#f7f0ee] transition-colors"
                >
                  <RotateCcw className="size-3" /> Reset template
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 rounded-md border border-[#30282e] bg-[#1b181d] px-2 py-1 text-[11px] font-medium text-[#d9b98c] hover:bg-[#252028] transition-colors"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy text"}
              </button>
            </div>
          </div>

          <textarea
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              setIsManuallyEdited(true);
            }}
            rows={10}
            className="w-full rounded-xl border border-[#40343e] bg-[#100d11] p-3.5 font-mono text-xs leading-relaxed text-[#e8dfdf] shadow-inner focus:border-[#25D366]/60 focus:outline-none focus:ring-1 focus:ring-[#25D366]/60"
            aria-label="Event details message preview"
          />
          <p className="text-[11px] text-[#8c828a]">
            You can edit this message directly before sending. Any modifications apply to all outgoing messages for this dispatch.
          </p>
        </div>

        {/* Assigned Recipients Section */}
        <div className="space-y-3 border-t border-[#30282e] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#f7f0ee] flex items-center gap-2">
                <Users className="size-4 text-[#d9b98c]" />
                Event Recipients ({eventCrew.length})
              </h3>
              <p className="text-[11px] text-[#8c828a]">
                Only assigned crew for this specific event are included. No other project crew will receive this.
              </p>
            </div>

            {/* Overall Status Badge */}
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-md border border-[#30282e] bg-[#120f12] px-2 py-0.5 text-[11px] text-[#b8adb2]">
                {openedCount} / {eventCrew.length} Dispatched
              </span>
              {invalidCount > 0 && (
                <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  {invalidCount} Missing Phone
                </span>
              )}
            </div>
          </div>

          {eventCrew.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#40343e] p-6 text-center text-xs text-[#8c828a]">
              No crew members are currently assigned to this event.
              <br />
              <span className="text-[#d9b98c]">Assign team members first to dispatch event details via WhatsApp.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {eventCrew.map((crewItem) => {
                const delivery = deliveryStatuses[crewItem.member.id];
                const isOpened = delivery?.status === "whatsapp_opened";
                const isInvalid = delivery?.status === "invalid_phone" || !crewItem.phoneInfo.isValid;

                return (
                  <div
                    key={crewItem.member.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#30282e] bg-[#120f12] p-3 text-xs transition-colors hover:border-[#40343e]"
                  >
                    <div className="space-y-0.5 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#f7f0ee]">{crewItem.member.full_name}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-[#b8adb2]">
                          {crewItem.member.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {crewItem.phoneInfo.isValid ? (
                          <span className="text-[#8c828a] font-mono">{crewItem.phoneInfo.displayFormatted}</span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <PhoneOff className="size-3" /> Missing / Invalid Phone
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Delivery Status Indicator */}
                      {isOpened && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#25D366]/40 bg-[#25D366]/15 px-2 py-1 text-[10px] font-medium text-[#25D366]">
                          <Check className="size-3" /> WhatsApp Opened
                          {delivery.timestamp && ` (${delivery.timestamp})`}
                        </span>
                      )}
                      {isInvalid && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[10px] font-medium text-rose-300">
                          <AlertCircle className="size-3" /> Cannot send
                        </span>
                      )}
                      {!isOpened && !isInvalid && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-[#8c828a]">
                          Ready to send
                        </span>
                      )}

                      {/* Action Button */}
                      <Button
                        size="sm"
                        disabled={isInvalid}
                        onClick={() => handleSendToMember(crewItem)}
                        className={`h-7 px-2.5 text-xs font-medium gap-1.5 transition-colors ${
                          isOpened
                            ? "border border-[#30282e] bg-[#1a161c] text-[#b8adb2] hover:bg-[#252028] hover:text-[#f7f0ee]"
                            : "bg-[#25D366] text-black hover:bg-[#20ba59] font-medium shadow-sm"
                        }`}
                      >
                        <MessageSquare className="size-3" />
                        {isOpened ? "Resend" : "Send WhatsApp"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sequential Stepper Helper Banner if active */}
        {activeStepIndex !== null && unsentEligible[activeStepIndex] && (
          <div className="rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 p-3.5 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#25D366] flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Step-by-step Dispatch ({activeStepIndex + 1} of {unsentEligible.length})
              </span>
              <button
                type="button"
                onClick={() => setActiveStepIndex(null)}
                className="text-[11px] text-[#8c828a] hover:text-white"
              >
                Cancel step-by-step
              </button>
            </div>
            <p className="text-xs text-[#f7f0ee]">
              Next Recipient:{" "}
              <strong>{unsentEligible[activeStepIndex].member.full_name}</strong> (
              {unsentEligible[activeStepIndex].member.role}) &mdash;{" "}
              <span className="font-mono text-[#d9b98c]">
                {unsentEligible[activeStepIndex].phoneInfo.displayFormatted}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSequentialStepDispatch}
                className="bg-[#25D366] text-black hover:bg-[#20ba59] font-medium text-xs gap-1.5"
              >
                <Send className="size-3.5" /> Open WhatsApp for {unsentEligible[activeStepIndex].member.full_name}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeStepIndex + 1 < unsentEligible.length) {
                    setActiveStepIndex(activeStepIndex + 1);
                  } else {
                    setActiveStepIndex(null);
                  }
                }}
                className="border-[#40343e] text-xs text-[#b8adb2]"
              >
                Skip Member
              </Button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#30282e] pt-4">
          <div className="text-xs text-[#8c828a]">
            {openedCount === eventCrew.length && eventCrew.length > 0 ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> All assigned crew members have been dispatched!
              </span>
            ) : (
              <span>
                {unsentEligible.length} of {eventCrew.length} recipients awaiting dispatch
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#40343e] text-xs text-[#b8adb2] hover:bg-white/5"
            >
              Close
            </Button>

            {unsentEligible.length > 0 && activeStepIndex === null && (
              <Button
                type="button"
                onClick={handleStartSequentialDispatch}
                className="bg-[#25D366] text-black hover:bg-[#20ba59] font-medium text-xs gap-1.5 shadow-md"
              >
                <Send className="size-3.5" />
                {openedCount > 0 ? `Send to Remaining (${unsentEligible.length})` : `Send to All (${unsentEligible.length})`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

