import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  Layers,
  PieChart as PieIcon,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";
import {
  calculateShootProfitability,
  calculateStudioTotals,
  computeInvoiceBalance,
  computePayrollBalance,
  formatCurrency,
  type ClientInvoiceRecord,
  type ClientPaymentRecord,
  type PayrollObligationRecord,
  type WorkerPaymentRecord,
  type OperatingExpenseRecord,
  type ShootProfitabilitySummary,
} from "@/lib/finance";

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;

interface FinanceSectionProps {
  isAdmin: boolean;
  shoots: Shoot[];
  team: TeamMember[];
  invoices: ClientInvoiceRecord[];
  clientPayments: ClientPaymentRecord[];
  payroll: PayrollObligationRecord[];
  workerPayments: WorkerPaymentRecord[];
  expenses: OperatingExpenseRecord[];
  onCreateInvoice?: ((data: any) => Promise<void>) | undefined;
  onRecordClientPayment?: ((data: any) => Promise<void>) | undefined;
  onCreatePayrollObligation?: ((data: any) => Promise<void>) | undefined;
  onDisburseWorkerPayment?: ((data: any) => Promise<void>) | undefined;
  onRecordExpense?: ((data: any) => Promise<void>) | undefined;
  onApprovePayroll?: ((obligationId: string) => Promise<void>) | undefined;
  onApproveExpense?: ((expenseId: string) => Promise<void>) | undefined;
  loading?: boolean | undefined;
}

const LUXURY_PALETTE = [
  "#c56c7d", // Rose
  "#e7a0ad", // Blush
  "#d9b98c", // Champagne
  "#762d40", // Burgundy
  "#91c1fa", // Blue
  "#71d8aa", // Mint
  "#f1b75a", // Gold
  "#a08d96", // Mauve
];

