// Financial Calculations, Accounting Helpers & Profitability Engine
// Currency default: INR (₹)
// Follows conservative operational accrual principles:
// - Revenue Recognized = Total Billed on Issued/Completed/Active Shoots (or contracted price)
// - Cash Collected = Sum of non-reversed client payments
// - Direct Costs = Shoot-attributed expenses + worker compensation obligations allocated to shoot
// - Contribution Margin = Recognized Revenue - Direct Costs
// - Overhead Allocation = General studio operating expenses distributed across shoots (or period)
// - Estimated Net Profit = Contribution Margin - Allocated Overhead
// - Profit Margin % = (Estimated Net Profit / Recognized Revenue) * 100

export interface ClientInvoiceRecord {
  id: string;
  invoice_number: string;
  shoot_id: string;
  client_name: string;
  currency: string;
  agreed_price: number;
  additional_charges: number;
  discount_amount: number;
  tax_amount: number;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  issue_date: string;
  due_date: string;
  notes?: string | null;
}

export interface ClientPaymentRecord {
  id: string;
  receipt_number: string;
  invoice_id: string;
  shoot_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_reference?: string | null;
  payment_date: string;
  is_reversed: boolean;
  notes?: string | null;
}

export interface PayrollObligationRecord {
  id: string;
  worker_id: string;
  shoot_id?: string | null;
  period_label: string;
  compensation_type:
    "monthly_salary" | "per_shoot" | "per_day" | "per_assignment" | "bonus" | "adjustment";
  base_amount: number;
  allowance_amount: number;
  deduction_amount: number;
  net_payable: number;
  amount_paid: number;
  balance_due: number;
  status: "draft" | "submitted" | "approved" | "partially_paid" | "paid" | "disputed" | "cancelled";
  approved_at?: string | null;
  created_at?: string;
  notes?: string | null;
}

export interface WorkerPaymentRecord {
  id: string;
  payment_voucher_no: string;
  obligation_id: string;
  worker_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_reference?: string | null;
  disbursement_date: string;
  is_reversed: boolean;
  notes?: string | null;
}

export interface OperatingExpenseRecord {
  id: string;
  expense_number: string;
  category: string;
  payee_supplier: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  due_date?: string | null;
  is_direct_cost: boolean;
  shoot_id?: string | null;
  payment_method: string;
  payment_status: "paid" | "partially_paid" | "unpaid";
  amount_paid: number;
  status: "submitted" | "approved" | "rejected" | "recorded" | "cancelled";
  notes?: string | null;
}

export interface ShootProfitabilitySummary {
  shootId: string;
  coupleName: string;
  eventType: string;
  eventDate: string;
  currency: string;
  agreedPrice: number;
  recognizedRevenue: number;
  cashCollected: number;
  outstandingClientBalance: number;
  allocatedWorkerCost: number;
  allocatedDirectExpenses: number;
  totalDirectCosts: number;
  contributionMargin: number;
  allocatedOverhead: number;
  estimatedNetProfit: number;
  profitMarginPct: number;
  isFullyPaid: boolean;
}

export interface StudioFinancialOverview {
  totalRevenueBilled: number;
  totalCashCollected: number;
  totalClientOutstanding: number;
  totalOperatingExpenses: number;
  totalDirectExpenses: number;
  totalOverheadExpenses: number;
  totalPayrollAccrued: number;
  totalPayrollPaid: number;
  totalPayrollOutstanding: number;
  totalCostsAndExpenses: number;
  estimatedNetProfit: number;
  operatingCashFlow: number; // Cash Inflows - Cash Outflows
}

/**
 * Format INR or specified currency with appropriate symbol.
 */
export function formatCurrency(amount: number, currency: string = "INR"): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(rounded);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Calculates financial balance and status for a client invoice.
 */
export function computeInvoiceBalance(
  agreedPrice: number,
  additionalCharges: number,
  discountAmount: number,
  taxAmount: number,
  payments: { amount: number; is_reversed?: boolean }[],
) {
  const totalBilled = Math.max(0, agreedPrice + additionalCharges - discountAmount + taxAmount);
  const validPayments = payments.filter((p) => !p.is_reversed);
  const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  let status: "draft" | "issued" | "partially_paid" | "paid" = "issued";
  if (totalPaid === 0) {
    status = "issued";
  } else if (totalPaid >= totalBilled && totalBilled > 0) {
    status = "paid";
  } else {
    status = "partially_paid";
  }

  return {
    totalBilled,
    totalPaid,
    outstandingBalance,
    status,
    unappliedCredit: totalPaid > totalBilled ? totalPaid - totalBilled : 0,
  };
}

