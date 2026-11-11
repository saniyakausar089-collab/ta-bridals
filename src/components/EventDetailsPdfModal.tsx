import React, { useMemo, useState } from "react";
import {
  Printer,
  Download,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  X,
  FileText,
  Pencil,
  RotateCcw,
  Sparkles,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getEventAssignedCrew,
  categorizeCrewRole,
  type Shoot,
  type TeamMember,
  type Assignment,
  type EventAssignedCrewMember,
} from "@/lib/messagingUtils";
import { getPhotographerClassificationsForShoot } from "@/lib/crewRequirements";

export function formatPdfOrdinalDate(dateStr?: string | null): string {
  if (!dateStr) return "DATE TBA";
  try {
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts;
    const dayNum = parseInt(day, 10);
    const months = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;

    let suffix = "th";
    if (dayNum % 10 === 1 && dayNum % 100 !== 11) suffix = "st";
    else if (dayNum % 10 === 2 && dayNum % 100 !== 12) suffix = "nd";
    else if (dayNum % 10 === 3 && dayNum % 100 !== 13) suffix = "rd";

    return `${dayNum}${suffix} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatPdfTime(timeStr?: string | null): string {
  if (!timeStr) return "TIME TBA";
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

interface EventDetailsPdfModalProps {
  shoot: Shoot;
  projectName?: string;
  assignments: Assignment[];
  team: TeamMember[];
  clientProfiles?: { full_name?: string | null; partner_name?: string | null; phone?: string | null }[];
  onClose: () => void;
  onOpenWhatsApp?: () => void;
}

export function EventDetailsPdfModal({
  shoot,
  projectName: customProjectName,
  assignments,
  team,
  clientProfiles = [],
  onClose,
  onOpenWhatsApp,
}: EventDetailsPdfModalProps) {
  const initialClientName = (
    customProjectName ||
    shoot.couple_name ||
    (shoot as any)["shoot name"] ||
    "MEGHANA + PRAVEEN"
  ).trim();

  // Try auto-resolving client contact from notes or client profile
  const initialClientContact = useMemo(() => {
    if (shoot.notes) {
      const match = shoot.notes.match(
        /(?:Client\s*Contact|Contact|Phone|Mobile):\s*([^\]\r\n]+)/i
      );
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    const lowerName = initialClientName.toLowerCase();
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
    return "99597 44907";
  }, [shoot.notes, initialClientName, clientProfiles]);

  const [clientName, setClientName] = useState(initialClientName);
  const [clientContact, setClientContact] = useState(initialClientContact);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dynamic assigned crew for this specific event
  const eventCrew: EventAssignedCrewMember[] = useMemo(() => {
    return getEventAssignedCrew(shoot.id, assignments, team);
  }, [shoot.id, assignments, team]);

  // Photo classifications (Normal / Candidate / candid / wide)
  const photoClassifications = useMemo(() => {
    return getPhotographerClassificationsForShoot(shoot);
  }, [shoot]);

  // Group assigned crew strictly by categories matching the reference design
  const photographers = useMemo(() => {
    return eventCrew.filter((c) => c.category === "PHOTOGRAPHERS");
  }, [eventCrew]);

  const videographers = useMemo(() => {
    return eventCrew.filter((c) => c.category === "VIDEOGRAPHERS");
  }, [eventCrew]);

  const droneOperators = useMemo(() => {
    return eventCrew.filter((c) => c.category === "DRONE OPERATORS");
  }, [eventCrew]);

  const cinematographers = useMemo(() => {
    return eventCrew.filter((c) => c.category === "CINEMATOGRAPHERS");
  }, [eventCrew]);

  const others = useMemo(() => {
    return eventCrew.filter((c) => c.category === "OTHERS");
  }, [eventCrew]);

  const formattedDate = formatPdfOrdinalDate(shoot.event_date);
  const formattedTime = formatPdfTime(shoot.start_time);

  // Print directly using window.print()
  const handlePrint = () => {
    window.print();
  };

  // Open standalone clean printable page in new tab
  const handleOpenPrintableTab = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const sheetElement = document.getElementById("ta-event-details-printable-sheet");
    const sheetHtml = sheetElement ? sheetElement.innerHTML : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${clientName} - ${shoot.event_type} Event Details Sheet</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background: #ffffff;
              color: #111827;
              margin: 0;
              padding: 0;
            }
            .printable-wrapper {
              max-width: 680px;
              margin: 0 auto;
              background: #ffffff;
            }
            .header-banner {
              background-color: #d11a2a !important;
              color: #ffffff !important;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 24px 32px;
            }
            .logo-title {
              font-size: 26px;
              font-weight: 800;
              letter-spacing: 2px;
              margin: 0;
              line-height: 1.1;
            }
            .logo-sub {
              font-size: 9px;
              font-weight: 600;
              letter-spacing: 3px;
              margin-top: 3px;
              opacity: 0.9;
            }
            .header-right {
              font-size: 30px;
              font-weight: 800;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              margin: 0;
            }
            .sheet-body {
              padding: 32px 36px 48px;
              font-size: 14px;
              line-height: 1.6;
              color: #111827;
            }
            .greeting {
              font-size: 15px;
              margin-bottom: 24px;
            }
            .client-block {
              margin: 20px 0 24px 0;
              font-size: 15px;
            }
            .client-name {
              color: #16a34a !important;
              font-weight: 800;
            }
            .section-title {
              color: #1d4ed8 !important;
              font-weight: 800;
              font-size: 15px;
              letter-spacing: 0.5px;
              margin: 20px 0 6px 0;
            }
            .event-type {
              color: #7e22ce !important;
              font-weight: 800;
            }
            .item-row {
              margin: 4px 0;
              font-size: 14.5px;
            }
            .venue-row {
              margin: 3px 0;
              font-size: 14.5px;
            }
            .crew-list {
              margin: 4px 0;
              padding-left: 0;
              list-style-type: none;
            }
            .crew-item {
              margin: 5px 0;
              font-size: 14.5px;
            }
          </style>
        </head>
        <body>
          <div class="printable-wrapper">
            ${sheetHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopySummary = async () => {
    const venueStr = shoot.venue || shoot.location || "Venue TBA";
    const lines = [
      `TA BRIDALS – EVENT DETAILS`,
      ``,
      `*Dear Team*,`,
      `Please find below * ${formattedDate} * event details.`,
      ``,
      `CLIENT NAME : * ${clientName} *`,
      `CONTACT NUMBER : * ${clientContact} *`,
      ``,
      `* EVENT DETAILS *`,
      `EVENT DATE : * ${formattedDate} *`,
      `EVENT : * ${shoot.event_type} *`,
      `REPORTING TIME : * ${formattedTime} *`,
      ``,
      `* VENUE *`,
      shoot.venue ? shoot.venue : "",
      shoot.location ? shoot.location : "",
    ];

    if (photographers.length > 0) {
      lines.push(``, `* PHOTOGRAPHERS *`);
      photographers.forEach((p, idx) => {
        const cls = photoClassifications[p.member.id];
        const tag = cls ? `[ ${cls.toLowerCase()} ]` : `[ candid ]`;
        const phone = p.phoneInfo.displayFormatted || p.member.phone || "No phone";
        lines.push(`${idx + 1}. Mr. ${p.member.full_name} ${tag}( ${phone} )`);
      });
    }

    if (videographers.length > 0) {
      lines.push(``, `* VIDEOGRAPHER *`);
      videographers.forEach((v, idx) => {
        const phone = v.phoneInfo.displayFormatted || v.member.phone || "No phone";
        lines.push(`${idx + 1}. Mr. ${v.member.full_name} ( ${phone} )`);
      });
    }

    if (droneOperators.length > 0) {
      lines.push(``, `* DRONE OPERATOR *`);
      droneOperators.forEach((d, idx) => {
        const phone = d.phoneInfo.displayFormatted || d.member.phone || "No phone";
        lines.push(`${idx + 1}. Mr. ${d.member.full_name} ( ${phone} )`);
      });
    }

    if (cinematographers.length > 0) {
      lines.push(``, `* CINEMATOGRAPHER *`);
      cinematographers.forEach((c, idx) => {
        const phone = c.phoneInfo.displayFormatted || c.member.phone || "No phone";
        lines.push(`${idx + 1}. Mr. ${c.member.full_name} ( ${phone} )`);
      });
    }

    try {
      await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-[#40343e] bg-[#161217] p-4 sm:p-6 text-[#f7f0ee] shadow-2xl space-y-4 my-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="event-pdf-modal-title"
      >
        {/* Top Control Bar (Non-Printable) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30282e] pb-3 no-print">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#c56c7d]/40 bg-[#c56c7d]/15 px-2.5 py-1 text-xs font-semibold text-[#f7f0ee]">
              <FileText className="size-3.5 text-[#d9b98c]" />
              Official Event Sheet (PDF View)
            </span>
            <span className="text-xs text-[#8c828a]">
              Exact Prashmax Event Details Flyer format
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-8 gap-1.5 border-[#40343e] bg-[#1b181d] text-xs font-medium text-[#f7f0ee] hover:bg-[#252028] transition-colors"
              title="Print document or Save as PDF"
            >
              <Printer className="size-3.5 text-[#d9b98c]" />
              Print / Save PDF
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenPrintableTab}
              className="h-8 gap-1.5 border-[#40343e] bg-[#1b181d] text-xs font-medium text-[#f7f0ee] hover:bg-[#252028] transition-colors"
              title="Open printable sheet in a clean browser window"
            >
              <ExternalLink className="size-3.5 text-[#71d8aa]" />
              Open Clean PDF Tab
            </Button>

            {onOpenWhatsApp && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenWhatsApp();
                }}
                className="h-8 gap-1.5 bg-[#25D366] text-black hover:bg-[#20ba59] font-medium text-xs shadow-sm transition-colors"
                title="Send this event details to assigned crew on WhatsApp"
              >
                <MessageSquare className="size-3.5" />
                WhatsApp
              </Button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#8c828a] hover:bg-white/10 hover:text-white transition-colors ml-1"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Quick Edit Bar (Client Name / Contact) */}
        <div className="no-print rounded-xl border border-[#30282e] bg-[#100d11] p-3 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label htmlFor="pdf-client-name" className="text-[10px] uppercase font-semibold text-[#82767d]">Client Name</label>
              <Input
                id="pdf-client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-7 text-xs border-[#40343e] bg-[#161217] text-[#f7f0ee]"
                placeholder="e.g. MEGHANA + PRAVEEN"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label htmlFor="pdf-client-contact" className="text-[10px] uppercase font-semibold text-[#82767d]">Contact Number</label>
              <Input
                id="pdf-client-contact"
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
                className="h-7 text-xs border-[#40343e] bg-[#161217] text-[#f7f0ee]"
                placeholder="e.g. MR. PRAVEEN – 99597 44907"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1 rounded-md border border-[#30282e] bg-[#1a161c] px-2.5 py-1 text-[11px] text-[#d9b98c] hover:bg-[#252028]"
            >
              {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>
        </div>

        {/* PRINTABLE PDF SHEET (EXACT PRASHMAX PHOTOGRAPHY FORMAT) */}
        <div className="p-1 sm:p-3 bg-[#0d0a0d] rounded-xl overflow-x-auto flex justify-center">
          <div
            id="ta-event-details-printable-sheet"
            className="w-full max-w-[620px] bg-white text-[#111827] shadow-2xl rounded-sm font-sans select-text border border-gray-200"
            style={{
              minHeight: "780px",
              color: "#111827",
              backgroundColor: "#ffffff",
            }}
          >
            {/* RED TOP HEADER BANNER */}
            <div
              className="header-banner flex items-center justify-between px-6 sm:px-8 py-5 text-white"
              style={{ backgroundColor: "#d11a2a" }}
            >
              {/* Studio Logo Branding */}
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-white/15 border border-white/30 backdrop-blur-sm shadow-inner">
                  <Camera className="size-6 text-white" />
                </div>
                <div>
                  <h1 className="logo-title font-sans text-xl sm:text-2xl font-black tracking-wider uppercase leading-none text-white">
                    TA BRIDALS
                  </h1>
                  <p className="logo-sub text-[8.5px] font-bold tracking-[0.28em] uppercase text-white/90 mt-1">
                    PHOTOGRAPHY & CINEMATOGRAPHY
                  </p>
                </div>
              </div>

              {/* EVENT DETAILS Title */}
              <div>
                <h2 className="header-right font-sans text-2xl sm:text-3xl font-black tracking-wide uppercase text-white">
                  EVENT DETAILS
                </h2>
              </div>
            </div>

            {/* BODY CONTENT */}
            <div className="sheet-body px-7 sm:px-10 py-7 text-[14.5px] leading-relaxed text-[#111827] space-y-4">
              {/* Dear Team Greeting */}
              <div className="greeting space-y-1">
                <p className="font-bold text-[#111827]">*Dear Team*,</p>
                <p className="text-[#111827]">
                  Please find below <strong className="font-bold text-[#111827]">* {formattedDate} *</strong> event details.
                </p>
              </div>

              {/* CLIENT INFO */}
              <div className="client-block space-y-1.5 pt-1">
                <p className="item-row font-medium text-[#111827]">
                  CLIENT NAME :{" "}
                  <strong className="client-name font-black text-[#16a34a] text-[15.5px]">
                    * {clientName.toUpperCase()} *
                  </strong>
                </p>
                <p className="item-row font-medium text-[#111827]">
                  CONTACT NUMBER :{" "}
                  <strong className="font-black text-[#111827]">
                    * {clientContact.toUpperCase()} *
                  </strong>
                </p>
              </div>

              {/* EVENT DETAILS */}
              <div className="space-y-1 pt-1">
                <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                  * EVENT DETAILS *
                </h3>
                <p className="item-row font-medium text-[#111827]">
                  EVENT DATE : <strong className="font-black text-[#111827]">* {formattedDate.toUpperCase()} *</strong>
                </p>
                <p className="item-row font-medium text-[#111827]">
                  EVENT :{" "}
                  <strong className="event-type font-black text-[#7e22ce] text-[15.5px]">
                    * {shoot.event_type.toUpperCase()} *
                  </strong>
                </p>
                <p className="item-row font-medium text-[#111827]">
                  REPORTING TIME : <strong className="font-black text-[#111827]">* {formattedTime} *</strong>
                </p>
              </div>

              {/* VENUE */}
              <div className="space-y-1 pt-1">
                <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                  * VENUE *
                </h3>
                {shoot.venue && (
                  <p className="venue-row font-medium text-[#111827] leading-snug">
                    {shoot.venue}
                  </p>
                )}
                {shoot.location && shoot.location !== shoot.venue && (
                  <p className="venue-row text-[#374151] leading-snug">
                    {shoot.location}
                  </p>
                )}
                {!shoot.venue && !shoot.location && (
                  <p className="venue-row italic text-[#6b7280]">
                    Venue details available on request / TBA
                  </p>
                )}
              </div>

              {/* PHOTOGRAPHERS */}
              {photographers.length > 0 && (
                <div className="space-y-1 pt-1">
                  <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                    * PHOTOGRAPHERS *
                  </h3>
                  <div className="crew-list space-y-1">
                    {photographers.map((p, idx) => {
                      const cls = photoClassifications[p.member.id];
                      const tag = cls ? `[ ${cls.toLowerCase()} ]` : `[ candid ]`;
                      const phone = p.phoneInfo.displayFormatted || p.member.phone || "Phone on file";
                      return (
                        <p key={p.member.id} className="crew-item font-medium text-[#111827]">
                          {idx + 1}. Mr. {p.member.full_name.toUpperCase()} {tag}( {phone} )
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIDEOGRAPHERS */}
              {videographers.length > 0 && (
                <div className="space-y-1 pt-1">
                  <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                    * {videographers.length === 1 ? "VIDEOGRAPHER" : "VIDEOGRAPHERS"} *
                  </h3>
                  <div className="crew-list space-y-1">
                    {videographers.map((v, idx) => {
                      const phone = v.phoneInfo.displayFormatted || v.member.phone || "Phone on file";
                      return (
                        <p key={v.member.id} className="crew-item font-medium text-[#111827]">
                          {idx + 1}. Mr. {v.member.full_name.toUpperCase()} ( {phone} )
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DRONE OPERATORS */}
              {droneOperators.length > 0 && (
                <div className="space-y-1 pt-1">
                  <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                    * {droneOperators.length === 1 ? "DRONE OPERATOR" : "DRONE OPERATORS"} *
                  </h3>
                  <div className="crew-list space-y-1">
                    {droneOperators.map((d, idx) => {
                      const phone = d.phoneInfo.displayFormatted || d.member.phone || "Phone on file";
                      return (
                        <p key={d.member.id} className="crew-item font-medium text-[#111827]">
                          {idx + 1}. Mr. {d.member.full_name.toUpperCase()} ( {phone} )
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CINEMATOGRAPHERS */}
              {cinematographers.length > 0 && (
                <div className="space-y-1 pt-1">
                  <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                    * {cinematographers.length === 1 ? "CINEMATOGRAPHER" : "CINEMATOGRAPHERS"} *
                  </h3>
                  <div className="crew-list space-y-1">
                    {cinematographers.map((c, idx) => {
                      const phone = c.phoneInfo.displayFormatted || c.member.phone || "Phone on file";
                      return (
                        <p key={c.member.id} className="crew-item font-medium text-[#111827]">
                          {idx + 1}. Mr. {c.member.full_name.toUpperCase()} ( {phone} )
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* OTHERS */}
              {others.length > 0 && (
                <div className="space-y-1 pt-1">
                  <h3 className="section-title font-black text-[#1d4ed8] text-[15px] uppercase tracking-wide">
                    * OTHERS *
                  </h3>
                  <div className="crew-list space-y-1">
                    {others.map((o, idx) => {
                      const phone = o.phoneInfo.displayFormatted || o.member.phone || "Phone on file";
                      return (
                        <p key={o.member.id} className="crew-item font-medium text-[#111827]">
                          {idx + 1}. Mr. {o.member.full_name.toUpperCase()} [ {o.member.role} ]( {phone} )
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#30282e] pt-3 no-print">
          <p className="text-xs text-[#8c828a]">
            Click <strong className="text-[#d9b98c]">Print / Save PDF</strong> to generate an instant printable A4 PDF flyer via your browser.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#40343e] text-xs text-[#b8adb2] hover:bg-white/5"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              className="bg-[#d11a2a] hover:bg-[#b91c1c] text-white font-medium text-xs gap-1.5 shadow-md"
            >
              <Printer className="size-3.5" />
              Print / Save PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