export function FinanceSection({
  isAdmin,
  shoots,
  team,
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
  loading = false,
}: FinanceSectionProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "shoots" | "payroll" | "expenses" | "billing" | "reports"
  >("overview");
  const [dateFilter, setDateFilter] = useState<"all" | "thisMonth" | "lastMonth" | "thisYear">(
    "all",
  );
  const [selectedShootId, setSelectedShootId] = useState<string>("all");

  // Modal Dialog States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Submitting States
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Printable Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<{
    title: string;
    receiptNo: string;
    date: string;
    recipientOrPayer: string;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
  } | null>(null);

  // Filtered Datasets based on selected date range & shoot
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (selectedShootId !== "all" && inv.shoot_id !== selectedShootId) return false;
      return true;
    });
  }, [invoices, selectedShootId]);

  const filteredClientPayments = useMemo(() => {
    return clientPayments.filter((p) => {
      if (selectedShootId !== "all" && p.shoot_id !== selectedShootId) return false;
      return true;
    });
  }, [clientPayments, selectedShootId]);

  const filteredPayroll = useMemo(() => {
    return payroll.filter((pr) => {
      if (selectedShootId !== "all" && pr.shoot_id !== selectedShootId) return false;
      return true;
    });
  }, [payroll, selectedShootId]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedShootId !== "all" && e.shoot_id !== selectedShootId) return false;
      return true;
    });
  }, [expenses, selectedShootId]);

  // Overall Totals
  const studioTotals = useMemo(() => {
    return calculateStudioTotals(
      filteredInvoices,
      filteredClientPayments,
      filteredPayroll,
      workerPayments,
      filteredExpenses,
    );
  }, [filteredInvoices, filteredClientPayments, filteredPayroll, workerPayments, filteredExpenses]);

  // Shoot Level Profitability Table
  const shootProfitabilityList = useMemo(() => {
    const totalOverhead = expenses
      .filter((e) => !e.is_direct_cost && e.status !== "cancelled")
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const activeShoots = shoots.filter((s) => s.status !== "Cancelled");
    return activeShoots.map((s) =>
      calculateShootProfitability(
        s,
        invoices,
        clientPayments,
        payroll,
        expenses,
        totalOverhead,
        activeShoots.length,
      ),
    );
  }, [shoots, invoices, clientPayments, payroll, expenses]);

  // Monthly Revenue vs Expense Trend
  const monthlyTrends = useMemo(() => {
    const monthsMap: Record<
      string,
      { month: string; revenue: number; expense: number; profit: number }
    > = {};
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "MMM yyyy");
      monthsMap[key] = { month: key, revenue: 0, expense: 0, profit: 0 };
    }

    invoices.forEach((inv) => {
      if (inv.status === "cancelled") return;
      const key = format(parseISO(inv.issue_date), "MMM yyyy");
      if (monthsMap[key]) {
        monthsMap[key].revenue += Number(inv.total_billed);
      }
    });

    expenses.forEach((exp) => {
      if (exp.status === "cancelled") return;
      const key = format(parseISO(exp.expense_date), "MMM yyyy");
      if (monthsMap[key]) {
        monthsMap[key].expense += Number(exp.amount);
      }
    });

    payroll.forEach((pr) => {
      if (pr.status === "cancelled") return;
      const dateStr = pr.created_at || pr.approved_at || format(new Date(), "yyyy-MM-dd");
      const key = format(parseISO(dateStr), "MMM yyyy");
      if (monthsMap[key]) {
        monthsMap[key].expense += Number(pr.net_payable);
      }
    });

    return Object.values(monthsMap).map((m) => ({
      ...m,
      profit: m.revenue - m.expense,
    }));
  }, [invoices, expenses, payroll]);

  // Category Distribution (Donut)
  const expenseCategoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.status === "cancelled") return;
      counts[e.category] = (counts[e.category] || 0) + Number(e.amount);
    });
    // Add worker compensation as an expense category
    const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.net_payable), 0);
    if (totalPayroll > 0) {
      counts["Worker Payroll"] = totalPayroll;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [expenses, payroll]);

  // --- Handlers ---
  async function handleCreateInvoiceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onCreateInvoice) return;
    setSubmitting(true);
    setActionError("");
    const form = new FormData(e.currentTarget);
    try {
      await onCreateInvoice({
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        shoot_id: String(form.get("shoot_id")),
        client_name: String(form.get("client_name")).trim(),
        agreed_price: Number(form.get("agreed_price")),
        additional_charges: Number(form.get("additional_charges") || 0),
        discount_amount: Number(form.get("discount_amount") || 0),
        tax_amount: Number(form.get("tax_amount") || 0),
        issue_date: String(form.get("issue_date")),
        due_date: String(form.get("due_date")),
        status: "issued",
        notes: String(form.get("notes") || "").trim() || null,
      });
      setActionSuccess("Client invoice created successfully!");
      setShowInvoiceModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordPaymentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onRecordClientPayment) return;
    setSubmitting(true);
    setActionError("");
    const form = new FormData(e.currentTarget);
    const invoiceId = String(form.get("invoice_id"));
    const inv = invoices.find((i) => i.id === invoiceId);
    try {
      const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
      const amount = Number(form.get("amount"));
      const pDate = String(form.get("payment_date"));
      const method = String(form.get("payment_method"));
      const ref = String(form.get("transaction_reference") || "").trim() || null;
      const notes = String(form.get("notes") || "").trim() || null;

      await onRecordClientPayment({
        receipt_number: receiptNo,
        invoice_id: invoiceId,
        shoot_id: inv?.shoot_id || "",
        amount,
        payment_date: pDate,
        payment_method: method,
        transaction_reference: ref,
        notes,
        is_reversed: false,
      });
      setActionSuccess("Client payment recorded in ledger!");
      setShowPaymentModal(false);

      // Offer immediate printable receipt
      setActiveReceipt({
        title: "Client Payment Receipt",
        receiptNo,
        date: pDate,
        recipientOrPayer: inv?.client_name || "Valued Client",
        amount,
        method,
        reference: ref,
        notes,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePayrollSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onCreatePayrollObligation) return;
    setSubmitting(true);
    setActionError("");
    const form = new FormData(e.currentTarget);
    const workerId = String(form.get("worker_id"));
    const shootId = String(form.get("shoot_id") || "");
    const compType = String(form.get("compensation_type"));
    const periodLabel = String(form.get("period_label")).trim();

    // Prevent duplicate monthly salary for same worker and period
    if (compType === "monthly_salary") {
      const duplicate = payroll.some(
        (p) =>
          p.worker_id === workerId &&
          p.period_label.toLowerCase() === periodLabel.toLowerCase() &&
          p.compensation_type === "monthly_salary" &&
          p.status !== "cancelled",
      );
      if (duplicate) {
        setActionError(
          `A salary obligation for ${periodLabel} already exists for this team member.`,
        );
        setSubmitting(false);
        return;
      }
    }

    try {
      await onCreatePayrollObligation({
        worker_id: workerId,
        shoot_id: shootId || null,
        period_label: periodLabel,
        compensation_type: compType,
        base_amount: Number(form.get("base_amount")),
        allowance_amount: Number(form.get("allowance_amount") || 0),
        deduction_amount: Number(form.get("deduction_amount") || 0),
        status: "approved",
      });
      setActionSuccess("Payroll compensation obligation generated!");
      setShowPayrollModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create payroll obligation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisburseWorkerPaymentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onDisburseWorkerPayment) return;
    setSubmitting(true);
    setActionError("");
    const form = new FormData(e.currentTarget);
    const oblId = String(form.get("obligation_id"));
    const obl = payroll.find((o) => o.id === oblId);
    const worker = team.find((w) => w.id === obl?.worker_id);
    const voucherNo = `VOUCH-${Date.now().toString().slice(-6)}`;
    const amount = Number(form.get("amount"));
    const disDate = String(form.get("disbursement_date"));
    const method = String(form.get("payment_method"));
    const ref = String(form.get("transaction_reference") || "").trim() || null;
    const notes = String(form.get("notes") || "").trim() || null;

    try {
      await onDisburseWorkerPayment({
        payment_voucher_no: voucherNo,
        obligation_id: oblId,
        worker_id: obl?.worker_id || "",
        amount,
        disbursement_date: disDate,
        payment_method: method,
        transaction_reference: ref,
        notes,
        is_reversed: false,
      });
      setActionSuccess("Worker compensation payment disbursed and logged!");
      setShowDisburseModal(false);

      setActiveReceipt({
        title: "Worker Compensation Voucher",
        receiptNo: voucherNo,
        date: disDate,
        recipientOrPayer: worker?.full_name || "Team Member",
        amount,
        method,
        reference: ref,
        notes,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record disbursement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordExpenseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onRecordExpense) return;
    setSubmitting(true);
    setActionError("");
    const form = new FormData(e.currentTarget);
    const expNo = `EXP-${Date.now().toString().slice(-6)}`;
    const isDirect = form.get("is_direct_cost") === "on";
    const shootId = String(form.get("shoot_id") || "");

    try {
      await onRecordExpense({
        expense_number: expNo,
        category: String(form.get("category")),
        payee_supplier: String(form.get("payee_supplier")).trim(),
        description: String(form.get("description")).trim(),
        amount: Number(form.get("amount")),
        expense_date: String(form.get("expense_date")),
        due_date: String(form.get("due_date") || "") || null,
        is_direct_cost: isDirect,
        shoot_id: isDirect && shootId ? shootId : null,
        payment_method: String(form.get("payment_method")),
        payment_status: "paid",
        amount_paid: Number(form.get("amount")),
        status: "recorded",
      });
      setActionSuccess("Operating expense recorded in ledger!");
      setShowExpenseModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#30282e] bg-[#151317] p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl text-[#f7f0ee]">Studio ERP & Finance Ledger</h2>
            <span className="rounded-md bg-[#24171e] border border-[#40323a] px-2 py-0.5 text-[10px] text-[#d9b98c] font-medium">
              INR (₹) Ledger
            </span>
          </div>
          <p className="mt-1 text-xs text-[#82767d]">
            Private manual accounting ledger, client receivables, crew payroll, operating expenses,
            and event profitability.
          </p>
        </div>

        {/* Action Buttons for Admin */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowInvoiceModal(true)}
              className="gap-1.5 bg-[#c56c7d] text-xs font-medium text-[#0b0a0c] hover:bg-[#e7a0ad]"
            >
              <Plus className="size-3.5" />
              Invoice Client
            </Button>
            <Button
              size="sm"
              onClick={() => setShowPaymentModal(true)}
              variant="outline"
              className="gap-1.5 border-[#40323a] text-xs text-[#e7a0ad] hover:bg-[#24171e]"
            >
              <CreditCard className="size-3.5" />
              Receive Payment
            </Button>
            <Button
              size="sm"
              onClick={() => setShowPayrollModal(true)}
              variant="outline"
              className="gap-1.5 border-[#40323a] text-xs text-[#d9b98c] hover:bg-[#24171e]"
            >
              <Users className="size-3.5" />
              Pay Crew
            </Button>
            <Button
              size="sm"
              onClick={() => setShowExpenseModal(true)}
              variant="outline"
              className="gap-1.5 border-[#40323a] text-xs text-[#b8adb2] hover:bg-[#24171e]"
            >
              <Plus className="size-3.5" />
              Add Expense
            </Button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300"
          role="status"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess("")}
            className="underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError("")}
            className="underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30282e] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "overview", label: "Financial Overview", icon: TrendingUp },
            { id: "shoots", label: "Shoot Profitability", icon: DollarSign },
            { id: "payroll", label: "Crew Payroll", icon: Users },
            { id: "billing", label: "Client Invoices & Receipts", icon: Receipt },
            { id: "expenses", label: "Operating Expenses", icon: Wallet },
            { id: "reports", label: "Reports & Trends", icon: PieIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === id
                  ? "bg-[#762d40] text-[#f7f0ee]"
                  : "text-[#82767d] hover:text-[#f7f0ee]"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Global Shoot Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[#82767d]" />
          <select
            value={selectedShootId}
            onChange={(e) => setSelectedShootId(e.target.value)}
            className="rounded-lg border border-[#30282e] bg-[#1d171d] px-2.5 py-1 text-xs text-[#f7f0ee]"
          >
            <option value="all">All Studio Shoots</option>
            {shoots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.couple_name} ({s.event_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ----------------- TAB: FINANCIAL OVERVIEW ----------------- */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
              <div className="flex items-center justify-between text-[#82767d]">
                <span className="text-xs uppercase tracking-wider">Revenue Billed</span>
                <DollarSign className="size-4 text-[#e7a0ad]" />
              </div>
              <p className="mt-3 font-serif text-3xl text-[#f7f0ee]">
                {formatCurrency(studioTotals.totalRevenueBilled)}
              </p>
              <p className="mt-1 text-[11px] text-[#b8adb2]">Recognized contract billings</p>
            </div>

            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
              <div className="flex items-center justify-between text-[#82767d]">
                <span className="text-xs uppercase tracking-wider">Cash Collected</span>
                <ArrowDownRight className="size-4 text-[#71d8aa]" />
              </div>
              <p className="mt-3 font-serif text-3xl text-[#71d8aa]">
                {formatCurrency(studioTotals.totalCashCollected)}
              </p>
              <p className="mt-1 text-[11px] text-[#b8adb2]">Deposited client funds</p>
            </div>

            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
              <div className="flex items-center justify-between text-[#82767d]">
                <span className="text-xs uppercase tracking-wider">Total Costs & Expenses</span>
                <ArrowUpRight className="size-4 text-[#f16c78]" />
              </div>
              <p className="mt-3 font-serif text-3xl text-[#f16c78]">
                {formatCurrency(studioTotals.totalCostsAndExpenses)}
              </p>
              <p className="mt-1 text-[11px] text-[#b8adb2]">
                Payroll ({formatCurrency(studioTotals.totalPayrollAccrued)}) + Opex
              </p>
            </div>

            <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
              <div className="flex items-center justify-between text-[#82767d]">
                <span className="text-xs uppercase tracking-wider">Estimated Net Profit</span>
                <TrendingUp className="size-4 text-[#d9b98c]" />
              </div>
              <p
                className={`mt-3 font-serif text-3xl ${
                  studioTotals.estimatedNetProfit >= 0 ? "text-[#d9b98c]" : "text-[#f16c78]"
                }`}
              >
                {formatCurrency(studioTotals.estimatedNetProfit)}
              </p>
              <p className="mt-1 text-[11px] text-[#b8adb2]">
                {studioTotals.totalRevenueBilled > 0
                  ? `${Math.round((studioTotals.estimatedNetProfit / studioTotals.totalRevenueBilled) * 100)}% operational margin`
                  : "Operational estimate"}
              </p>
            </div>
          </div>

          {/* Secondary Liquidity & Obligations Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#30282e] bg-[#1d171d] p-4 text-xs">
              <span className="text-[#82767d]">Client Receivables Outstanding</span>
              <p className="mt-1 font-serif text-xl text-[#f1b75a]">
                {formatCurrency(studioTotals.totalClientOutstanding)}
              </p>
              <p className="text-[11px] text-[#82767d]">Pending collection from clients</p>
            </div>
            <div className="rounded-xl border border-[#30282e] bg-[#1d171d] p-4 text-xs">
              <span className="text-[#82767d]">Worker Payroll Outstanding</span>
              <p className="mt-1 font-serif text-xl text-[#f16c78]">
                {formatCurrency(studioTotals.totalPayrollOutstanding)}
              </p>
              <p className="text-[11px] text-[#82767d]">Approved crew compensation payable</p>
            </div>
            <div className="rounded-xl border border-[#30282e] bg-[#1d171d] p-4 text-xs">
              <span className="text-[#82767d]">Net Operating Cash Flow</span>
              <p
                className={`mt-1 font-serif text-xl ${
                  studioTotals.operatingCashFlow >= 0 ? "text-[#71d8aa]" : "text-[#f16c78]"
                }`}
              >
                {formatCurrency(studioTotals.operatingCashFlow)}
              </p>
              <p className="text-[11px] text-[#82767d]">Realized cash in minus cash out</p>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-6">
            <div className="mb-4">
              <h3 className="font-serif text-xl text-[#f7f0ee]">
                6-Month Revenue, Expenses & Net Profit Trend
              </h3>
              <p className="text-xs text-[#82767d]">
                Monthly recognized billings versus total attributable expenses
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends}>
                  <XAxis dataKey="month" stroke="#82767d" fontSize={11} />
                  <YAxis stroke="#82767d" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1b181d",
                      borderColor: "#30282e",
                      borderRadius: "8px",
                      color: "#f7f0ee",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "#b8adb2" }} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue Billed"
                    fill="#c56c7d"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    name="Costs & Expenses"
                    fill="#762d40"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="profit" name="Net Profit" fill="#d9b98c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {/* ----------------- TAB: SHOOT PROFITABILITY ----------------- */}
      {activeTab === "shoots" && (
        <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317]">
          <div className="border-b border-[#30282e] p-5">
            <h3 className="font-serif text-xl text-[#f7f0ee]">Event Profitability Ledger</h3>
            <p className="text-xs text-[#82767d]">
              Direct attribution of revenue, crew payroll, rented equipment, and allocated overhead
              per wedding.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#30282e] text-[#82767d]">
                  <th className="py-3 px-5 font-medium">Couple / Shoot</th>
                  <th className="py-3 px-4 font-medium">Billed Revenue</th>
                  <th className="py-3 px-4 font-medium">Cash Collected</th>
                  <th className="py-3 px-4 font-medium">Direct Costs</th>
                  <th className="py-3 px-4 font-medium">Alloc. Overhead</th>
                  <th className="py-3 px-4 font-medium">Estimated Net Profit</th>
                  <th className="py-3 px-4 font-medium">Margin %</th>
                  <th className="py-3 px-5 font-medium">Client Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242026]">
                {shootProfitabilityList.map((item) => (
                  <tr key={item.shootId} className="hover:bg-[#1b181d] transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-[#f7f0ee]">{item.coupleName}</p>
                      <p className="text-[11px] text-[#82767d]">{item.eventType}</p>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#f7f0ee]">
                      {formatCurrency(item.recognizedRevenue)}
                    </td>
                    <td className="py-3.5 px-4 text-[#71d8aa]">
                      {formatCurrency(item.cashCollected)}
                    </td>
                    <td className="py-3.5 px-4 text-[#f16c78]">
                      {formatCurrency(item.totalDirectCosts)}
                    </td>
                    <td className="py-3.5 px-4 text-[#82767d]">
                      {formatCurrency(item.allocatedOverhead)}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-medium ${
                        item.estimatedNetProfit >= 0 ? "text-[#d9b98c]" : "text-[#f16c78]"
                      }`}
                    >
                      {formatCurrency(item.estimatedNetProfit)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.profitMarginPct >= 40
                            ? "bg-emerald-500/10 text-emerald-300"
                            : item.profitMarginPct > 0
                              ? "bg-amber-500/10 text-amber-300"
                              : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        {item.profitMarginPct}%
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#f1b75a]">
                      {item.outstandingClientBalance > 0
                        ? formatCurrency(item.outstandingClientBalance)
                        : "Settled"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ----------------- TAB: CREW PAYROLL ----------------- */}
      {activeTab === "payroll" && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30282e] p-5">
              <div>
                <h3 className="font-serif text-xl text-[#f7f0ee]">
                  Worker Compensation & Payroll Obligations
                </h3>
                <p className="text-xs text-[#82767d]">
                  Approve and disburse salary, per-shoot fees, allowances, and authorized
                  deductions.
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setShowPayrollModal(true)}
                    className="border border-[#762d40] bg-[#762d40]/40 text-xs font-medium text-[#f7f0ee] hover:bg-[#762d40]"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    Record Obligation
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowDisburseModal(true)}
                    className="bg-[#c56c7d] text-xs font-medium text-[#0b0a0c] hover:bg-[#e7a0ad]"
                  >
                    <Banknote className="size-3.5 mr-1.5" />
                    Disburse Payment
                  </Button>
                </div>
              )}
            </div>

            {filteredPayroll.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#82767d]">
                No payroll obligations recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#30282e] text-[#82767d]">
                      <th className="py-3 px-5 font-medium">Worker</th>
                      <th className="py-3 px-4 font-medium">Period / Event</th>
                      <th className="py-3 px-4 font-medium">Type</th>
                      <th className="py-3 px-4 font-medium">Net Payable</th>
                      <th className="py-3 px-4 font-medium">Paid</th>
                      <th className="py-3 px-4 font-medium">Due</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242026]">
                    {filteredPayroll.map((ob) => {
                      const worker = team.find((w) => w.id === ob.worker_id);
                      return (
                        <tr key={ob.id} className="hover:bg-[#1b181d] transition-colors">
                          <td className="py-3.5 px-5 font-medium text-[#f7f0ee]">
                            {worker?.full_name || "Unknown Worker"}
                          </td>
                          <td className="py-3.5 px-4 text-[#b8adb2]">{ob.period_label}</td>
                          <td className="py-3.5 px-4 capitalize text-[#82767d]">
                            {ob.compensation_type.replace("_", " ")}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#f7f0ee]">
                            {formatCurrency(ob.net_payable)}
                          </td>
                          <td className="py-3.5 px-4 text-[#71d8aa]">
                            {formatCurrency(ob.amount_paid)}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#f16c78]">
                            {formatCurrency(ob.balance_due)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                ob.status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : ob.status === "approved"
                                    ? "bg-amber-500/10 text-amber-300"
                                    : "bg-red-500/10 text-red-300"
                              }`}
                            >
                              {ob.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            {ob.balance_due > 0 && isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowDisburseModal(true)}
                                className="h-7 text-[11px] border-[#40323a] text-[#e7a0ad]"
                              >
                                Disburse
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ----------------- TAB: BILLING & INVOICES ----------------- */}
      {activeTab === "billing" && (
        <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317]">
          <div className="border-b border-[#30282e] p-5">
            <h3 className="font-serif text-xl text-[#f7f0ee]">Client Invoices & Manual Receipts</h3>
            <p className="text-xs text-[#82767d]">
              Audited records of client contract commitments, deposits, and payment receipts.
            </p>
          </div>
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#82767d]">
              No client invoices found. Click "Invoice Client" to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#30282e] text-[#82767d]">
                    <th className="py-3 px-5 font-medium">Invoice #</th>
                    <th className="py-3 px-4 font-medium">Client</th>
                    <th className="py-3 px-4 font-medium">Issue Date</th>
                    <th className="py-3 px-4 font-medium">Due Date</th>
                    <th className="py-3 px-4 font-medium">Billed Amount</th>
                    <th className="py-3 px-4 font-medium">Paid</th>
                    <th className="py-3 px-4 font-medium">Balance</th>
                    <th className="py-3 px-5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242026]">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#1b181d] transition-colors">
                      <td className="py-3.5 px-5 font-medium text-[#e7a0ad]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#f7f0ee]">{inv.client_name}</td>
                      <td className="py-3.5 px-4 text-[#82767d]">
                        {format(parseISO(inv.issue_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-3.5 px-4 text-[#82767d]">
                        {format(parseISO(inv.due_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#f7f0ee]">
                        {formatCurrency(inv.total_billed)}
                      </td>
                      <td className="py-3.5 px-4 text-[#71d8aa]">
                        {formatCurrency(inv.total_paid)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#f1b75a]">
                        {formatCurrency(inv.outstanding_balance)}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                            inv.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : inv.status === "partially_paid"
                                ? "bg-amber-500/10 text-amber-300"
                                : "bg-red-500/10 text-red-300"
                          }`}
                        >
                          {inv.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ----------------- TAB: OPERATING EXPENSES ----------------- */}
      {activeTab === "expenses" && (
        <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317]">
          <div className="border-b border-[#30282e] p-5">
            <h3 className="font-serif text-xl text-[#f7f0ee]">
              Operating Expenses & Supplier Ledger
            </h3>
            <p className="text-xs text-[#82767d]">
              Direct shoot rentals, album manufacturing, travel, studio rent, and software overhead.
            </p>
          </div>
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#82767d]">
              No expenses recorded yet. Click "Add Expense" to record one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#30282e] text-[#82767d]">
                    <th className="py-3 px-5 font-medium">Expense #</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Supplier / Payee</th>
                    <th className="py-3 px-4 font-medium">Description</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium">Cost Nature</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242026]">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#1b181d] transition-colors">
                      <td className="py-3.5 px-5 font-medium text-[#b8adb2]">
                        {exp.expense_number}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#d9b98c]">{exp.category}</td>
                      <td className="py-3.5 px-4 text-[#f7f0ee]">{exp.payee_supplier}</td>
                      <td className="py-3.5 px-4 text-[#82767d] max-w-xs truncate">
                        {exp.description}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#f16c78]">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-[#b8adb2]">
                        {exp.is_direct_cost ? "Direct Cost" : "General Overhead"}
                      </td>
                      <td className="py-3.5 px-4 text-[#82767d]">
                        {format(parseISO(exp.expense_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 capitalize">
                          {exp.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ----------------- TAB: REPORTS & BREAKDOWN ----------------- */}
      {activeTab === "reports" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Expense Category Donut */}
          <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-6">
            <h3 className="font-serif text-xl text-[#f7f0ee]">Expense Distribution by Category</h3>
            <p className="text-xs text-[#82767d] mb-4">
              Breakdown of studio outflows across production, crew and overhead
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseCategoryBreakdown.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={LUXURY_PALETTE[idx % LUXURY_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1b181d",
                      borderColor: "#30282e",
                      borderRadius: "8px",
                      color: "#f7f0ee",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "#b8adb2" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Revenue by Event Type */}
          <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-6">
            <h3 className="font-serif text-xl text-[#f7f0ee]">Revenue by Shoot Type</h3>
            <p className="text-xs text-[#82767d] mb-4">
              Contract value generated per celebration category
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      type: "Wedding",
                      revenue: invoices
                        .filter(
                          (i) => shoots.find((s) => s.id === i.shoot_id)?.event_type === "Wedding",
                        )
                        .reduce((sum, i) => sum + Number(i.total_billed), 0),
                    },
                    {
                      type: "Reception",
                      revenue: invoices
                        .filter(
                          (i) =>
                            shoots.find((s) => s.id === i.shoot_id)?.event_type === "Reception",
                        )
                        .reduce((sum, i) => sum + Number(i.total_billed), 0),
                    },
                    {
                      type: "Engagement",
                      revenue: invoices
                        .filter(
                          (i) =>
                            shoots.find((s) => s.id === i.shoot_id)?.event_type === "Engagement",
                        )
                        .reduce((sum, i) => sum + Number(i.total_billed), 0),
                    },
                    {
                      type: "Pre-wedding",
                      revenue: invoices
                        .filter(
                          (i) =>
                            shoots.find((s) => s.id === i.shoot_id)?.event_type === "Pre-wedding",
                        )
                        .reduce((sum, i) => sum + Number(i.total_billed), 0),
                    },
                  ]}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <XAxis
                    type="number"
                    stroke="#82767d"
                    fontSize={11}
                    tickFormatter={(v) => `₹${v / 1000}k`}
                  />
                  <YAxis dataKey="type" type="category" stroke="#82767d" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1b181d",
                      borderColor: "#30282e",
                      borderRadius: "8px",
                      color: "#f7f0ee",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => formatCurrency(Number(val))}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Billed Revenue"
                    fill="#c56c7d"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {/* ===================== MODAL: INVOICE CLIENT ===================== */}
      {showInvoiceModal && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInvoiceModal(false);
          }}
        >
          <section className="studio-modal" role="dialog" aria-modal="true">
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#e7a0ad]">
                CLIENT BILLING
              </p>
              <h2 className="mt-1 font-serif text-2xl text-[#f7f0ee]">Create Client Invoice</h2>
            </div>
            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <label className="studio-field">
                Select Shoot / Couple
                <select name="shoot_id" required>
                  {shoots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.couple_name} ({s.event_type} · {s.event_date})
                    </option>
                  ))}
                </select>
              </label>

              <label className="studio-field">
                Client / Billing Name
                <Input name="client_name" required placeholder="e.g. Maya & Arjun Family" />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Agreed Price (₹)
                  <Input name="agreed_price" type="number" min={0} step={100} required />
                </label>
                <label className="studio-field">
                  Additional Charges (₹)
                  <Input name="additional_charges" type="number" min={0} defaultValue={0} />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Discount (₹)
                  <Input name="discount_amount" type="number" min={0} defaultValue={0} />
                </label>
                <label className="studio-field">
                  Tax / GST (₹)
                  <Input name="tax_amount" type="number" min={0} defaultValue={0} />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Issue Date
                  <Input
                    name="issue_date"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </label>
                <label className="studio-field">
                  Payment Due Date
                  <Input name="due_date" type="date" required />
                </label>
              </div>

              <label className="studio-field">
                Notes
                <textarea
                  name="notes"
                  rows={2}
                  className="rounded-md border border-[#30282e] bg-[#1d171d] p-2 text-xs text-[#f7f0ee]"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
                <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#c56c7d] text-[#0b0a0c] hover:bg-[#e7a0ad]"
                >
                  {submitting ? "Issuing…" : "Issue Invoice"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================== MODAL: RECORD CLIENT PAYMENT ===================== */}
      {showPaymentModal && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowPaymentModal(false);
          }}
        >
          <section className="studio-modal" role="dialog" aria-modal="true">
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#71d8aa]">
                CASH / BANK RECEIPT
              </p>
              <h2 className="mt-1 font-serif text-2xl text-[#f7f0ee]">Record Client Payment</h2>
            </div>
            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <label className="studio-field">
                Select Client Invoice
                <select name="invoice_id" required>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} · {inv.client_name} (Due:{" "}
                      {formatCurrency(inv.outstanding_balance)})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Amount Received (₹)
                  <Input name="amount" type="number" min={1} required />
                </label>
                <label className="studio-field">
                  Payment Date
                  <Input
                    name="payment_date"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Payment Method
                  <select name="payment_method" defaultValue="upi">
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit_card">Card</option>
                  </select>
                </label>
                <label className="studio-field">
                  Reference / UTR / Cheque #
                  <Input name="transaction_reference" placeholder="e.g. UTR-98234812" />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
                <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#71d8aa] text-[#0b0a0c] hover:bg-[#8eedc0]"
                >
                  {submitting ? "Recording…" : "Record Payment & Print Receipt"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================== MODAL: CREATE PAYROLL OBLIGATION ===================== */}
      {showPayrollModal && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowPayrollModal(false);
          }}
        >
          <section className="studio-modal" role="dialog" aria-modal="true">
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#d9b98c]">
                CREW PAYROLL
              </p>
              <h2 className="mt-1 font-serif text-2xl text-[#f7f0ee]">
                Add Compensation Obligation
              </h2>
            </div>
            <form onSubmit={handleCreatePayrollSubmit} className="space-y-4">
              <label className="studio-field">
                Select Worker
                <select name="worker_id" required>
                  {team.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name} ({w.role})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Compensation Model
                  <select name="compensation_type" defaultValue="per_shoot">
                    <option value="per_shoot">Per Shoot Fee</option>
                    <option value="monthly_salary">Monthly Salary</option>
                    <option value="per_day">Per Day Rate</option>
                    <option value="per_assignment">Per Assignment</option>
                    <option value="bonus">Bonus / Award</option>
                  </select>
                </label>
                <label className="studio-field">
                  Related Shoot <span className="text-[#82767d]">· optional</span>
                  <select name="shoot_id">
                    <option value="">Studio General (No shoot)</option>
                    {shoots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.couple_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="studio-field">
                Period Label / Shoot Description
                <Input
                  name="period_label"
                  required
                  placeholder="e.g. October 2026 or Maya & Arjun Wedding"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="studio-field">
                  Base Amount (₹)
                  <Input name="base_amount" type="number" min={0} required />
                </label>
                <label className="studio-field">
                  Allowance / Bonus (₹)
                  <Input name="allowance_amount" type="number" min={0} defaultValue={0} />
                </label>
                <label className="studio-field">
                  Advance Deductions (₹)
                  <Input name="deduction_amount" type="number" min={0} defaultValue={0} />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
                <Button type="button" variant="outline" onClick={() => setShowPayrollModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#c56c7d] text-[#0b0a0c] hover:bg-[#e7a0ad]"
                >
                  {submitting ? "Approving…" : "Approve Obligation"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================== MODAL: DISBURSE WORKER PAYMENT ===================== */}
      {showDisburseModal && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowDisburseModal(false);
          }}
        >
          <section className="studio-modal" role="dialog" aria-modal="true">
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#e7a0ad]">
                DISBURSEMENT VOUCHER
              </p>
              <h2 className="mt-1 font-serif text-2xl text-[#f7f0ee]">
                Record Worker Disbursement
              </h2>
            </div>
            <form onSubmit={handleDisburseWorkerPaymentSubmit} className="space-y-4">
              <label className="studio-field">
                Select Payable Obligation
                <select name="obligation_id" required>
                  {payroll
                    .filter((p) => p.balance_due > 0)
                    .map((p) => {
                      const worker = team.find((w) => w.id === p.worker_id);
                      return (
                        <option key={p.id} value={p.id}>
                          {worker?.full_name}: {p.period_label} (Due:{" "}
                          {formatCurrency(p.balance_due)})
                        </option>
                      );
                    })}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Amount Disbursed (₹)
                  <Input name="amount" type="number" min={1} required />
                </label>
                <label className="studio-field">
                  Disbursement Date
                  <Input
                    name="disbursement_date"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Payment Method
                  <select name="payment_method" defaultValue="bank_transfer">
                    <option value="bank_transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="upi">UPI / GPay</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>
                <label className="studio-field">
                  Transaction / UTR Reference
                  <Input name="transaction_reference" placeholder="e.g. UTR-39281923" />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
                <Button type="button" variant="outline" onClick={() => setShowDisburseModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#c56c7d] text-[#0b0a0c] hover:bg-[#e7a0ad]"
                >
                  {submitting ? "Disbursing…" : "Confirm Disbursement Voucher"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================== MODAL: ADD OPERATING EXPENSE ===================== */}
      {showExpenseModal && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowExpenseModal(false);
          }}
        >
          <section className="studio-modal" role="dialog" aria-modal="true">
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#f16c78]">
                STUDIO OUTFLOW
              </p>
              <h2 className="mt-1 font-serif text-2xl text-[#f7f0ee]">Record Operating Expense</h2>
            </div>
            <form onSubmit={handleRecordExpenseSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Category
                  <select name="category" defaultValue="Camera & Lighting Rentals">
                    <option>Camera & Lighting Rentals</option>
                    <option>Travel & Accommodation</option>
                    <option>Album Printing & Production</option>
                    <option>Editing & Post-Production</option>
                    <option>Meals & Event Logistics</option>
                    <option>Studio Rent & Utilities</option>
                    <option>Software Subscriptions</option>
                    <option>Marketing & Advertising</option>
                    <option>Equipment Purchases & Maintenance</option>
                    <option>Miscellaneous Expenses</option>
                  </select>
                </label>
                <label className="studio-field">
                  Payee / Vendor / Supplier
                  <Input name="payee_supplier" required placeholder="e.g. Canon Rental Hub" />
                </label>
              </div>

              <label className="studio-field">
                Description of Expense
                <Input
                  name="description"
                  required
                  placeholder="e.g. 2x Sony A7IV Cine bodies + 70-200 GM lens"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Amount (₹)
                  <Input name="amount" type="number" min={1} required />
                </label>
                <label className="studio-field">
                  Date
                  <Input
                    name="expense_date"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 pt-2 text-xs text-[#f7f0ee]">
                  <input name="is_direct_cost" type="checkbox" defaultChecked />
                  Direct Shoot Cost (check to attribute to an event)
                </label>
                <label className="studio-field">
                  Attributed Shoot
                  <select name="shoot_id">
                    <option value="">General Studio Overhead (No shoot)</option>
                    {shoots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.couple_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="studio-field">
                Payment Method
                <select name="payment_method" defaultValue="bank_transfer">
                  <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="upi">UPI / GPay</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Studio Card</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
                <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#c56c7d] text-[#0b0a0c] hover:bg-[#e7a0ad]"
                >
                  {submitting ? "Logging…" : "Record Expense"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================== PRINTABLE RECEIPT / VOUCHER MODAL ===================== */}
      {activeReceipt && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveReceipt(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#30282e] bg-[#151317] p-8 text-[#f7f0ee] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#30282e] pb-4">
              <div>
                <p className="font-serif text-lg tracking-widest text-[#e7a0ad]">TA BRIDALS</p>
                <p className="text-[10px] text-[#82767d]">OFFICIAL STUDIO RECEIPT</p>
              </div>
              <span className="font-mono text-xs text-[#d9b98c]">{activeReceipt.receiptNo}</span>
            </div>

            <div className="my-6 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#82767d]">Document Title:</span>
                <span className="font-medium">{activeReceipt.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#82767d]">Date of Transaction:</span>
                <span>{activeReceipt.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#82767d]">Party Name:</span>
                <span className="font-medium text-[#e7a0ad]">{activeReceipt.recipientOrPayer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#82767d]">Payment Channel:</span>
                <span className="capitalize">{activeReceipt.method.replace("_", " ")}</span>
              </div>
              {activeReceipt.reference && (
                <div className="flex justify-between">
                  <span className="text-[#82767d]">Reference / UTR:</span>
                  <span className="font-mono">{activeReceipt.reference}</span>
                </div>
              )}
              <div className="mt-4 border-t border-[#30282e] pt-4 flex justify-between items-center">
                <span className="text-sm font-semibold text-[#f7f0ee]">Amount Settled:</span>
                <span className="font-serif text-2xl text-[#71d8aa]">
                  {formatCurrency(activeReceipt.amount)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#30282e] pt-4">
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Download className="size-3.5 mr-1.5" />
                Print / Save PDF
              </Button>
              <Button size="sm" onClick={() => setActiveReceipt(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
