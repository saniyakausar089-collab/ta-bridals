import { useState, useRef, useEffect, useMemo } from "react";
import {
  Bell,
  UserCheck,
  CalendarClock,
  Camera,
  DollarSign,
  Music2,
  X,
  ExternalLink,
  Clock3,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import type { ProfileRecord } from "@/lib/auth";
import type { AvailabilityRequest } from "@/lib/audit";
import type { OperatingExpenseRecord, PayrollObligationRecord } from "@/lib/finance";
import type { calculateStaffingMetrics } from "@/lib/scheduling";

type Shoot = Tables<"shoots">;

export type Section =
  | "overview"
  | "shoots"
  | "calendar"
  | "team"
  | "availability"
  | "finance"
  | "analytics"
  | "approvals"
  | "audit"
  | "songs";

interface NotificationItem {
  id: string;
  category: "registration" | "leave" | "shoot" | "expense" | "payroll" | "songs";
  title: string;
  subtitle: string;
  time?: string | undefined;
  targetSection: Section;
  severity: "danger" | "warning" | "info";
}

export function NotificationBadge({
  count,
  variant = "danger",
  className = "",
}: {
  count: number;
  variant?: "danger" | "warning" | "neutral" | "info";
  className?: string;
}) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);

  const variantStyles = {
    danger: "bg-[#e53958] text-white shadow-[0_0_8px_rgba(229,57,88,0.45)]",
    warning: "bg-[#e07a38] text-white shadow-[0_0_8px_rgba(224,122,56,0.35)]",
    neutral: "bg-[#453c43] text-[#f7f0ee]",
    info: "bg-[#344234] text-white",
  }[variant];

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none select-none tracking-tight transition-transform duration-150 animate-in fade-in zoom-in-75 ${variantStyles} ${className}`}
      aria-label={`${count} pending requests`}
    >
      {label}
    </span>
  );
}

interface AdminNotificationCenterProps {
  pendingRegistrations: ProfileRecord[];
  pendingAvailability: AvailabilityRequest[];
  understaffedShoots: { shoot: Shoot; metrics: ReturnType<typeof calculateStaffingMetrics> }[];
  pendingExpenses: OperatingExpenseRecord[];
  pendingPayroll: PayrollObligationRecord[];
  pendingSongClientsCount: number;
  onNavigate: (section: Section) => void;
}

export function AdminNotificationCenter({
  pendingRegistrations,
  pendingAvailability,
  understaffedShoots,
  pendingExpenses,
  pendingPayroll,
  pendingSongClientsCount,
  onNavigate,
}: AdminNotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    // 1. Pending Team Registrations
    for (const reg of pendingRegistrations) {
      if (reg.approval_status === "pending") {
        list.push({
          id: `reg-${reg.user_id}`,
          category: "registration",
          title: reg.display_name || "Applicant",
          subtitle: `Team member registration awaiting review (${reg.email || "No email"})`,
          time: reg.created_at ? format(parseISO(reg.created_at), "MMM d, h:mm a") : undefined,
          targetSection: "approvals",
          severity: "danger",
        });
      }
    }

    // 2. Pending Leave & Availability Requests
    for (const req of pendingAvailability) {
      if (req.status === "pending") {
        const typeLabel = req.request_type === "leave" ? "Leave request" : "Availability window";
        const reasonText = req.reason ? ` · "${req.reason}"` : "";
        list.push({
          id: `avail-${req.id}`,
          category: "leave",
          title: req.worker_name,
          subtitle: `${typeLabel}: ${req.start_date} to ${req.end_date}${reasonText}`,
          time: req.created_at ? format(parseISO(req.created_at), "MMM d, h:mm a") : undefined,
          targetSection: "availability",
          severity: "warning",
        });
      }
    }

    // 3. Shoots Requiring Crew (Understaffed)
    for (const { shoot, metrics } of understaffedShoots) {
      list.push({
        id: `shoot-${shoot.id}`,
        category: "shoot",
        title: shoot.couple_name,
        subtitle: `${shoot.event_type} on ${shoot.event_date} · ${metrics.remainingRequired} more crew required (${metrics.assignedCrew}/${metrics.plannedTeamSize} on-site)`,
        time: shoot.start_time ? `Starts at ${shoot.start_time.slice(0, 5)}` : undefined,
        targetSection: "shoots",
        severity: "warning",
      });
    }

    // 4. Financial Reviews: Operating Expenses
    for (const exp of pendingExpenses) {
      if (exp.status === "submitted") {
        list.push({
          id: `exp-${exp.id}`,
          category: "expense",
          title: `Expense ${exp.expense_number}`,
          subtitle: `${exp.payee_supplier} (${exp.category}) · ₹${exp.amount.toLocaleString("en-IN")}`,
          time: exp.expense_date ? format(parseISO(exp.expense_date), "MMM d, h:mm a") : undefined,
          targetSection: "finance",
          severity: "warning",
        });
      }
    }

    // 5. Financial Reviews: Payroll Obligations
    for (const pr of pendingPayroll) {
      if (pr.status === "submitted") {
        list.push({
          id: `pr-${pr.id}`,
          category: "payroll",
          title: `Payroll: ${pr.period_label}`,
          subtitle: `Obligation submitted · Net payable: ₹${pr.net_payable.toLocaleString("en-IN")}`,
          time: pr.created_at ? format(parseISO(pr.created_at), "MMM d, h:mm a") : undefined,
          targetSection: "finance",
          severity: "warning",
        });
      }
    }

    // 6. Client Song Portal Registrations
    if (pendingSongClientsCount > 0) {
      list.push({
        id: "song-clients-pending",
        category: "songs",
        title: "Song Library Client Signups",
        subtitle: `${pendingSongClientsCount} wedding client ${
          pendingSongClientsCount === 1 ? "profile is" : "profiles are"
        } awaiting approval.`,
        targetSection: "songs",
        severity: "info",
      });
    }

    return list;
  }, [
    pendingRegistrations,
    pendingAvailability,
    understaffedShoots,
    pendingExpenses,
    pendingPayroll,
    pendingSongClientsCount,
  ]);

  const totalCount = notifications.length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
    return undefined;
  }, [isOpen]);

  function handleSelect(item: NotificationItem) {
    setIsOpen(false);
    onNavigate(item.targetSection);
  }

  const categoryIcons = {
    registration: <UserCheck className="size-4 text-rose-400" />,
    leave: <CalendarClock className="size-4 text-amber-400" />,
    shoot: <Camera className="size-4 text-amber-400" />,
    expense: <DollarSign className="size-4 text-emerald-400" />,
    payroll: <DollarSign className="size-4 text-emerald-400" />,
    songs: <Music2 className="size-4 text-purple-400" />,
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Studio notifications, ${totalCount} pending review`}
        aria-expanded={isOpen}
        className="relative grid size-9 place-items-center rounded-xl border border-[#dedbd2] bg-[#fbfaf7] text-[#555a52] transition-colors hover:bg-[#edebe2] hover:text-[#2d382d]"
      >
        <Bell className="size-4" />
        {totalCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5">
            <NotificationBadge count={totalCount} variant="danger" />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Pending review notifications"
          className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-2xl border border-[#30282e] bg-[#151317] p-4 text-[#f7f0ee] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-[#30282e] pb-3">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base text-[#f7f0ee]">Studio Action Center</span>
              {totalCount > 0 && (
                <span className="rounded-full bg-[#762d40]/40 px-2 py-0.5 text-[10px] font-semibold text-[#e7a0ad] border border-[#762d40]/60">
                  {totalCount} pending
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[#82767d] hover:bg-white/5 hover:text-[#f7f0ee]"
              aria-label="Close notification center"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#82767d]">
                <CheckCircle2 className="mx-auto size-7 text-[#71d8aa] opacity-75 mb-2" />
                <p className="font-medium text-[#f7f0ee]">All caught up!</p>
                <p className="mt-1 text-[11px]">
                  No pending team requests, approvals, or staffing gaps.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelect(item);
                    }
                  }}
                  className="group flex cursor-pointer items-start gap-3 rounded-xl border border-[#30282e]/80 bg-[#1c181f] p-3 transition-colors hover:border-[#762d40] hover:bg-[#231e27]"
                >
                  <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-black/40 border border-white/5">
                    {categoryIcons[item.category]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-[#f7f0ee] group-hover:text-[#e7a0ad]">
                        {item.title}
                      </p>
                      {item.time && (
                        <span className="shrink-0 text-[10px] text-[#82767d]">{item.time}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[#b8adb2] line-clamp-2">
                      {item.subtitle}
                    </p>
                  </div>
                  <ExternalLink className="mt-1 size-3 shrink-0 text-[#82767d] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))
            )}
          </div>

          {totalCount > 0 && (
            <div className="mt-3 border-t border-[#30282e] pt-2.5 text-center">
              <span className="text-[10px] text-[#82767d]">
                Clicking a notification directs you to the live review screen.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