/**
 * Calculates payroll obligation balances and status.
 */
export function computePayrollBalance(
  baseAmount: number,
  allowanceAmount: number,
  deductionAmount: number,
  disbursements: { amount: number; is_reversed?: boolean }[],
) {
  const netPayable = Math.max(0, baseAmount + allowanceAmount - deductionAmount);
  const validDisbursements = disbursements.filter((d) => !d.is_reversed);
  const amountPaid = validDisbursements.reduce((sum, d) => sum + Number(d.amount), 0);
  const balanceDue = Math.max(0, netPayable - amountPaid);

  let status: "approved" | "partially_paid" | "paid" = "approved";
  if (amountPaid === 0) {
    status = "approved";
  } else if (amountPaid >= netPayable && netPayable > 0) {
    status = "paid";
  } else {
    status = "partially_paid";
  }

  return {
    netPayable,
    amountPaid,
    balanceDue,
    status,
  };
}

/**
 * Calculates shoot-level profitability with direct cost tracking and overhead allocation.
 */
export function calculateShootProfitability(
  shoot: { id: string; couple_name: string; event_type: string; event_date: string },
  invoices: ClientInvoiceRecord[],
  payments: ClientPaymentRecord[],
  payroll: PayrollObligationRecord[],
  expenses: OperatingExpenseRecord[],
  totalStudioOverhead: number = 0,
  totalActiveShootsCount: number = 1,
): ShootProfitabilitySummary {
  const shootInvoices = invoices.filter((i) => i.shoot_id === shoot.id && i.status !== "cancelled");
  const shootPayments = payments.filter((p) => p.shoot_id === shoot.id && !p.is_reversed);
  const shootPayroll = payroll.filter((p) => p.shoot_id === shoot.id && p.status !== "cancelled");
  const shootExpenses = expenses.filter(
    (e) => e.shoot_id === shoot.id && e.is_direct_cost && e.status !== "cancelled",
  );

  const agreedPrice = shootInvoices.reduce((sum, i) => sum + Number(i.agreed_price), 0);
  const recognizedRevenue = shootInvoices.reduce((sum, i) => sum + Number(i.total_billed), 0);
  const cashCollected = shootPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingClientBalance = Math.max(0, recognizedRevenue - cashCollected);

  const allocatedWorkerCost = shootPayroll.reduce((sum, p) => sum + Number(p.net_payable), 0);
  const allocatedDirectExpenses = shootExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalDirectCosts = allocatedWorkerCost + allocatedDirectExpenses;

  const contributionMargin = recognizedRevenue - totalDirectCosts;

  // Overhead allocated evenly or conservatively
  const safeCount = Math.max(1, totalActiveShootsCount);
  const allocatedOverhead =
    Math.round((totalStudioOverhead / safeCount + Number.EPSILON) * 100) / 100;
  const estimatedNetProfit = contributionMargin - allocatedOverhead;

  const profitMarginPct =
    recognizedRevenue > 0
      ? Math.round(((estimatedNetProfit / recognizedRevenue) * 100 + Number.EPSILON) * 10) / 10
      : 0;

  return {
    shootId: shoot.id,
    coupleName: shoot.couple_name,
    eventType: shoot.event_type,
    eventDate: shoot.event_date,
    currency: "INR",
    agreedPrice,
    recognizedRevenue,
    cashCollected,
    outstandingClientBalance,
    allocatedWorkerCost,
    allocatedDirectExpenses,
    totalDirectCosts,
    contributionMargin,
    allocatedOverhead,
    estimatedNetProfit,
    profitMarginPct,
    isFullyPaid: cashCollected >= recognizedRevenue && recognizedRevenue > 0,
  };
}

/**
 * Calculates studio-wide financial metrics for executive dashboard and reports.
 */
