import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Music2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  Activity,
  BarChart3,
  CalendarClock,
  DollarSign,
  History,
  Wallet,
  AlertTriangle,
  Bell,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, getSupabaseConfig } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { AnalyticsSection } from "@/components/AnalyticsSection";
import { AvailabilitySection } from "@/components/AvailabilitySection";
import { AuditLogSection } from "@/components/AuditLogSection";
import { FinanceSection } from "@/components/FinanceSection";
import { SongLibraryAdminSection } from "@/components/SongLibraryAdminSection";
import { NotificationBadge, AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { AccountSettingsModal } from "@/components/AccountSettingsModal";
import {
  formatCurrency,
  calculateStudioTotals,
  type ClientInvoiceRecord,
  type ClientPaymentRecord,
  type PayrollObligationRecord,
  type WorkerPaymentRecord,
  type OperatingExpenseRecord,
} from "@/lib/finance";
import { recordAuditLog, type AuditLog, type AvailabilityRequest } from "@/lib/audit";
import {
  calculateStaffingMetrics,
  doEventsOverlap,
  findAllShootConflicts,
  findWorkerConflicts,
} from "@/lib/scheduling";
import {
  approveRegistration,
  checkUserAccess,
  isOwnerEmail,
  rejectRegistration,
  signUpTeamMember,
  type AccessStatus,
  type ApprovalStatus,
  type ProfileRecord,
} from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type Assignment = Tables<"shoot_assignments">;
type ShootInput = TablesInsert<"shoots">;
type TeamMemberInput = TablesInsert<"team_members">;
type AssignmentInput = Pick<Assignment, "team_member_id" | "assignment_type">;
type Section =
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

const baseNavigation: {
  id: Section;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Dashboard", mobileLabel: "Home", icon: LayoutDashboard },
  { id: "shoots", label: "All Shoots", mobileLabel: "Shoots", icon: Camera },
  { id: "calendar", label: "Calendar", mobileLabel: "Calendar", icon: CalendarDays },
  { id: "team", label: "Team Overview", mobileLabel: "Team", icon: Users },
  { id: "availability", label: "Availability", mobileLabel: "Availability", icon: CalendarClock },
  { id: "songs", label: "Song Libraries", mobileLabel: "Songs", icon: Music2 },
];

const sectionCopy: Record<Section, { title: string; description: string }> = {
  overview: {
    title: "Your studio at a glance",
    description: "A clear view of what's happening across your team.",
  },
  shoots: {
    title: "All shoots",
    description: "Search and keep track of every upcoming celebration.",
  },
  calendar: {
    title: "Studio calendar",
    description: "See what's coming up and plan your team's schedule.",
  },
  team: {
    title: "Your team",
    description: "The people who make every celebration unforgettable.",
  },
  availability: {
    title: "Availability & Leave",
    description: "Manage working windows, unavailable dates, and crew leave requests.",
  },
  finance: {
    title: "Finance & ERP Ledger",
    description: "Invoicing, crew compensation, operating expenses, and event-level profitability.",
  },
  analytics: {
    title: "Workload & Team Analytics",
    description: "Data-driven staffing coverage, role distribution, and workload volume.",
  },
  approvals: {
    title: "Team registrations",
    description: "Review pending signups and manage studio workspace permissions.",
  },
  audit: {
    title: "Audit Log",
    description: "Comprehensive trail of administrative actions and record changes.",
  },
  songs: {
    title: "Song Libraries & Client Approvals",
    description: "Approve wedding clients, organize custom song libraries, and assign playlists.",
  },
};

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessStatus>("checking");
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileName, setProfileName] = useState("Studio owner");
  const [authError, setAuthError] = useState("");
  const [checkingPending, setCheckingPending] = useState(false);

  const [section, setSection] = useState<Section>("overview");
  const [globalQuery, setGlobalQuery] = useState("");
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [registrations, setRegistrations] = useState<ProfileRecord[]>([]);
  const [availabilityRequests, setAvailabilityRequests] = useState<AvailabilityRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoiceRecord[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPaymentRecord[]>([]);
  const [payroll, setPayroll] = useState<PayrollObligationRecord[]>([]);
  const [workerPayments, setWorkerPayments] = useState<WorkerPaymentRecord[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpenseRecord[]>([]);
  const [pendingSongClientsCount, setPendingSongClientsCount] = useState(0);
  const [dataError, setDataError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        setAccess("signed-out");
        setIsAdmin(false);
      } else {
        setAccess("checking");
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setAuthError(error.message);
          setAccess("signed-out");
          return;
        }
        setSession(data.session);
        if (!data.session) setAccess("signed-out");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAuthError(error instanceof Error ? error.message : "Could not restore your session.");
        setAccess("signed-out");
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const evaluateAccess = useCallback(async (currentSession: Session) => {
    try {
      const result = await checkUserAccess(currentSession);
      // Route guard: Clients can ONLY open the song library route and are blocked from all admin/team pages
      if (result.role === "client") {
        if (typeof window !== "undefined") {
          window.location.href = "/client";
        }
        return;
      }
      setAccess(result.status);
      setIsAdmin(result.isAdmin);
      setProfileName(result.displayName);
      if (result.errorMessage && result.status === "allowed") {
        setDataError(result.errorMessage);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "We couldn't verify your studio access.",
      );
      setAccess("signed-out");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void evaluateAccess(session);
  }, [session, evaluateAccess]);

  const handleCheckPendingStatus = useCallback(async () => {
    if (!session) return;
    setCheckingPending(true);
    await evaluateAccess(session);
    setCheckingPending(false);
  }, [session, evaluateAccess]);

  const loadWorkspace = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [
        shootResult,
        teamResult,
        assignmentResult,
        regResult,
        availResult,
        auditResult,
        invResult,
        cpResult,
        prResult,
        wpResult,
        expResult,
        songClientsResult,
      ] = await Promise.all([
        supabase.from("shoots").select("*").order("event_date", { ascending: true }),
        supabase.from("team_members").select("*").order("full_name", { ascending: true }),
        supabase.from("shoot_assignments").select("*"),
        isAdmin
          ? supabase.from("profiles").select("*").order("created_at", { ascending: false })
          : Promise.resolve({ data: null, error: null }),
        supabase.from("availability_requests").select("*").order("start_date", { ascending: true }),
        isAdmin
          ? supabase
              .from("audit_logs")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: null, error: null }),
        isAdmin
          ? (supabase
              .from("client_invoices" as any)
              .select("*")
              .order("issue_date", { ascending: false }) as any)
          : Promise.resolve({ data: null, error: null }),
        isAdmin
          ? (supabase
              .from("client_payments" as any)
              .select("*")
              .order("payment_date", { ascending: false }) as any)
          : Promise.resolve({ data: null, error: null }),
        isAdmin
          ? (supabase
              .from("payroll_obligations" as any)
              .select("*")
              .order("created_at", { ascending: false }) as any)
          : Promise.resolve({ data: null, error: null }),
        isAdmin
          ? (supabase
              .from("worker_payments" as any)
              .select("*")
              .order("disbursement_date", { ascending: false }) as any)
          : Promise.resolve({ data: null, error: null }),
        isAdmin
          ? (supabase
              .from("operating_expenses" as any)
              .select("*")
              .order("expense_date", { ascending: false }) as any)
          : Promise.resolve({ data: null, error: null }),
        isAdmin
          ? (supabase
              .from("client_profiles" as any)
              .select("*", { count: "exact", head: true })
              .eq("approval_status", "pending") as any)
          : Promise.resolve({ count: 0, data: null, error: null }),
      ]);

      if (shootResult.error) throw shootResult.error;
      if (teamResult.error) throw teamResult.error;
      if (assignmentResult.error) throw assignmentResult.error;

      setShoots(shootResult.data ?? []);
      setTeam(teamResult.data ?? []);
      setAssignments(assignmentResult.data ?? []);

      if (regResult?.data) {
        setRegistrations(regResult.data as unknown as ProfileRecord[]);
      }
      if (availResult?.data) {
        setAvailabilityRequests(availResult.data as unknown as AvailabilityRequest[]);
      }
      if (auditResult?.data) {
        setAuditLogs(auditResult.data as unknown as AuditLog[]);
      }

      setInvoices(invResult?.data ? (invResult.data as unknown as ClientInvoiceRecord[]) : []);
      setClientPayments(cpResult?.data ? (cpResult.data as unknown as ClientPaymentRecord[]) : []);
      setPayroll(prResult?.data ? (prResult.data as unknown as PayrollObligationRecord[]) : []);
      setWorkerPayments(wpResult?.data ? (wpResult.data as unknown as WorkerPaymentRecord[]) : []);
      setExpenses(expResult?.data ? (expResult.data as unknown as OperatingExpenseRecord[]) : []);
      setPendingSongClientsCount(songClientsResult?.count ?? 0);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "We couldn't load your studio data.");
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  async function saveShoot(
    values: ShootInput,
    crewAssignments?: AssignmentInput[],
    shootId?: string,
  ) {
    if (!isAdmin) throw new Error("Only the studio owner can save shoots.");
    if (!session) throw new Error("Sign in as the studio owner to save shoots.");

    const payload = shootId ? { ...values } : { ...values, created_by: session.user.id };

    const result = shootId
      ? await supabase.from("shoots").update(payload).eq("id", shootId).select().single()
      : await supabase.from("shoots").insert(payload).select().single();

    if (result.error) {
      throw new Error(
        `Failed to save shoot: ${result.error.message || result.error.details || "Database error"}`,
      );
    }

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: shootId ? "SHOOT_UPDATED" : "SHOOT_CREATED",
      recordType: "shoot",
      recordId: result.data.id,
      details: { couple: result.data.couple_name, event_type: result.data.event_type },
    });

    if (crewAssignments !== undefined) {
      try {
        const { error: assignError } = await supabase.rpc("replace_shoot_assignments", {
          p_shoot_id: result.data.id,
          p_assignments: crewAssignments,
        });

        if (assignError) {
          console.warn(
            "replace_shoot_assignments RPC error, applying direct table fallback:",
            assignError,
          );
          // Direct fallback if RPC is missing in remote database
          await supabase.from("shoot_assignments").delete().eq("shoot_id", result.data.id);
          if (crewAssignments.length > 0) {
            const rows = crewAssignments.map((c) => ({
              shoot_id: result.data.id,
              team_member_id: c.team_member_id,
              assignment_type: c.assignment_type || "on_site",
            }));
            await supabase.from("shoot_assignments").insert(rows);
          }
        }
      } catch (rpcErr) {
        console.warn("RPC invocation exception, fallback directly to table:", rpcErr);
        await supabase.from("shoot_assignments").delete().eq("shoot_id", result.data.id);
        if (crewAssignments.length > 0) {
          const rows = crewAssignments.map((c) => ({
            shoot_id: result.data.id,
            team_member_id: c.team_member_id,
            assignment_type: c.assignment_type || "on_site",
          }));
          await supabase.from("shoot_assignments").insert(rows);
        }
      }

      const { data: updatedAssignments, error: loadError } = await supabase
        .from("shoot_assignments")
        .select("*");
      if (!loadError && updatedAssignments) {
        setAssignments(updatedAssignments);
      }
    }

    setShoots((current) =>
      [...current.filter((shoot) => shoot.id !== result.data.id), result.data].sort((a, b) =>
        a.event_date.localeCompare(b.event_date),
      ),
    );
  }

  async function deleteShoot(shootId: string) {
    if (!isAdmin) throw new Error("Only the studio owner can delete shoots.");
    if (!session) throw new Error("Sign in as the studio owner to delete shoots.");

    const shootToDelete = shoots.find((s) => s.id === shootId);
    const { error } = await supabase.from("shoots").delete().eq("id", shootId);
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "SHOOT_DELETED",
      recordType: "shoot",
      recordId: shootId,
      details: { couple: shootToDelete?.couple_name },
    });

    setShoots((current) => current.filter((shoot) => shoot.id !== shootId));
    setAssignments((current) => current.filter((assignment) => assignment.shoot_id !== shootId));
  }

  async function saveShootAssignments(shootId: string, values: AssignmentInput[]) {
    if (!isAdmin) throw new Error("Only the studio owner can manage shoot assignments.");
    if (!session) throw new Error("Sign in as the studio owner to manage shoot assignments.");

    try {
      const { error } = await supabase.rpc("replace_shoot_assignments", {
        p_shoot_id: shootId,
        p_assignments: values,
      });
      if (error) {
        console.warn("replace_shoot_assignments RPC error, applying direct table fallback:", error);
        await supabase.from("shoot_assignments").delete().eq("shoot_id", shootId);
        if (values.length > 0) {
          const rows = values.map((c) => ({
            shoot_id: shootId,
            team_member_id: c.team_member_id,
            assignment_type: c.assignment_type || "on_site",
          }));
          await supabase.from("shoot_assignments").insert(rows);
        }
      }
    } catch {
      await supabase.from("shoot_assignments").delete().eq("shoot_id", shootId);
      if (values.length > 0) {
        const rows = values.map((c) => ({
          shoot_id: shootId,
          team_member_id: c.team_member_id,
          assignment_type: c.assignment_type || "on_site",
        }));
        await supabase.from("shoot_assignments").insert(rows);
      }
    }

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "ASSIGNMENTS_UPDATED",
      recordType: "shoot_assignments",
      recordId: shootId,
      details: { assignmentCount: values.length },
    });

    const { data, error: loadError } = await supabase.from("shoot_assignments").select("*");
    if (loadError) throw loadError;
    setAssignments(data ?? []);
  }

  async function saveTeamMember(values: TeamMemberInput, memberId?: string) {
    if (!isAdmin) throw new Error("Only the studio owner can save team members.");
    if (!session) throw new Error("Sign in as the studio owner to save team members.");

    const result = memberId
      ? await supabase.from("team_members").update(values).eq("id", memberId).select().single()
      : await supabase.from("team_members").insert(values).select().single();
    if (result.error) throw result.error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: memberId ? "WORKER_UPDATED" : "WORKER_ADDED",
      recordType: "team_member",
      recordId: result.data.id,
      details: { name: result.data.full_name, role: result.data.role },
    });

    setTeam((current) =>
      [...current.filter((member) => member.id !== result.data.id), result.data].sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      ),
    );
  }

  async function deleteTeamMember(memberId: string) {
    if (!isAdmin) throw new Error("Only the studio owner can remove team members.");
    if (!session) throw new Error("Sign in as the studio owner to remove team members.");

    const memberToDelete = team.find((m) => m.id === memberId);
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "WORKER_REMOVED",
      recordType: "team_member",
      recordId: memberId,
      details: { name: memberToDelete?.full_name },
    });

    setTeam((current) => current.filter((member) => member.id !== memberId));
    setAssignments((current) =>
      current.filter((assignment) => assignment.team_member_id !== memberId),
    );
  }

  async function submitAvailabilityRequest(input: any) {
    if (!session) throw new Error("You must be signed in to submit availability requests.");
    const { error } = await supabase.from("availability_requests").insert({
      ...input,
      user_id: session.user.id,
      status: "pending",
    });
    if (error) throw error;
    await loadWorkspace();
  }

  async function reviewAvailabilityRequest(requestId: string, status: "approved" | "rejected") {
    if (!isAdmin) throw new Error("Only administrators can review availability requests.");
    if (!session) throw new Error("Sign in as an administrator to review requests.");

    const { error } = await supabase
      .from("availability_requests")
      .update({
        status,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: status === "approved" ? "AVAILABILITY_APPROVED" : "AVAILABILITY_REJECTED",
      recordType: "availability_request",
      recordId: requestId,
      details: { status },
    });

    await loadWorkspace();
  }

  // ERP & Finance Ledger Handlers
  async function handleCreateInvoice(input: any) {
    if (!session) throw new Error("Sign in required.");
    const { data, error } = await supabase
      .from("client_invoices" as any)
      .insert(input)
      .select()
      .single();
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "INVOICE_CREATED",
      recordType: "client_invoice",
      recordId: (data as any)?.id,
      details: { invoice_number: (data as any)?.invoice_number, amount: input.agreed_price },
    });

    await loadWorkspace();
  }

  async function handleRecordClientPayment(input: any) {
    if (!session) throw new Error("Sign in required.");
    const { data, error } = await supabase
      .from("client_payments" as any)
      .insert(input)
      .select()
      .single();
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "PAYMENT_RECORDED",
      recordType: "client_payment",
      recordId: (data as any)?.id,
      details: { amount: input.amount, receipt_number: (data as any)?.receipt_number },
    });

    await loadWorkspace();
  }

  async function handleCreatePayrollObligation(input: any) {
    if (!session) throw new Error("Sign in required.");
    const net = Math.max(
      0,
      Number(input.base_amount || 0) +
        Number(input.allowance_amount || 0) -
        Number(input.deduction_amount || 0),
    );

    const { data, error } = await supabase
      .from("payroll_obligations" as any)
      .insert({ ...input, net_payable: net, balance_due: net, status: "approved" })
      .select()
      .single();
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "COMPENSATION_APPROVED",
      recordType: "payroll_obligation",
      recordId: (data as any)?.id,
      details: { net_payable: net, worker_id: input.worker_id },
    });

    await loadWorkspace();
  }

  async function handleDisburseWorkerPayment(input: any) {
    if (!session) throw new Error("Sign in required.");
    const { data, error } = await supabase
      .from("worker_payments" as any)
      .insert(input)
      .select()
      .single();
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "PAYROLL_DISBURSED",
      recordType: "worker_payment",
      recordId: (data as any)?.id,
      details: { amount: input.amount, voucher: (data as any)?.payment_voucher_no },
    });

    await loadWorkspace();
  }

  async function handleRecordExpense(input: any) {
    if (!session) throw new Error("Sign in required.");
    const amount = Number(input.amount);
    const isPaid = input.payment_status === "paid";

    const { data, error } = await supabase
      .from("operating_expenses" as any)
      .insert({
        ...input,
        amount,
        amount_paid: isPaid ? amount : 0,
        status: "approved",
      })
      .select()
      .single();
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "EXPENSE_RECORDED",
      recordType: "operating_expense",
      recordId: (data as any)?.id,
      details: { category: input.category, amount },
    });

    await loadWorkspace();
  }

  async function handleApprovePayroll(obligationId: string) {
    if (!isAdmin || !session) return;
    const { error } = await supabase
      .from("payroll_obligations" as any)
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", obligationId);
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "COMPENSATION_APPROVED",
      recordType: "payroll_obligation",
      recordId: obligationId,
      details: { status: "approved" },
    });

    await loadWorkspace();
  }

  async function handleApproveExpense(expenseId: string) {
    if (!isAdmin || !session) return;
    const { error } = await supabase
      .from("operating_expenses" as any)
      .update({ status: "approved" })
      .eq("id", expenseId);
    if (error) throw error;

    void recordAuditLog({
      actorId: session.user.id,
      actorName: profileName,
      actorEmail: session.user.email,
      action: "EXPENSE_APPROVED",
      recordType: "operating_expense",
      recordId: expenseId,
      details: { status: "approved" },
    });

    await loadWorkspace();
  }

  useEffect(() => {
    if (access !== "allowed" || !session) return;
    void loadWorkspace();

    const channel = supabase
      .channel("studio-workspace-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shoots" }, () => {
        void loadWorkspace();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shoot_assignments" }, () => {
        void loadWorkspace();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => {
        void loadWorkspace();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void loadWorkspace();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability_requests" },
        () => {
          void loadWorkspace();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "operating_expenses" }, () => {
        void loadWorkspace();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payroll_obligations" },
        () => {
          void loadWorkspace();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "client_profiles" }, () => {
        void loadWorkspace();
      })
      .subscribe();

    const handleFocus = () => {
      void loadWorkspace();
    };
    window.addEventListener("focus", handleFocus);

    const pollInterval = window.setInterval(() => {
      void loadWorkspace();
    }, 60000);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(pollInterval);
    };
  }, [access, session, loadWorkspace]);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(`Could not sign out: ${error.message}`);
      return;
    }
    setSession(null);
    setAccess("signed-out");
    setIsAdmin(false);
    setShoots([]);
    setTeam([]);
    setAssignments([]);
    setRegistrations([]);
    setInvoices([]);
    setClientPayments([]);
    setPayroll([]);
    setWorkerPayments([]);
    setExpenses([]);
  }

  if (session && access === "pending") {
    return (
      <PendingApprovalScreen
        displayName={profileName}
        email={session.user.email || ""}
        checkingStatus={checkingPending}
        onCheckStatus={() => void handleCheckPendingStatus()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  if (session && access === "rejected") {
    return (
      <RejectedScreen
        displayName={profileName}
        email={session.user.email || ""}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  if (!session || access === "signed-out") {
    return <AuthScreen error={authError} onDismissError={() => setAuthError("")} />;
  }

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f7f4] text-[#4c514c]">
        <div className="flex items-center gap-3 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking your studio access…
        </div>
      </main>
    );
  }

  return (
    <Workspace
      section={section}
      onSectionChange={setSection}
      globalQuery={globalQuery}
      onGlobalQueryChange={setGlobalQuery}
      profileName={profileName}
      isAdmin={isAdmin}
      shoots={shoots}
      team={team}
      assignments={assignments}
      registrations={registrations}
      onRegistrationsChange={setRegistrations}
      loading={loadingData}
      error={dataError}
      onRefresh={() => void loadWorkspace()}
      onSignOut={() => void handleSignOut()}
      onSaveShoot={saveShoot}
      onDeleteShoot={deleteShoot}
      onSaveAssignments={saveShootAssignments}
      onSaveTeamMember={saveTeamMember}
      onDeleteTeamMember={deleteTeamMember}
      availabilityRequests={availabilityRequests}
      auditLogs={auditLogs}
      currentUserId={session?.user?.id}
      currentUserEmail={session?.user?.email}
      pendingSongClientsCount={pendingSongClientsCount}
      onSubmitAvailabilityRequest={submitAvailabilityRequest}
      onReviewAvailabilityRequest={reviewAvailabilityRequest}
      invoices={invoices}
      clientPayments={clientPayments}
      payroll={payroll}
      workerPayments={workerPayments}
      expenses={expenses}
      onCreateInvoice={handleCreateInvoice}
      onRecordClientPayment={handleRecordClientPayment}
      onCreatePayrollObligation={handleCreatePayrollObligation}
      onDisburseWorkerPayment={handleDisburseWorkerPayment}
      onRecordExpense={handleRecordExpense}
      onApprovePayroll={handleApprovePayroll}
      onApproveExpense={handleApproveExpense}
    />
  );
}

function AuthScreen({
  error: externalError,
  onDismissError,
}: {
  error: string;
  onDismissError: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [internalError, setInternalError] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const config = getSupabaseConfig();
  const activeError = internalError || externalError;

  function handleModeSwitch(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setInternalError("");
    setNoticeMessage("");
    onDismissError();
  }

  async function handleSignInSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setInternalError("");
    setNoticeMessage("");
    onDismissError();

    try {
      const email = signInEmail.trim();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: signInPassword,
      });

      if (signInError) {
        setInternalError(signInError.message);
      }
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : "We couldn't sign you in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setInternalError("");
    setNoticeMessage("");
    onDismissError();

    try {
      const res = await signUpTeamMember({
        fullName,
        email: signUpEmail,
        password,
        confirmPassword,
      });

      if (!res.success) {
        setInternalError(res.error || "Unable to complete registration.");
        return;
      }

      if (res.requiresEmailConfirmation) {
        setNoticeMessage(
          res.message ||
            "Account created! Please check your email to confirm your address before your registration can be approved.",
        );
        setPassword("");
        setConfirmPassword("");
      } else {
        setNoticeMessage(
          "Registration submitted! Your account has been received and is waiting for studio owner approval.",
        );
      }
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : "Unable to complete registration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#fbfaf7] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#30382f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_20%,rgba(205,174,126,0.24),transparent_38%),linear-gradient(145deg,transparent_35%,rgba(12,18,12,0.65))]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full border border-white/30">
            <Camera className="size-5" strokeWidth={1.5} />
          </span>
          <span className="font-serif text-xl tracking-wide">TA BRIDALS</span>
        </div>
        <div className="relative max-w-xl pb-6">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#d7c4a5]">
            The studio workspace
          </p>
          <h1 className="font-serif text-5xl leading-[1.13] xl:text-6xl">
            Thoughtfully planned.
            <br />
            <span className="italic text-[#d7c4a5]">Beautifully captured.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/70">
            A quieter way to manage your shoots, your schedule, and the people behind every
            unforgettable moment.
          </p>
        </div>
        <p className="relative text-xs text-white/45">A little more room for the work you love.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[410px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-full bg-[#30382f] text-white">
              <Camera className="size-5" strokeWidth={1.5} />
            </span>
            <span className="font-serif text-lg tracking-wide text-[#30382f]">TA BRIDALS</span>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#eeebe2] p-1 text-xs font-medium text-[#6c6e64]">
            <button
              type="button"
              onClick={() => handleModeSwitch("signin")}
              className={`rounded-lg py-2.5 transition-all ${
                mode === "signin"
                  ? "bg-white text-[#30382f] font-semibold shadow-xs"
                  : "hover:text-[#30382f]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("signup")}
              className={`rounded-lg py-2.5 transition-all ${
                mode === "signup"
                  ? "bg-white text-[#30382f] font-semibold shadow-xs"
                  : "hover:text-[#30382f]"
              }`}
            >
              Create Account
            </button>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b806f]">
            {mode === "signin" ? "Welcome back" : "New team member"}
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#30382f] sm:text-4xl">
            {mode === "signin" ? "Your studio, in sync." : "Join the studio team."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#77786f]">
            {mode === "signin"
              ? "Sign in with your account to access your studio workspace."
              : "Register below. New accounts require owner approval before accessing studio data."}
          </p>

          {!config.isConfigured && (
            <div
              className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900"
              role="alert"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4 text-amber-700" />
                <span>Supabase Configuration Required</span>
              </div>
              <p className="mt-1 leading-5 text-amber-800">
                Studio environment variables <code className="font-mono">VITE_SUPABASE_URL</code>{" "}
                and <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> must be
                configured in your environment before signing in.
              </p>
            </div>
          )}

          {activeError && (
            <div
              className="mt-6 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <span>{activeError}</span>
              <button
                type="button"
                onClick={() => {
                  setInternalError("");
                  onDismissError();
                }}
                className="shrink-0 font-medium underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {noticeMessage && (
            <div
              className="mt-6 flex items-start justify-between gap-3 rounded-lg border border-[#c8ddc2] bg-[#f2f8f0] px-4 py-3 text-sm text-[#385333]"
              role="status"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4c7345]" />
                <span>{noticeMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setNoticeMessage("")}
                className="shrink-0 font-medium underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {mode === "signin" ? (
            <form className="mt-7 space-y-4" onSubmit={handleSignInSubmit}>
              <label className="block space-y-1.5 text-sm font-medium text-[#444941]">
                Studio email address
                <Input
                  className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                  type="email"
                  name="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="owner@tabridals.com or you@example.com"
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-[#444941]">
                Password
                <Input
                  className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                  type="password"
                  name="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </label>

              <Button
                className="mt-2 h-12 w-full rounded-lg bg-[#344234] text-sm text-white hover:bg-[#283528]"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  "Sign in to your studio"
                )}
              </Button>

              <div className="pt-2 text-center text-xs text-[#7d7c73]">
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signup")}
                  className="font-medium text-[#344234] underline underline-offset-2 hover:text-[#1e271e]"
                >
                  Create account & request access
                </button>
              </div>

              <div className="mt-4 border-t border-[#dedbd2] pt-3 text-center">
                <p className="text-xs text-[#89877e]">
                  Wedding couple looking for your song library?
                </p>
                <Link
                  to="/client"
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[#dedbd2] bg-white px-3 py-1.5 text-xs font-medium text-[#344234] hover:bg-[#f1f0e9] transition-colors"
                >
                  <Music2 className="size-3.5 text-[#546254]" />
                  Open Client Song Library Portal &rarr;
                </Link>
              </div>
            </form>
          ) : (
            <form className="mt-7 space-y-4" onSubmit={handleSignUpSubmit}>
              <label className="block space-y-1.5 text-sm font-medium text-[#444941]">
                Full name
                <Input
                  className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                  type="text"
                  name="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="e.g. Maya Sharma"
                  required
                />
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-[#444941]">
                Email address
                <Input
                  className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                  type="email"
                  name="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-[#444941]">
                Password
                <Input
                  className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-[#444941]">
                Confirm password
                <Input
                  className="h-12 rounded-lg border-[#dedbd2] bg-white px-4"
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  minLength={6}
                  required
                />
              </label>

              <div className="rounded-lg bg-[#f5f3ec] p-3 text-xs leading-5 text-[#737267]">
                <div className="flex items-center gap-1.5 font-medium text-[#494c44]">
                  <Clock3 className="size-3.5 text-[#887858]" /> Admin Approval Required
                </div>
                Your account will be created with pending approval status. Studio shoots and client
                data are restricted until approved.
              </div>

              <Button
                className="mt-2 h-12 w-full rounded-lg bg-[#344234] text-sm text-white hover:bg-[#283528]"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Submitting registration…
                  </>
                ) : (
                  "Create account & request access"
                )}
              </Button>

              <div className="pt-2 text-center text-xs text-[#7d7c73]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signin")}
                  className="font-medium text-[#344234] underline underline-offset-2 hover:text-[#1e271e]"
                >
                  Sign in
                </button>
              </div>

              <div className="border-t border-[#dedbd2] pt-3 text-center text-xs text-[#89877e]">
                Are you a client?{" "}
                <Link
                  to="/client"
                  className="font-medium text-[#344234] underline hover:text-[#1e271e]"
                >
                  Go to Client Signup &rarr;
                </Link>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-[#89877e]">
            TA Bridals · Wedding Shoot & Studio Management
          </p>
        </div>
      </section>
    </main>
  );
}

function PendingApprovalScreen({
  displayName,
  email,
  checkingStatus,
  onCheckStatus,
  onSignOut,
}: {
  displayName: string;
  email: string;
  checkingStatus: boolean;
  onCheckStatus: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fbfaf7] px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-[#e8e5dc] bg-white p-8 shadow-xs sm:p-10">
        <div className="flex items-center justify-between border-b border-[#f1eee6] pb-6">
          <Brand />
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
            <Clock3 className="size-3.5" />
            Pending Approval
          </span>
        </div>

        <div className="mt-8 text-center sm:text-left">
          <h1 className="font-serif text-3xl text-[#30382f]">Registration Submitted</h1>
          <p className="mt-3 text-sm leading-6 text-[#696c64]">
            Hello <span className="font-semibold text-[#30382f]">{displayName}</span>. Your account
            has been created and is waiting for review by the studio owner.
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-xl bg-[#f8f7f3] p-5 text-xs leading-5 text-[#6c6e66]">
          <div className="flex items-center justify-between border-b border-[#ece8de] pb-2">
            <span className="font-medium text-[#494c44]">Registered account:</span>
            <span className="font-mono text-[#30382f]">{email}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[#ece8de] pb-2">
            <span className="font-medium text-[#494c44]">Access level:</span>
            <span className="text-amber-800 font-medium">Restricted (Pending Review)</span>
          </div>
          <p className="pt-1 text-[#838276]">
            To protect bridal couple details and schedule confidentiality, pending users cannot read
            or write studio shoot records. Once the studio owner approves your registration, your
            team workspace will activate automatically.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={onCheckStatus}
            disabled={checkingStatus}
            className="flex-1 h-11 bg-[#344234] text-white hover:bg-[#283528]"
          >
            {checkingStatus ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Checking status…
              </>
            ) : (
              <>
                <RefreshCw className="size-4 mr-1.5" />
                Check approval status
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onSignOut}
            className="h-11 border-[#dedbd2] text-[#4d5149]"
          >
            <LogOut className="size-4 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}

function RejectedScreen({
  email,
  onSignOut,
}: {
  displayName?: string;
  email: string;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fbfaf7] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-700">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="mt-4 font-serif text-2xl text-[#30382f]">Registration Not Approved</h1>
        <p className="mt-2 text-sm leading-6 text-[#72756d]">
          The registration for <span className="font-medium text-[#30382f]">{email}</span> was not
          approved by the studio administrator. If you believe this is in error, please contact
          studio management directly.
        </p>
        <div className="mt-6">
          <Button
            onClick={onSignOut}
            className="w-full h-11 bg-[#344234] text-white hover:bg-[#283528]"
          >
            <LogOut className="size-4 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}

function Workspace({
  section,
  onSectionChange,
  globalQuery,
  onGlobalQueryChange,
  profileName,
  isAdmin,
  shoots,
  team,
  assignments,
  registrations,
  onRegistrationsChange,
  loading,
  error,
  onRefresh,
  onSignOut,
  onSaveShoot,
  onDeleteShoot,
  onSaveAssignments,
  onSaveTeamMember,
  onDeleteTeamMember,
  availabilityRequests,
  auditLogs,
  currentUserId,
  currentUserEmail,
  pendingSongClientsCount = 0,
  onSubmitAvailabilityRequest,
  onReviewAvailabilityRequest,
  invoices,
  clientPayments,
  payroll,
  workerPayments,
  expenses,
  onCreateInvoice,
  onRecordClientPayment,
  onCreatePayrollObligation,
  onDisburseWorkerPayment,
  onRecordExpense,
  onApprovePayroll,
  onApproveExpense,
}: {
  section: Section;
  onSectionChange: (section: Section) => void;
  globalQuery: string;
  onGlobalQueryChange: (query: string) => void;
  profileName: string;
  isAdmin: boolean;
  shoots: Shoot[];
  team: TeamMember[];
  assignments: Assignment[];
  registrations: ProfileRecord[];
  onRegistrationsChange: (registrations: ProfileRecord[]) => void;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSignOut: () => void;
  onSaveShoot: (
    values: ShootInput,
    crewAssignments?: AssignmentInput[],
    shootId?: string,
  ) => Promise<void>;
  onDeleteShoot: (shootId: string) => Promise<void>;
  onSaveAssignments: (shootId: string, values: AssignmentInput[]) => Promise<void>;
  onSaveTeamMember: (values: TeamMemberInput, memberId?: string) => Promise<void>;
  onDeleteTeamMember: (memberId: string) => Promise<void>;
  availabilityRequests: AvailabilityRequest[];
  auditLogs: AuditLog[];
  currentUserId?: string | undefined;
  currentUserEmail?: string | undefined;
  pendingSongClientsCount?: number | undefined;
  onSubmitAvailabilityRequest: (input: any) => Promise<void>;
  onReviewAvailabilityRequest: (
    requestId: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  invoices: ClientInvoiceRecord[];
  clientPayments: ClientPaymentRecord[];
  payroll: PayrollObligationRecord[];
  workerPayments: WorkerPaymentRecord[];
  expenses: OperatingExpenseRecord[];
  onCreateInvoice?: (data: any) => Promise<void>;
  onRecordClientPayment?: (data: any) => Promise<void>;
  onCreatePayrollObligation?: (data: any) => Promise<void>;
  onDisburseWorkerPayment?: (data: any) => Promise<void>;
  onRecordExpense?: (data: any) => Promise<void>;
  onApprovePayroll?: (obligationId: string) => Promise<void>;
  onApproveExpense?: (expenseId: string) => Promise<void>;
}) {
  const currentWorker = useMemo(() => {
    if (isAdmin || (!currentUserId && !currentUserEmail)) return null;
    return (
      team.find((m) => m.user_id && m.user_id === currentUserId) ||
      team.find(
        (m) =>
          m.email && currentUserEmail && m.email.toLowerCase() === currentUserEmail.toLowerCase(),
      ) ||
      null
    );
  }, [isAdmin, currentUserId, currentUserEmail, team]);

  const displayedShoots = useMemo(() => {
    if (isAdmin || !currentWorker) return shoots;
    const workerShootIds = new Set(
      assignments.filter((a) => a.team_member_id === currentWorker.id).map((a) => a.shoot_id),
    );
    return shoots.filter((s) => workerShootIds.has(s.id));
  }, [isAdmin, currentWorker, shoots, assignments]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [displayedName, setDisplayedName] = useState(profileName);

  const pendingRegistrationsCount = useMemo(
    () => registrations.filter((r) => r.approval_status === "pending").length,
    [registrations],
  );

  const pendingLeaveCount = useMemo(
    () => availabilityRequests.filter((r) => r.status === "pending").length,
    [availabilityRequests],
  );

  const understaffedShoots = useMemo(() => {
    return shoots
      .filter((s) => s.status === "Upcoming" || s.status === "In Progress")
      .map((shoot) => {
        const shootAssignments = assignments.filter((a) => a.shoot_id === shoot.id);
        const metrics = calculateStaffingMetrics(shoot.planned_team_size, shootAssignments);
        return { shoot, metrics };
      })
      .filter(({ metrics }) => metrics.additionalCrewRequired > 0);
  }, [shoots, assignments]);

  const understaffedShootsCount = understaffedShoots.length;

  const pendingExpenses = useMemo(
    () => expenses.filter((e) => e.status === "submitted"),
    [expenses],
  );

  const pendingPayroll = useMemo(
    () =>
      payroll.filter(
        (p) => p.status === "submitted" || (p.status === "approved" && p.balance_due > 0),
      ),
    [payroll],
  );

  const pendingFinanceCount = pendingExpenses.length;

  const navigationItems = useMemo(() => {
    if (!isAdmin) return baseNavigation;
    return [
      ...baseNavigation,
      {
        id: "finance" as Section,
        label: "Finance & ERP",
        mobileLabel: "Finance",
        icon: DollarSign,
      },
      {
        id: "analytics" as Section,
        label: "Analytics",
        mobileLabel: "Analytics",
        icon: BarChart3,
      },
      {
        id: "approvals" as Section,
        label: "Registrations",
        mobileLabel: "Registrations",
        icon: UserCheck,
      },
      {
        id: "audit" as Section,
        label: "Audit Log",
        mobileLabel: "Audit",
        icon: History,
      },
    ];
  }, [isAdmin]);

  useEffect(() => {
    if (
      !isAdmin &&
      (section === "approvals" ||
        section === "audit" ||
        section === "analytics" ||
        section === "finance")
    ) {
      onSectionChange("overview");
    }
  }, [isAdmin, section, onSectionChange]);

  const copy = sectionCopy[section];
  const firstName = profileName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="studio-app min-h-screen bg-[#f8f7f4] text-[#343a33]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[196px] flex-col border-r border-[#e9e7df] bg-white px-4 py-6 lg:flex">
        <Brand />
        <p className="mb-3 mt-12 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#aaa69b]">
          Workspace
        </p>
        <nav className="space-y-1" aria-label="Main navigation">
          {navigationItems.map(({ id, label, icon: Icon }) => {
            const badgeCount =
              id === "approvals"
                ? pendingRegistrationsCount
                : id === "availability"
                  ? pendingLeaveCount
                  : id === "shoots"
                    ? understaffedShootsCount
                    : id === "finance"
                      ? pendingFinanceCount
                      : id === "songs"
                        ? (pendingSongClientsCount ?? 0)
                        : 0;

            const badgeVariant =
              id === "approvals" ? "danger" : id === "songs" ? "info" : "warning";

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSectionChange(id)}
                aria-current={section === id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  section === id
                    ? "bg-[#eef0eb] font-medium text-[#344234]"
                    : "text-[#74766e] hover:bg-[#f7f6f2] hover:text-[#343a33]"
                }`}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className="truncate">{label}</span>
                {isAdmin && badgeCount > 0 && (
                  <span className="ml-auto shrink-0">
                    <NotificationBadge count={badgeCount} variant={badgeVariant} />
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-[#f7f6f2] p-4">
          <p className="font-serif text-sm italic text-[#586651]">
            {isAdmin ? "Weddings are better with the right team." : "Welcome to the studio team."}
          </p>
        </div>
        <Link
          to="/client"
          className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#dedbd2] bg-[#fbfaf7] px-3 py-2 text-xs font-medium text-[#344234] hover:bg-[#f1f0e9] transition-colors"
        >
          <Music2 className="size-4 text-[#526052]" />
          <span>Client Song Portal &rarr;</span>
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 flex items-center gap-3 px-3 py-2 text-sm text-[#76776f] hover:text-[#343a33]"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </aside>

      <div className="lg:pl-[196px]">
        <header className="sticky top-0 z-[5] border-b border-[#e9e7df] bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[62px] max-w-[1440px] items-center justify-between px-5 sm:px-7">
            <div className="flex items-center gap-3 lg:hidden">
              <Brand compact />
            </div>
            <nav
              className="flex items-center gap-1 overflow-x-auto lg:hidden"
              aria-label="Mobile navigation"
            >
              {navigationItems.map(({ id, mobileLabel }) => {
                const badgeCount =
                  id === "approvals"
                    ? pendingRegistrationsCount
                    : id === "availability"
                      ? pendingLeaveCount
                      : id === "shoots"
                        ? understaffedShootsCount
                        : id === "finance"
                          ? pendingFinanceCount
                          : id === "songs"
                            ? (pendingSongClientsCount ?? 0)
                            : 0;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSectionChange(id)}
                    aria-current={section === id ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-xs ${
                      section === id ? "bg-[#eef0eb] font-medium text-[#344234]" : "text-[#76776f]"
                    }`}
                  >
                    <span>{mobileLabel}</span>
                    {isAdmin && badgeCount > 0 && (
                      <NotificationBadge count={badgeCount} variant="danger" />
                    )}
                  </button>
                );
              })}
            </nav>
            <label className="relative hidden max-w-sm flex-1 md:block lg:ml-5">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a09d93]"
                aria-hidden="true"
              />
              <Input
                className="h-9 border-[#e6e4dd] bg-[#f8f7f4] pl-9 text-xs"
                placeholder="Search your studio"
                aria-label="Search your studio"
                value={globalQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  onGlobalQueryChange(value);
                  const query = value.trim().toLocaleLowerCase();
                  if (!query) return;
                  const shootMatch = shoots.some((shoot) =>
                    [shoot.couple_name, shoot.event_type, shoot.location, shoot.venue ?? ""]
                      .join(" ")
                      .toLocaleLowerCase()
                      .includes(query),
                  );
                  const teamMatch = team.some((member) =>
                    [member.full_name, member.role, member.email ?? "", member.phone ?? ""]
                      .join(" ")
                      .toLocaleLowerCase()
                      .includes(query),
                  );
                  onSectionChange(shootMatch || !teamMatch ? "shoots" : "team");
                }}
              />
            </label>
            <div className="ml-auto flex items-center gap-3">
              {isAdmin && (
                <AdminNotificationCenter
                  pendingRegistrations={registrations}
                  pendingAvailability={availabilityRequests}
                  understaffedShoots={understaffedShoots}
                  pendingExpenses={pendingExpenses}
                  pendingPayroll={pendingPayroll}
                  pendingSongClientsCount={pendingSongClientsCount ?? 0}
                  onNavigate={onSectionChange}
                />
              )}
              <Link
                to="/client"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#dedbd2] bg-[#f8f7f4] px-3 py-1.5 text-xs font-medium text-[#344234] hover:bg-[#edeae2] transition-colors shadow-2xs"
              >
                <Music2 className="size-3.5 text-[#526052]" />
                Client Song Portal &rarr;
              </Link>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="Account Settings (Change Name / Password)"
                className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-medium text-[#42483f] group-hover:text-[#e7a0ad] transition-colors">
                    {displayedName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#99968c]">
                    {isAdmin ? "Studio owner" : "Team member"}
                  </p>
                </div>
                <div
                  className="grid size-9 place-items-center rounded-full bg-[#e9ece5] text-xs font-semibold text-[#435040] border border-transparent group-hover:border-[#c56c7d] transition-all"
                  aria-hidden="true"
                >
                  {displayedName.slice(0, 1).toUpperCase() || firstName.slice(0, 1).toUpperCase()}
                </div>
                <Settings className="size-3.5 text-[#82767d] group-hover:text-[#e7a0ad] transition-colors" />
              </button>

              <button
                type="button"
                onClick={onSignOut}
                className="rounded-md p-2 text-[#8a897f] hover:bg-[#f5f4f0] lg:hidden"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <AccountSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentName={displayedName}
          userEmail={currentUserEmail || ""}
          role={isAdmin ? "admin" : "worker"}
          onNameUpdated={(newName) => setDisplayedName(newName)}
        />

        <main className="studio-main mx-auto max-w-[1440px] px-5 py-6 sm:px-7">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
                {section === "overview" ? "WEDDING STUDIO · " : ""}
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
              <h1 className="font-serif text-[30px] leading-tight text-[#343a33] sm:text-[34px]">
                {section === "overview" ? `Welcome back, ${firstName}.` : copy.title}
              </h1>
              <p className="mt-2 text-sm text-[#818177]">
                {section === "overview"
                  ? "Manage your shoots, team assignments and upcoming events — all in one place."
                  : copy.description}
              </p>
            </div>
            {loading && (
              <span className="flex items-center gap-2 pb-1 text-xs text-[#77786f]">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Updating
              </span>
            )}
          </div>

          {error ? (
            <div
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-white p-5"
              role="alert"
            >
              <div>
                <p className="text-sm font-medium text-red-900">Your studio data couldn't load.</p>
                <p className="mt-1 text-xs text-red-800">{error}</p>
              </div>
              <Button variant="outline" onClick={onRefresh}>
                Try again
              </Button>
            </div>
          ) : section === "overview" ? (
            <Overview
              shoots={displayedShoots}
              team={team}
              assignments={assignments}
              loading={loading}
              onNavigate={onSectionChange}
              isAdmin={isAdmin}
              pendingRegistrationsCount={pendingRegistrationsCount}
              invoices={invoices}
              clientPayments={clientPayments}
              payroll={payroll}
              workerPayments={workerPayments}
              expenses={expenses}
            />
          ) : section === "shoots" ? (
            <ShootsView
              shoots={displayedShoots}
              assignments={assignments}
              loading={loading}
              externalQuery={globalQuery}
              editable={isAdmin}
              onSaveShoot={onSaveShoot}
              onDeleteShoot={onDeleteShoot}
              team={team}
              allShoots={shoots}
              availabilityRequests={availabilityRequests}
              onSaveAssignments={onSaveAssignments}
            />
          ) : section === "calendar" ? (
            <CalendarView
              shoots={displayedShoots}
              loading={loading}
              team={team}
              assignments={assignments}
            />
          ) : section === "team" ? (
            <TeamView
              team={team}
              loading={loading}
              externalQuery={globalQuery}
              editable={isAdmin}
              onSaveTeamMember={onSaveTeamMember}
              onDeleteTeamMember={onDeleteTeamMember}
            />
          ) : section === "availability" ? (
            <AvailabilitySection
              isAdmin={isAdmin}
              requests={availabilityRequests}
              currentUserId={currentUserId}
              currentUserName={profileName}
              onRequestSubmit={onSubmitAvailabilityRequest}
              onRequestReview={isAdmin ? onReviewAvailabilityRequest : undefined}
              loading={loading}
            />
          ) : section === "finance" && isAdmin ? (
            <FinanceSection
              isAdmin={isAdmin}
              shoots={shoots}
              team={team}
              invoices={invoices}
              clientPayments={clientPayments}
              payroll={payroll}
              workerPayments={workerPayments}
              expenses={expenses}
              onCreateInvoice={onCreateInvoice}
              onRecordClientPayment={onRecordClientPayment}
              onCreatePayrollObligation={onCreatePayrollObligation}
              onDisburseWorkerPayment={onDisburseWorkerPayment}
              onRecordExpense={onRecordExpense}
              onApprovePayroll={onApprovePayroll}
              onApproveExpense={onApproveExpense}
              loading={loading}
            />
          ) : section === "analytics" && isAdmin ? (
            <AnalyticsSection shoots={shoots} team={team} assignments={assignments} />
          ) : section === "audit" && isAdmin ? (
            <AuditLogSection logs={auditLogs} loading={loading} />
          ) : section === "approvals" && isAdmin ? (
            <RegistrationsView
              registrations={registrations}
              onRegistrationsChange={onRegistrationsChange}
            />
          ) : section === "songs" ? (
            <SongLibraryAdminSection />
          ) : (
            <Overview
              shoots={shoots}
              team={team}
              assignments={assignments}
              loading={loading}
              onNavigate={onSectionChange}
              isAdmin={isAdmin}
              pendingRegistrationsCount={pendingRegistrationsCount}
              invoices={invoices}
              clientPayments={clientPayments}
              payroll={payroll}
              workerPayments={workerPayments}
              expenses={expenses}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function RegistrationsView({
  registrations,
  onRegistrationsChange,
}: {
  registrations: ProfileRecord[];
  onRegistrationsChange: (registrations: ProfileRecord[]) => void;
}) {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const pendingCount = registrations.filter((r) => r.approval_status === "pending").length;
  const approvedCount = registrations.filter((r) => r.approval_status === "approved").length;
  const rejectedCount = registrations.filter((r) => r.approval_status === "rejected").length;

  const reload = useCallback(async () => {
    setRefreshing(true);
    setActionError("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      onRegistrationsChange((data ?? []) as unknown as ProfileRecord[]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to refresh registrations.");
    } finally {
      setRefreshing(false);
    }
  }, [onRegistrationsChange]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (filter !== "all" && r.approval_status !== filter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return r.display_name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q);
    });
  }, [registrations, filter, searchQuery]);

  async function handleApprove(userId: string, name: string) {
    setProcessingId(userId);
    setActionError("");
    setActionNotice("");

    const { error } = await approveRegistration(userId);
    if (error) {
      setActionError(error);
    } else {
      setActionNotice(`Approved ${name}! They can now sign in and access the studio workspace.`);
      await reload();
    }
    setProcessingId(null);
  }

  async function handleReject(userId: string, name: string) {
    setProcessingId(userId);
    setActionError("");
    setActionNotice("");

    const { error } = await rejectRegistration(userId);
    if (error) {
      setActionError(error);
    } else {
      setActionNotice(`Registration for ${name} was rejected.`);
      await reload();
    }
    setProcessingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e9e6dd] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#8b877a]">
              Pending Approval
            </span>
            <span className="grid size-7 place-items-center rounded-full bg-amber-50 text-amber-700">
              <Clock3 className="size-4" />
            </span>
          </div>
          <p className="mt-3 font-serif text-3xl text-[#30382f]">{pendingCount}</p>
          <p className="mt-1 text-xs text-[#89867b]">Awaiting owner verification</p>
        </div>

        <div className="rounded-xl border border-[#e9e6dd] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#8b877a]">
              Approved Team
            </span>
            <span className="grid size-7 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="size-4" />
            </span>
          </div>
          <p className="mt-3 font-serif text-3xl text-[#30382f]">{approvedCount}</p>
          <p className="mt-1 text-xs text-[#89867b]">Full team member access</p>
        </div>

        <div className="rounded-xl border border-[#e9e6dd] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#8b877a]">
              Total Registrations
            </span>
            <span className="grid size-7 place-items-center rounded-full bg-[#f0eee6] text-[#555a50]">
              <Users className="size-4" />
            </span>
          </div>
          <p className="mt-3 font-serif text-3xl text-[#30382f]">{registrations.length}</p>
          <p className="mt-1 text-xs text-[#89867b]">All time account requests</p>
        </div>
      </div>

      {actionNotice && (
        <div
          className="flex items-center justify-between rounded-lg border border-[#c4dcbf] bg-[#f2f8f0] px-4 py-3 text-sm text-[#385333]"
          role="status"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#4c7345]" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice("")}
            className="font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError("")}
            className="font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "pending"
                  ? "bg-[#344234] text-white"
                  : "bg-[#f4f2ec] text-[#696b61] hover:text-[#30382f]"
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("approved")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "approved"
                  ? "bg-[#344234] text-white"
                  : "bg-[#f4f2ec] text-[#696b61] hover:text-[#30382f]"
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("rejected")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "rejected"
                  ? "bg-[#344234] text-white"
                  : "bg-[#f4f2ec] text-[#696b61] hover:text-[#30382f]"
              }`}
            >
              Rejected ({rejectedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-[#344234] text-white"
                  : "bg-[#f4f2ec] text-[#696b61] hover:text-[#30382f]"
              }`}
            >
              All ({registrations.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative block w-full sm:w-[220px]">
              <Search
                className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#a09d93]"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests…"
                className="h-9 border-[#e6e4dd] pl-8 text-xs"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload()}
              disabled={refreshing}
              className="h-9 text-xs"
              title="Refresh list"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {filteredRegistrations.length === 0 ? (
          <EmptyState
            title={
              filter === "pending"
                ? "No pending registrations"
                : searchQuery
                  ? "No matching registrations found"
                  : "No registrations in this category"
            }
            detail={
              filter === "pending"
                ? "When new team members register, their requests will appear here for your review."
                : "Try adjusting your search or tab filters."
            }
          />
        ) : (
          <div className="divide-y divide-[#f2efe8]">
            {filteredRegistrations.map((reg) => {
              const isOwner = isOwnerEmail(reg.email);
              const isProcessing = processingId === reg.user_id;

              return (
                <article
                  key={reg.user_id}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-[#faf9f5] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar name={reg.display_name || "Team Member"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[#30382f]">
                          {reg.display_name || "Unnamed applicant"}
                        </p>
                        {isOwner && (
                          <span className="rounded-full bg-[#e8eee4] px-2 py-0.5 text-[10px] font-medium text-[#465c40]">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#7e8076]">{reg.email}</p>
                      <p className="mt-1 text-[11px] text-[#a4a297]">
                        Registered on {format(parseISO(reg.created_at), "MMM d, yyyy · h:mm a")}
                        {reg.reviewed_at && (
                          <span className="ml-2 italic text-[#8a887d]">
                            · Reviewed {format(parseISO(reg.reviewed_at), "MMM d")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                    <ApprovalBadge status={reg.approval_status} />

                    {reg.approval_status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(reg.user_id, reg.display_name)}
                          disabled={isProcessing}
                          className="h-8 bg-[#344234] text-white hover:bg-[#283528] text-xs font-medium"
                        >
                          {isProcessing ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="size-3 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(reg.user_id, reg.display_name)}
                          disabled={isProcessing}
                          className="h-8 border-[#dedbd2] text-red-700 hover:bg-red-50 text-xs font-medium"
                        >
                          <X className="size-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {reg.approval_status === "approved" && !isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(reg.user_id, reg.display_name)}
                        disabled={isProcessing}
                        className="h-8 text-xs text-[#8d8c82] hover:text-red-700"
                        title="Revoke access"
                      >
                        <UserX className="size-3 mr-1" />
                        Revoke
                      </Button>
                    )}

                    {reg.approval_status === "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(reg.user_id, reg.display_name)}
                        disabled={isProcessing}
                        className="h-8 text-xs text-[#40543c] hover:bg-[#f1f4ee]"
                      >
                        <UserCheck className="size-3 mr-1" />
                        Re-approve
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  if (status === "approved") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
        <Check className="size-3 text-emerald-600" />
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-medium text-red-800">
        <X className="size-3 text-red-600" />
        Rejected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
      <Clock3 className="size-3 text-amber-600" />
      Pending
    </span>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#344234] text-white">
        <Camera className="size-[17px]" strokeWidth={1.6} aria-hidden="true" />
      </span>
      {!compact && (
        <span>
          <span className="block font-serif text-base tracking-[0.08em] text-[#344234]">
            TA BRIDALS
          </span>
          <span className="mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-[#969287]">
            Capturing your forever
          </span>
        </span>
      )}
    </div>
  );
}

function Overview({
  shoots,
  team,
  assignments,
  loading,
  onNavigate,
  isAdmin,
  pendingRegistrationsCount,
  invoices,
  clientPayments,
  payroll,
  workerPayments,
  expenses,
}: {
  shoots: Shoot[];
  team: TeamMember[];
  assignments: Assignment[];
  loading: boolean;
  onNavigate: (section: Section) => void;
  isAdmin: boolean;
  pendingRegistrationsCount: number;
  invoices?: ClientInvoiceRecord[];
  clientPayments?: ClientPaymentRecord[];
  payroll?: PayrollObligationRecord[];
  workerPayments?: WorkerPaymentRecord[];
  expenses?: OperatingExpenseRecord[];
}) {
  const today = new Date();
  const upcoming = shoots.filter(
    (shoot) => shoot.status === "Upcoming" && parseISO(shoot.event_date) >= startOfDay(today),
  );
  const inProgress = shoots.filter((shoot) => shoot.status === "In Progress");
  const completed = shoots.filter((shoot) => shoot.status === "Completed");
  const receptions = upcoming.filter((shoot) => shoot.event_type === "Reception");
  const upcomingIds = new Set(upcoming.map((shoot) => shoot.id));
  const onSiteAssignments = assignments.filter(
    (assignment) =>
      assignment.assignment_type === "on_site" && upcomingIds.has(assignment.shoot_id),
  );
  const assignedMemberIds = new Set(
    onSiteAssignments.map((assignment) => assignment.team_member_id),
  );
  const teamRequired = upcoming.reduce((total, shoot) => total + shoot.planned_team_size, 0);
  const shootsNeedingTeam = upcoming.filter((shoot) => {
    const assignedCount = new Set(
      assignments
        .filter(
          (assignment) =>
            assignment.shoot_id === shoot.id && assignment.assignment_type === "on_site",
        )
        .map((a) => a.team_member_id),
    ).size;
    return assignedCount < shoot.planned_team_size;
  });
  const totalStaffingGap = upcoming.reduce((total, shoot) => {
    const assignedCount = new Set(
      assignments
        .filter(
          (assignment) =>
            assignment.shoot_id === shoot.id && assignment.assignment_type === "on_site",
        )
        .map((a) => a.team_member_id),
    ).size;
    return total + Math.max(0, shoot.planned_team_size - assignedCount);
  }, 0);
  const nextSevenDays = upcoming.filter(
    (shoot) => parseISO(shoot.event_date) < addDays(startOfDay(today), 7),
  );
  const availableCount = team.filter((member) => member.available).length;

  const studioTotals = useMemo(() => {
    if (!isAdmin) return null;
    return calculateStudioTotals(
      invoices || [],
      clientPayments || [],
      payroll || [],
      workerPayments || [],
      expenses || [],
    );
  }, [isAdmin, invoices, clientPayments, payroll, workerPayments, expenses]);

  return (
    <div className="space-y-5">
      {isAdmin && studioTotals && (
        <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-5 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9b98c]">
                EXECUTIVE FINANCIAL SUMMARY
              </span>
              <h3 className="font-serif text-lg text-white">Live Studio Financial Health</h3>
            </div>
            <Button
              size="sm"
              onClick={() => onNavigate("finance")}
              className="h-8 bg-[#762d40] text-xs font-medium text-white hover:bg-[#c56c7d]"
            >
              <DollarSign className="size-3.5 mr-1" />
              Open Financial Ledger
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-[#a08d96]">
                Revenue Billed
              </span>
              <p className="mt-1 font-serif text-xl font-medium text-white">
                {formatCurrency(studioTotals.totalRevenueBilled)}
              </p>
              <span className="text-[10px] text-[#71d8aa]">Recognized across shoots</span>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-[#a08d96]">
                Cash Collected
              </span>
              <p className="mt-1 font-serif text-xl font-medium text-[#71d8aa]">
                {formatCurrency(studioTotals.totalCashCollected)}
              </p>
              <span className="text-[10px] text-white/50">In-hand bank & cash</span>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-[#a08d96]">
                Client Balance Due
              </span>
              <p className="mt-1 font-serif text-xl font-medium text-amber-300">
                {formatCurrency(studioTotals.totalClientOutstanding)}
              </p>
              <span className="text-[10px] text-amber-200/70">Receivables pending</span>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-[#a08d96]">
                Payroll Due
              </span>
              <p className="mt-1 font-serif text-xl font-medium text-rose-300">
                {formatCurrency(studioTotals.totalPayrollOutstanding)}
              </p>
              <span className="text-[10px] text-rose-200/70">Crew compensation</span>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
              <span className="text-[10px] uppercase tracking-wider text-[#a08d96]">
                Operating Expenses
              </span>
              <p className="mt-1 font-serif text-xl font-medium text-white">
                {formatCurrency(studioTotals.totalOperatingExpenses)}
              </p>
              <span className="text-[10px] text-white/50">Direct & overhead</span>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#762d40]/20 p-3.5 border-[#c56c7d]/30">
              <span className="text-[10px] uppercase tracking-wider text-[#d9b98c]">
                Est. Net Profit
              </span>
              <p
                className={`mt-1 font-serif text-xl font-semibold ${studioTotals.estimatedNetProfit >= 0 ? "text-[#71d8aa]" : "text-rose-400"}`}
              >
                {formatCurrency(studioTotals.estimatedNetProfit)}
              </p>
              <span className="text-[10px] text-white/70">Accrual operational estimate</span>
            </div>
          </div>
        </section>
      )}

      {isAdmin && pendingRegistrationsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-amber-800">
              <Clock3 className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-amber-950">
                {pendingRegistrationsCount} team{" "}
                {pendingRegistrationsCount === 1 ? "registration is" : "registrations are"} awaiting
                approval
              </p>
              <p className="text-[11px] text-amber-800">
                Review applicant details and grant workspace access to your team members.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onNavigate("approvals")}
            className="h-8 bg-[#344234] text-white hover:bg-[#283528] text-xs font-medium"
          >
            Review registrations
          </Button>
        </div>
      )}

      <section className="studio-hero relative flex min-h-[176px] items-end overflow-hidden rounded-2xl border border-[#30282e] p-6 sm:min-h-[194px] sm:p-8">
        <div className="relative z-[1] max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e7a0ad]">
            CAPTURING YOUR FOREVER
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#f7f0ee] sm:text-4xl">
            Every love story deserves a perfect team.
          </h2>
          <p className="mt-2 max-w-lg text-xs leading-5 text-[#c7bbc0]">
            Your upcoming celebrations, people and plans — thoughtfully together.
          </p>
        </div>
        <Sparkles
          className="absolute bottom-8 right-8 hidden size-7 text-[#d9b98c]/75 xl:block"
          strokeWidth={1}
          aria-hidden="true"
        />
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-8">
        <MetricCard label="Upcoming shoots" value={upcoming.length} caption="On the calendar">
          <CalendarDays className="size-4" />
        </MetricCard>
        <MetricCard label="In progress" value={inProgress.length} caption="Happening now">
          <Camera className="size-4" />
        </MetricCard>
        <MetricCard label="Completed" value={completed.length} caption="Stories captured">
          <Check className="size-4" />
        </MetricCard>
        <MetricCard
          label="Upcoming receptions"
          value={receptions.length}
          caption="Celebrations ahead"
        >
          <Sparkles className="size-4" />
        </MetricCard>
        <MetricCard label="Crew required" value={teamRequired} caption="Upcoming shoots">
          <Users className="size-4" />
        </MetricCard>
        <MetricCard
          label="Crew assigned"
          value={assignedMemberIds.size}
          caption="Unique on-site people"
        >
          <Check className="size-4" />
        </MetricCard>
        <MetricCard
          label="Need a team"
          value={shootsNeedingTeam.length}
          caption="Under planned size"
        >
          <Users className="size-4" />
        </MetricCard>
        <MetricCard
          label="Next 7 days"
          value={nextSevenDays.length}
          caption="Upcoming celebrations"
        >
          <Clock3 className="size-4" />
        </MetricCard>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(350px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efeee9] px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-serif text-xl text-[#3e453d]">Upcoming shoots</h2>
              <p className="mt-1 text-xs text-[#929086]">
                Your next celebrations, all in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("shoots")}
              className="text-xs font-medium text-[#586651] hover:text-[#344234]"
            >
              View all <span aria-hidden="true">→</span>
            </button>
          </div>
          {loading && shoots.length === 0 ? (
            <LoadingRows />
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="Your calendar is clear."
              detail="When you add an upcoming shoot, it'll show up here."
            />
          ) : (
            <div className="divide-y divide-[#f0efe9]">
              {upcoming.slice(0, 5).map((shoot) => {
                const shootAssignments = assignments.filter((a) => a.shoot_id === shoot.id);
                const assignedMembers = shootAssignments.map((a) => {
                  const member = team.find((t) => t.id === a.team_member_id);
                  return {
                    id: a.team_member_id,
                    name: member?.full_name ?? "Unknown Worker",
                    role: member?.role ?? "Crew",
                    type: a.assignment_type,
                  };
                });
                const metrics = calculateStaffingMetrics(shoot.planned_team_size, shootAssignments);

                return (
                  <ShootRow
                    key={shoot.id}
                    shoot={shoot}
                    assignedMembers={assignedMembers}
                    staffingMetrics={metrics}
                    assignedCount={metrics.assignedCrew}
                  />
                );
              })}
            </div>
          )}
        </section>

        <CalendarView
          shoots={shoots}
          loading={loading}
          compact
          team={team}
          assignments={assignments}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#e9e7df] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-[#3e453d]">Team overview</h2>
              <p className="mt-1 text-xs text-[#929086]">
                {team.length} registered · {availableCount} available
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("team")}
              className="text-xs font-medium text-[#586651] hover:text-[#344234]"
            >
              Meet the team <span aria-hidden="true">→</span>
            </button>
          </div>
          {loading && team.length === 0 ? (
            <LoadingRows />
          ) : team.length === 0 ? (
            <EmptyState
              title="Your team starts here."
              detail="Once your team is added, you'll see them here."
            />
          ) : (
            <>
              <div className="mb-4 mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TeamSummary
                  label="Photographers"
                  value={team.filter((member) => member.role.includes("Photographer")).length}
                />
                <TeamSummary
                  label="Videographers"
                  value={team.filter((member) => member.role.includes("Videographer")).length}
                />
                <TeamSummary
                  label="Editors & design"
                  value={
                    team.filter(
                      (member) =>
                        member.role.includes("Editor") || member.role.includes("Designer"),
                    ).length
                  }
                />
                <TeamSummary label="Available" value={availableCount} />
              </div>
              <div className="space-y-3">
                {team.slice(0, 4).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar name={member.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#444941]">
                        {member.full_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#929086]">{member.role}</p>
                    </div>
                    <Availability available={member.available} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="studio-feature-panel flex flex-col justify-between rounded-2xl bg-[#344234] p-6 text-white sm:p-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d5c7ad]">
              A NOTE FOR THE STUDIO
            </p>
            <h2 className="mt-3 max-w-sm font-serif text-2xl leading-snug">
              Make room for the moments that matter.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">
              Keep your schedule close, your team in the loop, and the beautiful details in view.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("calendar")}
            className="mt-7 flex w-fit items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/10"
          >
            Open your calendar <ChevronRight className="size-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

function TeamSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e9e7df] bg-[#f8f7f4] px-3 py-2.5">
      <p className="text-lg font-medium text-[#3e453d]">{value}</p>
      <p className="mt-1 text-[10px] text-[#929086]">{label}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  children,
}: {
  label: string;
  value: string | number;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e9e7df] bg-white p-5">
      <div className="flex items-center justify-between text-[#8d927f]">
        <span className="text-xs font-medium text-[#77786f]">{label}</span>
        {children}
      </div>
      <p className="mt-5 font-serif text-3xl text-[#394238]">{value}</p>
      <p className="mt-1 text-[11px] text-[#99968c]">{caption}</p>
    </div>
  );
}

function ShootsView({
  shoots,
  assignments,
  loading,
  externalQuery = "",
  editable,
  onSaveShoot,
  onDeleteShoot,
  team,
  allShoots,
  availabilityRequests = [],
  onSaveAssignments,
}: {
  shoots: Shoot[];
  assignments: Assignment[];
  loading: boolean;
  externalQuery?: string;
  editable: boolean;
  onSaveShoot: (
    values: ShootInput,
    crewAssignments?: AssignmentInput[],
    shootId?: string,
  ) => Promise<void>;
  onDeleteShoot: (shootId: string) => Promise<void>;
  team: TeamMember[];
  allShoots: Shoot[];
  availabilityRequests?: AvailabilityRequest[];
  onSaveAssignments: (shootId: string, values: AssignmentInput[]) => Promise<void>;
}) {
  const [query, setQuery] = useState(externalQuery);
  const [eventType, setEventType] = useState("All event types");
  const [status, setStatus] = useState("All statuses");
  const [editingShoot, setEditingShoot] = useState<Shoot | null | undefined>(undefined);
  const [assigningShoot, setAssigningShoot] = useState<Shoot | null>(null);
  const [actionError, setActionError] = useState("");
  useEffect(() => setQuery(externalQuery), [externalQuery]);
  const filteredShoots = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return shoots.filter(
      (shoot) =>
        (eventType === "All event types" || shoot.event_type === eventType) &&
        (status === "All statuses" || shoot.status === status) &&
        [shoot.couple_name, shoot.event_type, shoot.location, shoot.venue ?? "", shoot.status]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
    );
  }, [eventType, query, shoots, status]);

  async function confirmDelete(shoot: Shoot) {
    if (
      !window.confirm(
        `Delete the shoot for ${shoot.couple_name}? This also removes its assignments.`,
      )
    )
      return;
    setActionError("");
    try {
      await onDeleteShoot(shoot.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete this shoot.");
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efeee9] px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-[#3e453d]">Your shoots</h2>
            <p className="mt-1 text-xs text-[#929086]">
              {shoots.length} {shoots.length === 1 ? "celebration" : "celebrations"} in your studio
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative block min-w-[180px] flex-1 sm:max-w-[240px]">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a09d93]"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search couples, venues…"
                aria-label="Search shoots"
                className="h-10 border-[#e6e4dd] pl-9 text-sm"
              />
            </label>
            <select
              className="h-10 rounded-md border px-3 text-xs"
              aria-label="Filter by event type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              <option>All event types</option>
              <option>Wedding</option>
              <option>Reception</option>
              <option>Engagement</option>
              <option>Pre-wedding</option>
              <option>Other</option>
            </select>
            <select
              className="h-10 rounded-md border px-3 text-xs"
              aria-label="Filter by shoot status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option>All statuses</option>
              <option>Upcoming</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
            {editable && (
              <Button
                className="h-10 gap-2 rounded-lg bg-[#344234] text-xs text-white"
                onClick={() => setEditingShoot(null)}
              >
                <Plus className="size-4" /> Add shoot
              </Button>
            )}
          </div>
        </div>
        {actionError && (
          <p className="border-b border-red-200 px-5 py-3 text-xs text-red-700" role="alert">
            {actionError}
          </p>
        )}
        {loading && shoots.length === 0 ? (
          <LoadingRows />
        ) : filteredShoots.length === 0 ? (
          <EmptyState
            title={query ? "No shoots found." : "Your shoot list is empty."}
            detail={
              query
                ? "Try a different name, event type, or location."
                : "Your saved shoots will appear here."
            }
          />
        ) : (
          <div className="divide-y divide-[#f0efe9]">
            {filteredShoots.map((shoot) => {
              const shootAssignments = assignments.filter((a) => a.shoot_id === shoot.id);
              const assignedMembers = shootAssignments.map((a) => {
                const member = team.find((t) => t.id === a.team_member_id);
                return {
                  id: a.team_member_id,
                  name: member?.full_name ?? "Unknown Worker",
                  role: member?.role ?? "Crew",
                  type: a.assignment_type,
                };
              });
              const metrics = calculateStaffingMetrics(shoot.planned_team_size, shootAssignments);

              return (
                <ShootRow
                  key={shoot.id}
                  shoot={shoot}
                  assignedMembers={assignedMembers}
                  staffingMetrics={metrics}
                  assignedCount={metrics.assignedCrew}
                  onEdit={editable ? () => setEditingShoot(shoot) : undefined}
                  onDelete={editable ? () => void confirmDelete(shoot) : undefined}
                  onAssign={editable ? () => setAssigningShoot(shoot) : undefined}
                />
              );
            })}
          </div>
        )}
      </section>
      {editingShoot !== undefined && (
        <ShootEditor
          key={editingShoot?.id ?? "new-shoot"}
          shoot={editingShoot}
          team={team}
          shoots={allShoots}
          assignments={assignments}
          availabilityRequests={availabilityRequests}
          onClose={() => setEditingShoot(undefined)}
          onSave={onSaveShoot}
        />
      )}
      {assigningShoot && (
        <AssignmentEditor
          shoot={assigningShoot}
          team={team}
          shoots={allShoots}
          assignments={assignments}
          onClose={() => setAssigningShoot(null)}
          onSave={onSaveAssignments}
        />
      )}
    </>
  );
}

const ALL_STUDIO_ROLES = [
  "All roles",
  "Photographer",
  "Videographer",
  "Cinematographer / Creative Director",
  "Drone Operator",
  "Assistant Photographer",
  "Assistant Videographer",
  "Lighting Assistant",
  "Data Manager / Footage Backup Assistant",
  "Photo Editor",
  "Video Editor",
  "Album Designer",
];

function ShootEditor({
  shoot,
  team,
  shoots,
  assignments,
  availabilityRequests = [],
  onClose,
  onSave,
}: {
  shoot: Shoot | null;
  team: TeamMember[];
  shoots: Shoot[];
  assignments: Assignment[];
  availabilityRequests?: AvailabilityRequest[];
  onClose: () => void;
  onSave: (
    values: ShootInput,
    crewAssignments: AssignmentInput[],
    shootId?: string,
  ) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictReviewed, setConflictReviewed] = useState(false);

  // Form field state for live calculations & conflict checks
  const [plannedTeamSize, setPlannedTeamSize] = useState<number>(shoot?.planned_team_size ?? 7);
  const [eventDate, setEventDate] = useState<string>(
    shoot?.event_date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = useState<string>(shoot?.start_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState<string>(shoot?.end_time?.slice(0, 5) ?? "");

  // Crew search and role filters
  const [workerSearch, setWorkerSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");

  // Selected crew assignments
  const [selectedCrew, setSelectedCrew] = useState<AssignmentInput[]>(() => {
    if (!shoot) return [];
    return assignments
      .filter((a) => a.shoot_id === shoot.id)
      .map(({ team_member_id, assignment_type }) => ({ team_member_id, assignment_type }));
  });

  // Only approved, active workers may be selected
  const activeWorkers = useMemo(() => {
    return team.filter((member) => member.status !== "inactive");
  }, [team]);

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return activeWorkers.filter((member) => {
      const matchesQuery =
        !q || member.full_name.toLowerCase().includes(q) || member.role.toLowerCase().includes(q);
      const matchesRole = roleFilter === "All roles" || member.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [activeWorkers, workerSearch, roleFilter]);

  const staffingMetrics = useMemo(() => {
    return calculateStaffingMetrics(plannedTeamSize, selectedCrew);
  }, [plannedTeamSize, selectedCrew]);

  const conflicts = useMemo(() => {
    const onSiteIds = selectedCrew
      .filter((c) => c.assignment_type === "on_site")
      .map((c) => c.team_member_id);

    return findAllShootConflicts({
      shoot: {
        id: shoot?.id,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
      },
      selectedWorkerIds: onSiteIds,
      team,
      shoots,
      assignments,
      availabilityRequests,
    });
  }, [
    selectedCrew,
    shoot?.id,
    eventDate,
    startTime,
    endTime,
    team,
    shoots,
    assignments,
    availabilityRequests,
  ]);

  function toggleWorker(workerId: string) {
    setSelectedCrew((prev) => {
      const exists = prev.some((item) => item.team_member_id === workerId);
      if (exists) {
        return prev.filter((item) => item.team_member_id !== workerId);
      }
      const onSiteCount = prev.filter((item) => item.assignment_type === "on_site").length;
      if (onSiteCount >= 20) {
        setError(
          "Maximum capacity reached: A shoot cannot have more than 20 on-site crew members.",
        );
        return prev;
      }
      return [...prev, { team_member_id: workerId, assignment_type: "on_site" }];
    });
  }

  function removeWorker(workerId: string) {
    setSelectedCrew((prev) => prev.filter((item) => item.team_member_id !== workerId));
  }

  function updateAssignmentType(workerId: string, type: "on_site" | "post_production") {
    setSelectedCrew((prev) => {
      if (type === "on_site") {
        const onSiteCount = prev.filter((item) => item.assignment_type === "on_site").length;
        if (onSiteCount >= 20) {
          setError(
            "Maximum capacity reached: A shoot cannot have more than 20 on-site crew members.",
          );
          return prev;
        }
      }
      return prev.map((item) =>
        item.team_member_id === workerId ? { ...item, assignment_type: type } : item,
      );
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (conflicts.length > 0 && !conflictReviewed) {
      setError("Please review or acknowledge the scheduling conflicts before saving.");
      setSaving(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const venue = String(form.get("venue") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const values: ShootInput = {
      couple_name: String(form.get("couple_name") ?? "").trim(),
      event_type: String(form.get("event_type") ?? "Wedding"),
      event_date: eventDate,
      location: String(form.get("location") ?? "").trim(),
      venue: venue || null,
      start_time: startTime,
      end_time: endTime || null,
      planned_team_size: plannedTeamSize,
      status: String(form.get("status") ?? "Upcoming"),
      notes: notes || null,
    };
    try {
      await onSave(values, selectedCrew, shoot?.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save this shoot and crew assignments.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-modal max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shoot-editor-title"
      >
        <div className="mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
            STUDIO SCHEDULE
          </p>
          <h2 id="shoot-editor-title" className="mt-2 font-serif text-2xl">
            {shoot ? "Edit shoot details" : "Add a shoot"}
          </h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="studio-field sm:col-span-2">
              Couple / client
              <Input
                name="couple_name"
                defaultValue={shoot?.couple_name}
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <label className="studio-field">
              Event type
              <select name="event_type" defaultValue={shoot?.event_type ?? "Wedding"} required>
                <option>Wedding</option>
                <option>Reception</option>
                <option>Engagement</option>
                <option>Pre-wedding</option>
                <option>Other</option>
              </select>
            </label>
            <label className="studio-field">
              Date
              <Input
                name="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </label>
            <label className="studio-field">
              Location
              <Input name="location" defaultValue={shoot?.location} maxLength={160} required />
            </label>
            <label className="studio-field">
              Venue <span className="font-normal text-[#82767d]">· optional</span>
              <Input name="venue" defaultValue={shoot?.venue ?? ""} maxLength={160} />
            </label>
            <label className="studio-field">
              Start time
              <Input
                name="start_time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>
            <label className="studio-field">
              End time <span className="font-normal text-[#82767d]">· optional</span>
              <Input
                name="end_time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
            <label className="studio-field">
              Planned team size
              <Input
                name="planned_team_size"
                type="number"
                min={7}
                max={20}
                value={plannedTeamSize}
                onChange={(e) =>
                  setPlannedTeamSize(Math.max(7, Math.min(20, Number(e.target.value) || 7)))
                }
                required
              />
            </label>
            <label className="studio-field">
              Shoot status
              <select name="status" defaultValue={shoot?.status ?? "Upcoming"}>
                <option>Upcoming</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </label>
            <label className="studio-field sm:col-span-2">
              Notes <span className="font-normal text-[#82767d]">· optional</span>
              <textarea name="notes" maxLength={2000} defaultValue={shoot?.notes ?? ""} rows={2} />
            </label>
          </div>

          {/* Assigned Crew Members Section */}
          <div className="mt-6 border-t border-[#30282e] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg text-[#f7f0ee]">Assigned Crew Members</h3>
                <p className="text-xs text-[#82767d]">
                  Select approved studio workers. Search by name, filter by role, and set assignment
                  nature.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg border border-[#30282e] bg-[#120f12] px-2.5 py-1 text-[#f7f0ee]">
                  Selected crew:{" "}
                  <strong className="font-semibold text-[#d9b98c]">
                    {staffingMetrics.assignedCrew}
                  </strong>
                </span>
                <span className="rounded-lg border border-[#30282e] bg-[#120f12] px-2.5 py-1 text-[#b8adb2]">
                  Planned crew:{" "}
                  <strong className="font-semibold">{staffingMetrics.plannedTeamSize}</strong>
                </span>
                <span
                  className={`rounded-lg border px-2.5 py-1 font-medium ${
                    staffingMetrics.additionalCrewRequired > 0
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {staffingMetrics.additionalCrewRequired > 0
                    ? `Additional crew required: ${staffingMetrics.additionalCrewRequired}`
                    : "Staffing fulfilled"}
                </span>
                <span className="rounded-lg border border-[#30282e] bg-[#120f12] px-2.5 py-1 text-[#82767d]">
                  Remaining capacity: {staffingMetrics.remainingCapacity}
                </span>
              </div>
            </div>

            {/* Conflicts Warning */}
            {conflicts.length > 0 && (
              <div
                className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200"
                role="alert"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-amber-300">Scheduling conflict notice</p>
                    {conflicts.map((c, idx) => (
                      <p key={idx} className="text-[11px] text-amber-200/90 leading-tight">
                        • {c.message}
                      </p>
                    ))}
                    {!conflictReviewed && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConflictReviewed(true)}
                        className="mt-2 h-7 border-amber-500/40 bg-amber-500/20 text-[11px] text-amber-200 hover:bg-amber-500/30"
                      >
                        Acknowledge conflicts & continue
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Selected Workers Chips Preview */}
            {selectedCrew.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 p-2 rounded-xl border border-[#30282e]/80 bg-[#161217]">
                {selectedCrew.map((assignment) => {
                  const worker = team.find((m) => m.id === assignment.team_member_id);
                  if (!worker) return null;
                  return (
                    <span
                      key={assignment.team_member_id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#40343e] bg-[#221c25] px-2.5 py-1 text-xs text-[#f7f0ee]"
                    >
                      <span className="font-medium">{worker.full_name}</span>
                      <span className="text-[10px] text-[#d9b98c]">({worker.role})</span>
                      <span className="text-[9px] uppercase tracking-wider text-[#82767d]">
                        [{assignment.assignment_type === "on_site" ? "On-site" : "Post-prod"}]
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWorker(worker.id)}
                        className="ml-1 text-[#82767d] hover:text-red-400"
                        aria-label={`Remove ${worker.full_name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search and Role Filter Bar */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#82767d]" />
                <Input
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  placeholder="Search workers by name or role…"
                  className="h-9 pl-8 text-xs bg-[#120f12] border-[#30282e] text-[#f7f0ee]"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-md border border-[#30282e] bg-[#120f12] px-3 text-xs text-[#f7f0ee]"
              >
                {ALL_STUDIO_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Workers Multi-Select List */}
            <div className="mt-3 max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
              {filteredWorkers.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#82767d]">
                  No active workers matching "{workerSearch || roleFilter}".
                </p>
              ) : (
                filteredWorkers.map((member) => {
                  const isSelected = selectedCrew.some((i) => i.team_member_id === member.id);
                  const currentAssign = selectedCrew.find((i) => i.team_member_id === member.id);
                  const workerConflicts = conflicts.filter((c) => c.workerId === member.id);

                  return (
                    <div
                      key={member.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-2.5 transition-colors text-xs ${
                        isSelected
                          ? "border-[#762d40] bg-[#221c25]"
                          : "border-[#30282e]/80 bg-[#161217] hover:border-[#40343e]"
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleWorker(member.id)}
                          className="size-4 rounded border-[#40343e] accent-[#762d40]"
                        />
                        <div>
                          <p className="font-medium text-[#f7f0ee]">{member.full_name}</p>
                          <p className="text-[11px] text-[#82767d]">
                            {member.role} ·{" "}
                            <span
                              className={member.available ? "text-[#71d8aa]" : "text-amber-400"}
                            >
                              {member.available ? "Available" : "Busy"}
                            </span>
                            {member.status === "on_leave" && " (On Leave)"}
                          </p>
                          {workerConflicts.length > 0 && (
                            <p className="text-[10px] text-amber-300 font-medium">
                              ⚠️ {workerConflicts[0]?.message}
                            </p>
                          )}
                        </div>
                      </label>

                      {isSelected && (
                        <select
                          value={currentAssign?.assignment_type ?? "on_site"}
                          onChange={(e) =>
                            updateAssignmentType(
                              member.id,
                              e.target.value as "on_site" | "post_production",
                            )
                          }
                          className="h-7 rounded border border-[#40343e] bg-[#120f12] px-2 text-[11px] text-[#f7f0ee]"
                        >
                          <option value="on_site">On site</option>
                          <option value="post_production">Post production</option>
                        </select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <p
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : shoot ? "Save changes" : "Add shoot"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AssignmentEditor({
  shoot,
  team,
  shoots,
  assignments,
  onClose,
  onSave,
}: {
  shoot: Shoot;
  team: TeamMember[];
  shoots: Shoot[];
  assignments: Assignment[];
  onClose: () => void;
  onSave: (shootId: string, values: AssignmentInput[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AssignmentInput[]>(() =>
    assignments
      .filter((assignment) => assignment.shoot_id === shoot.id)
      .map(({ team_member_id, assignment_type }) => ({ team_member_id, assignment_type })),
  );
  const [conflictsReviewed, setConflictsReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedIds = new Set(selected.map((assignment) => assignment.team_member_id));

  const staffingMetrics = useMemo(
    () => calculateStaffingMetrics(shoot.planned_team_size, selected),
    [shoot.planned_team_size, selected],
  );

  const conflicts = useMemo(() => {
    return selected.flatMap((assignment) => {
      if (assignment.assignment_type !== "on_site") return [];
      return assignments
        .filter(
          (existing) =>
            existing.team_member_id === assignment.team_member_id &&
            existing.assignment_type === "on_site" &&
            existing.shoot_id !== shoot.id,
        )
        .map((existing) => shoots.find((otherShoot) => otherShoot.id === existing.shoot_id))
        .filter((otherShoot): otherShoot is Shoot => {
          if (!otherShoot || otherShoot.status === "Cancelled") return false;
          return doEventsOverlap(
            {
              date: shoot.event_date,
              startTime: shoot.start_time,
              endTime: shoot.end_time,
            },
            {
              date: otherShoot.event_date,
              startTime: otherShoot.start_time,
              endTime: otherShoot.end_time,
            },
          );
        })
        .map((otherShoot) => ({
          member: team.find((item) => item.id === assignment.team_member_id),
          shoot: otherShoot,
        }));
    });
  }, [assignments, selected, shoot, shoots, team]);

  function toggleMember(memberId: string) {
    setSelected((current) => {
      const exists = current.some((item) => item.team_member_id === memberId);
      if (exists) {
        return current.filter((item) => item.team_member_id !== memberId);
      }
      const onSiteCount = current.filter((i) => i.assignment_type === "on_site").length;
      if (onSiteCount >= 20) {
        setError(
          "Maximum capacity reached: A shoot cannot have more than 20 on-site crew members.",
        );
        return current;
      }
      return [...current, { team_member_id: memberId, assignment_type: "on_site" }];
    });
  }

  function changeType(memberId: string, assignmentType: Assignment["assignment_type"]) {
    setSelected((current) =>
      current.map((item) =>
        item.team_member_id === memberId ? { ...item, assignment_type: assignmentType } : item,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(shoot.id, selected);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save assignments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-editor-title"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
              CREW ASSIGNMENT
            </p>
            <h2 id="assignment-editor-title" className="mt-2 font-serif text-2xl">
              {shoot.couple_name}
            </h2>
            <p className="mt-1 text-xs text-[#82767d]">
              {format(parseISO(shoot.event_date), "EEEE, MMMM d, yyyy")} · Planned crew:{" "}
              {shoot.planned_team_size}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                staffingMetrics.staffingStatus === "Fully Staffed"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : staffingMetrics.staffingStatus === "Overstaffed"
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {staffingMetrics.staffingStatus} ({staffingMetrics.uniqueOnSiteWorkers}/
              {staffingMetrics.plannedTeamSize} on-site)
            </span>
            <p className="mt-1 text-[11px] text-[#82767d]">
              {staffingMetrics.remainingRequired > 0
                ? `${staffingMetrics.remainingRequired} more required`
                : "Requirement fulfilled"}{" "}
              · {staffingMetrics.remainingCapacity} capacity left
            </p>
          </div>
        </div>
        {conflicts.length > 0 && !conflictsReviewed && (
          <div
            className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
            role="alert"
          >
            <p className="font-semibold">Scheduling notice</p>
            <p className="mt-1">
              One or more team members are already assigned to overlapping events on this date.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 text-xs"
              onClick={() => setConflictsReviewed(true)}
            >
              Continue anyway
            </Button>
          </div>
        )}
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {team.map((member) => {
            const isAssigned = selectedIds.has(member.id);
            const current = selected.find((item) => item.team_member_id === member.id);
            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#30282e] bg-[#1d171d] p-3 text-xs"
              >
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={() => toggleMember(member.id)}
                  />
                  <div>
                    <p className="font-medium text-[#f7f0ee]">{member.full_name}</p>
                    <p className="text-[11px] text-[#82767d]">
                      {member.role} · {member.available ? "Available" : "Busy"}
                    </p>
                  </div>
                </label>
                {isAssigned && (
                  <select
                    className="rounded-md border border-[#30282e] bg-[#120f12] px-2 py-1 text-xs text-[#f7f0ee]"
                    value={current?.assignment_type ?? "on_site"}
                    onChange={(event) =>
                      changeType(member.id, event.target.value as Assignment["assignment_type"])
                    }
                  >
                    <option value="on_site">On site</option>
                    <option value="post_production">Post production</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <p
            className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#30282e] pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save assignments"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function CalendarView({
  shoots,
  loading,
  compact = false,
  team = [],
  assignments = [],
  onEditShoot,
}: {
  shoots: Shoot[];
  loading: boolean;
  compact?: boolean;
  team?: TeamMember[];
  assignments?: Assignment[];
  onEditShoot?: (shoot: Shoot) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null);

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const weekStart = startOfWeek(anchor);
  const weekEnd = endOfWeek(anchor);
  const periodStart = view === "month" ? startOfWeek(monthStart) : weekStart;
  const periodEnd = view === "month" ? endOfWeek(monthEnd) : weekEnd;

  const days = useMemo(() => {
    const list: Date[] = [];
    let day = periodStart;
    while (day <= periodEnd) {
      list.push(day);
      day = addDays(day, 1);
    }
    return list;
  }, [periodStart, periodEnd]);

  function eventsFor(date: Date) {
    return shoots.filter(
      (shoot) => shoot.status !== "Cancelled" && isSameDay(parseISO(shoot.event_date), date),
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efeee9] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-[#3e453d]">
              {format(anchor, view === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}
            </h2>
            <p className="mt-1 text-xs text-[#929086]">Studio shoot schedule</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <div className="flex rounded-lg border border-[#e6e4dd] bg-[#f8f7f4] p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 ${
                    view === "month" ? "bg-white font-medium text-[#344234]" : "text-[#76776f]"
                  }`}
                  onClick={() => setView("month")}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 ${
                    view === "week" ? "bg-white font-medium text-[#344234]" : "text-[#76776f]"
                  }`}
                  onClick={() => setView("week")}
                >
                  Week
                </button>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() =>
                  setAnchor((current) =>
                    view === "month" ? subMonths(current, 1) : subWeeks(current, 1),
                  )
                }
                aria-label="Previous period"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setAnchor(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() =>
                  setAnchor((current) =>
                    view === "month" ? addMonths(current, 1) : addWeeks(current, 1),
                  )
                }
                aria-label="Next period"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        {loading && shoots.length === 0 ? (
          <LoadingRows />
        ) : (
          <div className="overflow-x-auto">
            <div className={compact ? "min-w-0" : "min-w-[760px]"}>
              <div className="grid grid-cols-7 border-b border-[#efeee9]">
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className="py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#99968c]"
                  >
                    {format(addDays(startOfWeek(new Date()), i), "EEE")}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const events = eventsFor(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`${compact ? "min-h-[78px]" : "min-h-[112px]"} border-b border-r border-[#f0efe9] p-2.5 ${
                        view === "month" && !isSameMonth(day, anchor) ? "bg-[#fbfaf8]" : ""
                      }`}
                    >
                      <span
                        className={`grid size-7 place-items-center rounded-full text-xs ${
                          isToday(day)
                            ? "bg-[#344234] font-medium text-white"
                            : isSameMonth(day, anchor)
                              ? "text-[#565b52]"
                              : "text-[#bbb8ae]"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {events.slice(0, compact ? 1 : 2).map((shoot) => (
                          <button
                            key={shoot.id}
                            type="button"
                            onClick={() => setSelectedShoot(shoot)}
                            className="w-full truncate rounded bg-[#eef0eb] px-1.5 py-1 text-left text-[10px] text-[#4c5847]"
                            title={`${shoot.couple_name} · ${shoot.event_type}`}
                            aria-label={`View ${shoot.event_type} for ${shoot.couple_name}`}
                          >
                            {shoot.couple_name}
                          </button>
                        ))}
                        {events.length > (compact ? 1 : 2) && (
                          <p className="px-1 text-[9px] text-[#838177]">
                            +{events.length - (compact ? 1 : 2)} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {!loading && shoots.length === 0 && (
          <p className="px-5 py-3 text-center text-xs text-[#929086]">
            No shoots yet — your calendar is ready when you are.
          </p>
        )}
        {!loading && shoots.length > 0 && (
          <div className="border-t border-[#efeee9] p-4 md:hidden">
            <h3 className="mb-3 font-serif text-lg">This period</h3>
            <div className="space-y-2">
              {shoots
                .filter(
                  (shoot) =>
                    shoot.status !== "Cancelled" &&
                    parseISO(shoot.event_date) >= periodStart &&
                    parseISO(shoot.event_date) <= periodEnd,
                )
                .sort((a, b) => a.event_date.localeCompare(b.event_date))
                .map((shoot) => (
                  <button
                    key={shoot.id}
                    type="button"
                    onClick={() => setSelectedShoot(shoot)}
                    className="flex w-full items-center gap-3 rounded-lg border border-[#30282e] bg-[#151317] p-3 text-left"
                  >
                    <span className="font-serif text-lg text-[#e7a0ad]">
                      {format(parseISO(shoot.event_date), "d")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[#f7f0ee]">
                        {shoot.couple_name}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[#82767d]">
                        {shoot.event_type} · {formatTime(shoot.start_time)}
                      </span>
                    </span>
                    <StatusBadge status={shoot.status} />
                  </button>
                ))}
            </div>
          </div>
        )}
      </section>
      {selectedShoot && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedShoot(null);
          }}
        >
          <section
            className="studio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-shoot-title"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
              {selectedShoot.event_type}
            </p>
            <h2 id="calendar-shoot-title" className="mt-2 font-serif text-3xl">
              {selectedShoot.couple_name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={selectedShoot.status} />
              <span className="text-xs text-[#b8adb2]">
                {format(parseISO(selectedShoot.event_date), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <dl className="mt-6 grid gap-4 border-y border-[#30282e] py-5 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">Time</dt>
                <dd className="mt-1 text-sm text-[#f7f0ee]">
                  {formatTime(selectedShoot.start_time)}
                  {selectedShoot.end_time ? ` – ${formatTime(selectedShoot.end_time)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">
                  Team plan
                </dt>
                <dd className="mt-1 text-sm text-[#f7f0ee]">
                  {selectedShoot.planned_team_size} people
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">Location</dt>
                <dd className="mt-1 text-sm text-[#f7f0ee]">
                  {selectedShoot.venue ? `${selectedShoot.venue} · ` : ""}
                  {selectedShoot.location}
                </dd>
              </div>
              {selectedShoot.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#82767d]">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-[#b8adb2]">
                    {selectedShoot.notes}
                  </dd>
                </div>
              )}
            </dl>
            {/* Assigned Crew Section */}
            {selectedShoot &&
              (() => {
                const shootAssignments = assignments.filter((a) => a.shoot_id === selectedShoot.id);
                const assignedDetails = shootAssignments
                  .map((a) => ({
                    ...a,
                    member: team.find((m) => m.id === a.team_member_id),
                  }))
                  .filter((a): a is typeof a & { member: TeamMember } => Boolean(a.member));
                const metrics = calculateStaffingMetrics(
                  selectedShoot.planned_team_size,
                  shootAssignments,
                );

                return (
                  <div className="mt-4 border-t border-[#30282e] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d9b98c]">
                        Assigned Crew ({assignedDetails.length})
                      </p>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                          metrics.staffingStatus === "Fully Staffed"
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : metrics.staffingStatus === "Overstaffed"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              : "bg-red-500/10 text-red-300 border border-red-500/20"
                        }`}
                      >
                        {metrics.staffingStatus} ({metrics.assignedCrew}/
                        {selectedShoot.planned_team_size} on-site)
                      </span>
                    </div>

                    {assignedDetails.length === 0 ? (
                      <p className="text-xs text-[#82767d] italic">
                        No crew assigned to this celebration yet.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 max-h-[160px] overflow-y-auto pr-1">
                        {assignedDetails.map(({ member, assignment_type }) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2.5 rounded-xl border border-[#30282e] bg-[#1a161c] p-2 text-xs"
                          >
                            <Avatar name={member.full_name} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-[#f7f0ee]">
                                {member.full_name}
                              </p>
                              <p className="truncate text-[11px] text-[#82767d]">
                                {member.role} ·{" "}
                                <span className="capitalize">
                                  {assignment_type.replace("_", " ")}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

            <div className="mt-5 flex justify-end gap-2 border-t border-[#30282e] pt-4">
              {onEditShoot && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const target = selectedShoot;
                    setSelectedShoot(null);
                    onEditShoot(target);
                  }}
                >
                  Edit shoot & crew
                </Button>
              )}
              <Button type="button" onClick={() => setSelectedShoot(null)}>
                Close
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function TeamView({
  team,
  loading,
  externalQuery = "",
  editable,
  onSaveTeamMember,
  onDeleteTeamMember,
}: {
  team: TeamMember[];
  loading: boolean;
  externalQuery?: string;
  editable: boolean;
  onSaveTeamMember: (values: TeamMemberInput, memberId?: string) => Promise<void>;
  onDeleteTeamMember: (memberId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState(externalQuery);
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [availability, setAvailability] = useState("All availability");
  const [editingMember, setEditingMember] = useState<TeamMember | null | undefined>(undefined);
  const [actionError, setActionError] = useState("");
  useEffect(() => setQuery(externalQuery), [externalQuery]);
  const filteredTeam = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return team.filter((member) => {
      const matchesQuery = [member.full_name, member.role, member.email ?? "", member.phone ?? ""]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
      const matchesRole = roleFilter === "All roles" || member.role === roleFilter;
      const matchesAvailability =
        availability === "All availability" ||
        (availability === "Available" ? member.available : !member.available);
      return matchesQuery && matchesRole && matchesAvailability;
    });
  }, [availability, query, roleFilter, team]);

  async function confirmDelete(member: TeamMember) {
    if (!window.confirm(`Remove ${member.full_name} from the studio team?`)) return;
    setActionError("");
    try {
      await onDeleteTeamMember(member.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not remove this team member.");
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30282e] px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-[#3e453d]">Meet your team</h2>
            <p className="mt-1 text-xs text-[#929086]">
              {team.length} {team.length === 1 ? "person" : "people"} in your studio
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative block min-w-[180px] flex-1 sm:max-w-[240px]">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a09d93]"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your team…"
                aria-label="Search team"
                className="h-10 border-[#e6e4dd] pl-9 text-sm"
              />
            </label>
            <select
              className="h-10 rounded-md border px-3 text-xs"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option>All roles</option>
              <option>Photographer</option>
              <option>Videographer</option>
              <option>Photo Editor</option>
              <option>Video Editor</option>
              <option>Album Designer</option>
              <option>Cinematographer / Creative Director</option>
              <option>Drone Operator</option>
              <option>Assistant Photographer</option>
              <option>Assistant Videographer</option>
              <option>Lighting Assistant</option>
              <option>Data Manager / Footage Backup Assistant</option>
            </select>
            <select
              className="h-10 rounded-md border px-3 text-xs"
              aria-label="Filter by availability"
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
            >
              <option>All availability</option>
              <option>Available</option>
              <option>Unavailable</option>
            </select>
            {editable && (
              <Button
                className="h-10 gap-2 rounded-lg bg-[#344234] text-xs text-white"
                onClick={() => setEditingMember(null)}
              >
                <Plus className="size-4" /> Add member
              </Button>
            )}
          </div>
        </div>
        {actionError && (
          <p className="border-b border-red-200 px-5 py-3 text-xs text-red-700" role="alert">
            {actionError}
          </p>
        )}
        {loading && team.length === 0 ? (
          <LoadingRows />
        ) : filteredTeam.length === 0 ? (
          <EmptyState
            title={query ? "No team members found." : "Your team is ready to meet."}
            detail={
              query
                ? "Try another name, role, or contact detail."
                : "Team members will appear here once added."
            }
          />
        ) : (
          <div className="grid gap-px bg-[#30282e] sm:grid-cols-2 xl:grid-cols-3">
            {filteredTeam.map((member) => (
              <article key={member.id} className="flex min-w-0 items-start gap-3 bg-[#151317] p-5">
                <Avatar name={member.full_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#444941]">
                      {member.full_name}
                    </p>
                    <Availability available={member.available} />
                  </div>
                  <p className="mt-1 text-xs text-[#87867d]">{member.role}</p>
                  {member.status && member.status !== "active" && (
                    <span className="mt-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 border border-amber-500/20 capitalize">
                      {member.status.replace("_", " ")}
                    </span>
                  )}
                  {member.additional_skills && member.additional_skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {member.additional_skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-sm bg-[#1b181d] px-1.5 py-0.5 text-[10px] text-[#b8adb2] border border-[#30282e]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {member.email && (
                    <a
                      className="mt-3 block truncate text-xs text-[#75806c] hover:underline"
                      href={`mailto:${member.email}`}
                    >
                      {member.email}
                    </a>
                  )}
                  {member.phone && (
                    <a
                      className="mt-1 block text-xs text-[#75806c] hover:underline"
                      href={`tel:${member.phone}`}
                    >
                      {member.phone}
                    </a>
                  )}
                  {editable && member.admin_notes && (
                    <p className="mt-2 rounded bg-[#1b181d] p-1.5 text-[10px] text-[#d9b98c] italic border border-[#30282e]">
                      Note: {member.admin_notes}
                    </p>
                  )}
                  {editable && (
                    <div className="mt-4 flex gap-3 border-t border-[#f0efe9] pt-3 text-xs">
                      <button
                        type="button"
                        className="text-[#586651] hover:underline"
                        onClick={() => setEditingMember(member)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[#96615b] hover:underline"
                        onClick={() => void confirmDelete(member)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {editingMember !== undefined && (
        <TeamMemberEditor
          key={editingMember?.id ?? "new-member"}
          member={editingMember}
          onClose={() => setEditingMember(undefined)}
          onSave={onSaveTeamMember}
        />
      )}
    </>
  );
}

function TeamMemberEditor({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSave: (values: TeamMemberInput, memberId?: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const status = String(form.get("status") ?? "active") as "active" | "inactive" | "on_leave";
    const emergencyContact = String(form.get("emergency_contact") ?? "").trim();
    const adminNotes = String(form.get("admin_notes") ?? "").trim();
    const skillsRaw = String(form.get("additional_skills") ?? "").trim();
    const additionalSkills = skillsRaw
      ? skillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const values: TeamMemberInput = {
      full_name: String(form.get("full_name") ?? "").trim(),
      role: String(form.get("role") ?? "Photographer"),
      email: email || null,
      phone: phone || null,
      available: form.get("available") === "on",
      notes: notes || null,
      status,
      emergency_contact: emergencyContact || null,
      admin_notes: adminNotes || null,
      additional_skills: additionalSkills,
    };
    try {
      await onSave(values, member?.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save team member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-editor-title"
      >
        <div className="mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a8c77]">
            STUDIO ROSTER
          </p>
          <h2 id="member-editor-title" className="mt-2 font-serif text-2xl">
            {member ? "Edit team member" : "Add team member"}
          </h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="studio-field sm:col-span-2">
              Full name
              <Input
                name="full_name"
                defaultValue={member?.full_name}
                maxLength={100}
                required
                autoFocus
              />
            </label>
            <label className="studio-field">
              Primary Role
              <select name="role" defaultValue={member?.role ?? "Photographer"} required>
                <option>Photographer</option>
                <option>Videographer</option>
                <option>Photo Editor</option>
                <option>Video Editor</option>
                <option>Album Designer</option>
                <option>Cinematographer / Creative Director</option>
                <option>Drone Operator</option>
                <option>Assistant Photographer</option>
                <option>Assistant Videographer</option>
                <option>Lighting Assistant</option>
                <option>Data Manager / Footage Backup Assistant</option>
              </select>
            </label>
            <label className="studio-field">
              Membership Status
              <select name="status" defaultValue={member?.status ?? "active"} required>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </label>
            <label className="studio-field">
              Email address <span className="font-normal text-[#82767d]">· optional</span>
              <Input name="email" type="email" defaultValue={member?.email ?? ""} maxLength={255} />
            </label>
            <label className="studio-field">
              Phone number <span className="font-normal text-[#82767d]">· optional</span>
              <Input name="phone" defaultValue={member?.phone ?? ""} maxLength={32} />
            </label>
            <label className="studio-field sm:col-span-2">
              Additional Skills{" "}
              <span className="font-normal text-[#82767d]">· comma separated</span>
              <Input
                name="additional_skills"
                placeholder="e.g. Drone Piloting, Gimbal Operator, Color Grading"
                defaultValue={member?.additional_skills?.join(", ") ?? ""}
              />
            </label>
            <label className="studio-field sm:col-span-2">
              Emergency Contact <span className="font-normal text-[#82767d]">· optional</span>
              <Input
                name="emergency_contact"
                placeholder="Name and phone"
                defaultValue={member?.emergency_contact ?? ""}
              />
            </label>
            <label className="flex items-center gap-2 pt-1 text-xs text-[#f7f0ee] sm:col-span-2">
              <input name="available" type="checkbox" defaultChecked={member?.available ?? true} />
              Available for new shoot assignments
            </label>
            <label className="studio-field sm:col-span-2">
              Worker Notes <span className="font-normal text-[#82767d]">· optional</span>
              <textarea name="notes" maxLength={1000} defaultValue={member?.notes ?? ""} rows={2} />
            </label>
            <label className="studio-field sm:col-span-2">
              Administrative Notes{" "}
              <span className="font-normal text-[#e7a0ad]">· confidential</span>
              <textarea
                name="admin_notes"
                placeholder="Internal notes visible to administrators only"
                maxLength={1000}
                defaultValue={member?.admin_notes ?? ""}
                rows={2}
              />
            </label>
          </div>
          {error && (
            <p
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : member ? "Save changes" : "Add member"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ShootRow({
  shoot,
  assignedCount,
  assignedMembers = [],
  staffingMetrics,
  onEdit,
  onDelete,
  onAssign,
}: {
  shoot: Shoot;
  assignedCount?: number | undefined;
  assignedMembers?: Array<{ id: string; name: string; role: string; type: string }> | undefined;
  staffingMetrics?: ReturnType<typeof calculateStaffingMetrics> | undefined;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onAssign?: (() => void) | undefined;
}) {
  return (
    <article className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f1f2ed] text-center text-[#59654f]">
        <span className="text-[9px] font-semibold uppercase leading-none">
          {format(parseISO(shoot.event_date), "MMM")}
        </span>
        <span className="font-serif text-lg leading-none">
          {format(parseISO(shoot.event_date), "d")}
        </span>
      </div>
      <div className="min-w-[155px] flex-1">
        <p className="text-sm font-medium text-[#42483f]">{shoot.couple_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#8d8b81]">
          <span>{shoot.event_type}</span>
          {staffingMetrics ? (
            <>
              <span>·</span>
              <span className="font-medium text-[#42483f]">
                {staffingMetrics.assignedCrew}/{shoot.planned_team_size} crew
              </span>
              {staffingMetrics.additionalCrewRequired > 0 && (
                <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  Needs {staffingMetrics.additionalCrewRequired} more
                </span>
              )}
              {staffingMetrics.remainingCapacity === 0 && (
                <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                  Max capacity (20)
                </span>
              )}
            </>
          ) : assignedCount !== undefined ? (
            <span>
              {" "}
              · {assignedCount}/{shoot.planned_team_size} assigned
            </span>
          ) : null}
        </div>
      </div>
      <div className="hidden min-w-[150px] items-center gap-2 text-xs text-[#77786f] md:flex">
        <MapPin className="size-3.5 shrink-0 text-[#a19e93]" aria-hidden="true" />
        <span className="truncate">{shoot.venue || shoot.location}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-[#77786f]">
        <Clock3 className="size-3.5 text-[#a19e93]" aria-hidden="true" />
        {formatTime(shoot.start_time)}
      </div>
      <StatusBadge status={shoot.status} />
      {(onAssign || onEdit || onDelete) && (
        <div className="flex items-center gap-1 sm:ml-auto">
          {onAssign && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-[#e9e7df] text-xs text-[#586651]"
              onClick={onAssign}
            >
              <Users className="size-3.5" /> Assign
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-[#586651]"
              onClick={onEdit}
              aria-label={`Edit ${shoot.couple_name}`}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-[#96615b]"
              onClick={onDelete}
              aria-label={`Delete ${shoot.couple_name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}
      {assignedMembers.length > 0 && (
        <div className="mt-1 flex w-full flex-wrap items-center gap-1.5 border-t border-[#f4f3ee] pt-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#99968c]">
            Crew ({assignedMembers.length}):
          </span>
          {assignedMembers.map((m) => (
            <span
              key={m.id + m.type}
              className="inline-flex items-center gap-1 rounded-md border border-[#e9e7df] bg-[#f8f7f4] px-2 py-0.5 text-[11px] text-[#42483f]"
            >
              <span className="font-medium">{m.name}</span>
              <span className="text-[#8d8b81]">({m.role})</span>
              {m.type === "post_production" && (
                <span className="rounded bg-[#dedad2] px-1 text-[9px] text-[#555]">Post</span>
              )}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    Upcoming: "bg-[#eef0eb] text-[#56634f]",
    "In Progress": "bg-[#fbf2e6] text-[#9a713c]",
    Completed: "bg-[#edf3ef] text-[#587462]",
    Cancelled: "bg-[#f7ecea] text-[#96615b]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${palette[status] ?? "bg-[#f1f0eb] text-[#77786f]"}`}
    >
      {status}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9ece5] text-xs font-semibold text-[#59654f]"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function Availability({ available }: { available: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 text-[10px] ${
        available ? "text-[#69806a]" : "text-[#969287]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${available ? "bg-[#82a17f]" : "bg-[#c0bdb3]"}`} />
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 px-5 py-5" aria-label="Loading studio data">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex animate-pulse items-center gap-3">
          <span className="size-10 rounded-xl bg-[#f0efe9]" />
          <span className="h-3 w-36 rounded bg-[#f0efe9]" />
          <span className="ml-auto h-3 w-20 rounded bg-[#f0efe9]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-5 py-10 text-center sm:py-12">
      <p className="font-serif text-lg text-[#52594e]">{title}</p>
      <p className="mt-2 text-xs text-[#929086]">{detail}</p>
    </div>
  );
}

function formatTime(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  return format(new Date(2000, 0, 1, Number(hours), Number(minutes)), "h:mm a");
}

function timeInMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