export function calculateStudioTotals(
  invoices: ClientInvoiceRecord[],
  clientPayments: ClientPaymentRecord[],
  payroll: PayrollObligationRecord[],
  workerPayments: WorkerPaymentRecord[],
  expenses: OperatingExpenseRecord[],
): StudioFinancialOverview {
  const validInvoices = invoices.filter((i) => i.status !== "cancelled");
  const validClientPayments = clientPayments.filter((p) => !p.is_reversed);
  const validPayroll = payroll.filter((p) => p.status !== "cancelled");
  const validWorkerPayments = workerPayments.filter((p) => !p.is_reversed);
  const validExpenses = expenses.filter((e) => e.status !== "cancelled");

  const totalRevenueBilled = validInvoices.reduce((sum, i) => sum + Number(i.total_billed), 0);
  const totalCashCollected = validClientPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalClientOutstanding = Math.max(0, totalRevenueBilled - totalCashCollected);

  const totalDirectExpenses = validExpenses
    .filter((e) => e.is_direct_cost)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalOverheadExpenses = validExpenses
    .filter((e) => !e.is_direct_cost)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalOperatingExpenses = totalDirectExpenses + totalOverheadExpenses;

  const totalPayrollAccrued = validPayroll.reduce((sum, p) => sum + Number(p.net_payable), 0);
  const totalPayrollPaid = validWorkerPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPayrollOutstanding = Math.max(0, totalPayrollAccrued - totalPayrollPaid);

  const totalCostsAndExpenses = totalPayrollAccrued + totalOperatingExpenses;
  const estimatedNetProfit = totalRevenueBilled - totalCostsAndExpenses;

  // Cash flow = Cash in from clients - (Worker payments cash out + expense payments cash out)
  const cashPaidExpenses = validExpenses.reduce((sum, e) => sum + Number(e.amount_paid), 0);
  const operatingCashFlow = totalCashCollected - (totalPayrollPaid + cashPaidExpenses);

  return {
    totalRevenueBilled,
    totalCashCollected,
    totalClientOutstanding,
    totalOperatingExpenses,
    totalDirectExpenses,
    totalOverheadExpenses,
    totalPayrollAccrued,
    totalPayrollPaid,
    totalPayrollOutstanding,
    totalCostsAndExpenses,
    estimatedNetProfit,
    operatingCashFlow,
  };
}

export const demoInvoices: ClientInvoiceRecord[] = [
  {
    id: "demo-inv-1",
    invoice_number: "INV-2026-001",
    shoot_id: "demo-shoot-1",
    client_name: "Maya & Arjun",
    currency: "INR",
    agreed_price: 350000,
    additional_charges: 25000,
    discount_amount: 15000,
    tax_amount: 0,
    total_billed: 360000,
    total_paid: 200000,
    outstanding_balance: 160000,
    status: "partially_paid",
    issue_date: "2026-10-01",
    due_date: "2026-10-20",
    notes: "50% advance received, balance due before wedding day.",
  },
  {
    id: "demo-inv-2",
    invoice_number: "INV-2026-002",
    shoot_id: "demo-shoot-2",
    client_name: "Isha & Kabir",
    currency: "INR",
    agreed_price: 180000,
    additional_charges: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_billed: 180000,
    total_paid: 180000,
    outstanding_balance: 0,
    status: "paid",
    issue_date: "2026-10-03",
    due_date: "2026-10-24",
    notes: "Full payment completed via NEFT.",
  },
  {
    id: "demo-inv-3",
    invoice_number: "INV-2026-003",
    shoot_id: "demo-shoot-3",
    client_name: "Ananya & Rohan",
    currency: "INR",
    agreed_price: 420000,
    additional_charges: 30000,
    discount_amount: 20000,
    tax_amount: 0,
    total_billed: 430000,
    total_paid: 150000,
    outstanding_balance: 280000,
    status: "partially_paid",
    issue_date: "2026-10-05",
    due_date: "2026-11-05",
    notes: "Grand Reception coverage booked. Token advance received.",
  },
  {
    id: "demo-inv-4",
    invoice_number: "INV-2026-004",
    shoot_id: "demo-shoot-4",
    client_name: "Diya & Veer",
    currency: "INR",
    agreed_price: 120000,
    additional_charges: 10000,
    discount_amount: 5000,
    tax_amount: 0,
    total_billed: 125000,
    total_paid: 125000,
    outstanding_balance: 0,
    status: "paid",
    issue_date: "2026-09-20",
    due_date: "2026-10-15",
    notes: "Completed shoot. Final settlement received.",
  },
];

export const demoClientPayments: ClientPaymentRecord[] = [
  {
    id: "demo-cp-1",
    receipt_number: "REC-2026-101",
    invoice_id: "demo-inv-1",
    shoot_id: "demo-shoot-1",
    amount: 200000,
    currency: "INR",
    payment_method: "bank_transfer",
    transaction_reference: "NEFT-7894231",
    payment_date: "2026-10-02",
    is_reversed: false,
    notes: "Initial advance for Maya & Arjun wedding.",
  },
  {
    id: "demo-cp-2",
    receipt_number: "REC-2026-102",
    invoice_id: "demo-inv-2",
    shoot_id: "demo-shoot-2",
    amount: 180000,
    currency: "INR",
    payment_method: "upi",
    transaction_reference: "UPI/3489201948",
    payment_date: "2026-10-04",
    is_reversed: false,
    notes: "Full payment for Isha & Kabir engagement.",
  },
  {
    id: "demo-cp-3",
    receipt_number: "REC-2026-103",
    invoice_id: "demo-inv-3",
    shoot_id: "demo-shoot-3",
    amount: 150000,
    currency: "INR",
    payment_method: "cheque",
    transaction_reference: "CHQ-002914",
    payment_date: "2026-10-06",
    is_reversed: false,
    notes: "Booking advance for Ananya & Rohan reception.",
  },
  {
    id: "demo-cp-4",
    receipt_number: "REC-2026-104",
    invoice_id: "demo-inv-4",
    shoot_id: "demo-shoot-4",
    amount: 125000,
    currency: "INR",
    payment_method: "bank_transfer",
    transaction_reference: "IMPS-9923812",
    payment_date: "2026-10-10",
    is_reversed: false,
    notes: "Settlement for Diya & Veer pre-wedding.",
  },
];

export const demoPayroll: PayrollObligationRecord[] = [
  {
    id: "demo-pr-1",
    worker_id: "demo-member-1",
    shoot_id: "demo-shoot-1",
    period_label: "Shoot: Maya & Arjun",
    compensation_type: "per_shoot",
    base_amount: 35000,
    allowance_amount: 3000,
    deduction_amount: 0,
    net_payable: 38000,
    amount_paid: 20000,
    balance_due: 18000,
    status: "partially_paid",
    approved_at: "2026-10-05T10:00:00.000Z",
    created_at: "2026-10-02T09:00:00.000Z",
    notes: "Lead Photographer assignment. Partial advance disbursed.",
  },
  {
    id: "demo-pr-2",
    worker_id: "demo-member-2",
    shoot_id: "demo-shoot-1",
    period_label: "Shoot: Maya & Arjun",
    compensation_type: "per_shoot",
    base_amount: 30000,
    allowance_amount: 2500,
    deduction_amount: 0,
    net_payable: 32500,
    amount_paid: 32500,
    balance_due: 0,
    status: "paid",
    approved_at: "2026-10-05T10:00:00.000Z",
    created_at: "2026-10-02T09:00:00.000Z",
    notes: "Cinematographer on-site assignment.",
  },
  {
    id: "demo-pr-3",
    worker_id: "demo-member-3",
    shoot_id: null,
    period_label: "October 2026 Salary",
    compensation_type: "monthly_salary",
    base_amount: 60000,
    allowance_amount: 5000,
    deduction_amount: 2000,
    net_payable: 63000,
    amount_paid: 30000,
    balance_due: 33000,
    status: "partially_paid",
    approved_at: "2026-10-01T10:00:00.000Z",
    created_at: "2026-10-01T09:00:00.000Z",
    notes: "Full-time Post Production & Photo Editor monthly retainer.",
  },
  {
    id: "demo-pr-4",
    worker_id: "demo-member-4",
    shoot_id: "demo-shoot-3",
    period_label: "Shoot: Ananya & Rohan",
    compensation_type: "per_shoot",
    base_amount: 45000,
    allowance_amount: 5000,
    deduction_amount: 0,
    net_payable: 50000,
    amount_paid: 0,
    balance_due: 50000,
    status: "approved",
    approved_at: "2026-10-08T11:00:00.000Z",
    created_at: "2026-10-06T09:00:00.000Z",
    notes: "Creative Director fee for Mumbai Reception.",
  },
  {
    id: "demo-pr-5",
    worker_id: "demo-member-5",
    shoot_id: null,
    period_label: "October 2026 Salary",
    compensation_type: "monthly_salary",
    base_amount: 45000,
    allowance_amount: 0,
    deduction_amount: 0,
    net_payable: 45000,
    amount_paid: 45000,
    balance_due: 0,
    status: "paid",
    approved_at: "2026-10-01T10:00:00.000Z",
    created_at: "2026-10-01T09:00:00.000Z",
    notes: "Full-time Album Designer retainer.",
  },
];

export const demoWorkerPayments: WorkerPaymentRecord[] = [
  {
    id: "demo-wp-1",
    payment_voucher_no: "VOUCH-2026-001",
    obligation_id: "demo-pr-1",
    worker_id: "demo-member-1",
    amount: 20000,
    currency: "INR",
    payment_method: "bank_transfer",
    transaction_reference: "NEFT-883201",
    disbursement_date: "2026-10-08",
    is_reversed: false,
    notes: "Advance disbursement for Jaipur shoot travel & prep.",
  },
  {
    id: "demo-wp-2",
    payment_voucher_no: "VOUCH-2026-002",
    obligation_id: "demo-pr-2",
    worker_id: "demo-member-2",
    amount: 32500,
    currency: "INR",
    payment_method: "upi",
    transaction_reference: "UPI-449102",
    disbursement_date: "2026-10-08",
    is_reversed: false,
    notes: "Full shoot payout.",
  },
  {
    id: "demo-wp-3",
    payment_voucher_no: "VOUCH-2026-003",
    obligation_id: "demo-pr-3",
    worker_id: "demo-member-3",
    amount: 30000,
    currency: "INR",
    payment_method: "bank_transfer",
    transaction_reference: "NEFT-399210",
    disbursement_date: "2026-10-10",
    is_reversed: false,
    notes: "Mid-month salary advance.",
  },
  {
    id: "demo-wp-4",
    payment_voucher_no: "VOUCH-2026-004",
    obligation_id: "demo-pr-5",
    worker_id: "demo-member-5",
    amount: 45000,
    currency: "INR",
    payment_method: "bank_transfer",
    transaction_reference: "NEFT-399211",
    disbursement_date: "2026-10-05",
    is_reversed: false,
    notes: "October monthly payout.",
  },
];

export const demoExpenses: OperatingExpenseRecord[] = [
  {
    id: "demo-exp-1",
    expense_number: "EXP-2026-001",
    category: "Camera & Lighting Rentals",
    payee_supplier: "Sony Cine Hire Delhi",
    description: "Sony FX3 + GM Prime Lens set rental for Samode Palace",
    amount: 42000,
    currency: "INR",
    expense_date: "2026-10-12",
    is_direct_cost: true,
    shoot_id: "demo-shoot-1",
    payment_method: "bank_transfer",
    payment_status: "paid",
    amount_paid: 42000,
    status: "approved",
    notes: "3-day rental with insurance included.",
  },
  {
    id: "demo-exp-2",
    expense_number: "EXP-2026-002",
    category: "Travel, Fuel & Stay",
    payee_supplier: "MakeMyTrip / Indigo",
    description: "Flight tickets & local cab for Udaipur shoot crew",
    amount: 28500,
    currency: "INR",
    expense_date: "2026-10-14",
    is_direct_cost: true,
    shoot_id: "demo-shoot-2",
    payment_method: "credit_card",
    payment_status: "paid",
    amount_paid: 28500,
    status: "approved",
    notes: "3 tickets Delhi-Udaipur return.",
  },
  {
    id: "demo-exp-3",
    expense_number: "EXP-2026-003",
    category: "Studio Rent & Utilities",
    payee_supplier: "Green Park Commercial Estates",
    description: "Main bridal lounge and editing studio monthly lease",
    amount: 75000,
    currency: "INR",
    expense_date: "2026-10-01",
    is_direct_cost: false,
    shoot_id: null,
    payment_method: "bank_transfer",
    payment_status: "paid",
    amount_paid: 75000,
    status: "recorded",
    notes: "Overhead expense for October.",
  },
  {
    id: "demo-exp-4",
    expense_number: "EXP-2026-004",
    category: "Software Subscriptions",
    payee_supplier: "Adobe & Frame.io",
    description: "Creative Cloud Team Licenses + Cloud Review Storage",
    amount: 14500,
    currency: "INR",
    expense_date: "2026-10-05",
    is_direct_cost: false,
    shoot_id: null,
    payment_method: "credit_card",
    payment_status: "paid",
    amount_paid: 14500,
    status: "recorded",
    notes: "General studio operating software overhead.",
  },
  {
    id: "demo-exp-5",
    expense_number: "EXP-2026-005",
    category: "Album Printing & Production",
    payee_supplier: "Canvera Digital Presses",
    description: "Handcrafted Italian Leather Wedding Album for Diya & Veer",
    amount: 22000,
    currency: "INR",
    expense_date: "2026-10-11",
    is_direct_cost: true,
    shoot_id: "demo-shoot-4",
    payment_method: "upi",
    payment_status: "paid",
    amount_paid: 22000,
    status: "approved",
    notes: "40-page flush mount album with custom wooden presentation box.",
  },
];
