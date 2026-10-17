import { describe, expect, it } from "vitest";
import {
  computeInvoiceBalance,
  computePayrollBalance,
  calculateShootProfitability,
  calculateStudioTotals,
  formatCurrency,
  type ClientInvoiceRecord,
  type ClientPaymentRecord,
  type PayrollObligationRecord,
  type WorkerPaymentRecord,
  type OperatingExpenseRecord,
} from "./finance";

describe("TA Bridals Financial ERP & Profitability Engine", () => {
  it("formats INR currency correctly without decimals when round", () => {
    expect(formatCurrency(150000)).toMatch(/₹\s*1,50,000/);
    expect(formatCurrency(0)).toMatch(/₹\s*0/);
  });

  it("calculates client invoice balance with partial payments, extra charges and discounts", () => {
    const agreedPrice = 120000;
    const additionalCharges = 15000;
    const discountAmount = 5000;
    const taxAmount = 0;

    // Total billed should be 120000 + 15000 - 5000 = 130000
    const payments = [
      { amount: 50000, is_reversed: false },
      { amount: 30000, is_reversed: false },
      { amount: 20000, is_reversed: true }, // Reversed payment should not be counted
    ];

    const result = computeInvoiceBalance(agreedPrice, additionalCharges, discountAmount, taxAmount, payments);

    expect(result.totalBilled).toBe(130000);
    expect(result.totalPaid).toBe(80000);
    expect(result.outstandingBalance).toBe(50000);
    expect(result.status).toBe("partially_paid");
    expect(result.unappliedCredit).toBe(0);
  });

  it("detects fully paid client invoices and prevents unapplied credit inaccuracies", () => {
    const payments = [{ amount: 100000, is_reversed: false }];
    const result = computeInvoiceBalance(100000, 0, 0, 0, payments);

    expect(result.totalPaid).toBe(100000);
    expect(result.outstandingBalance).toBe(0);
    expect(result.status).toBe("paid");
    expect(result.unappliedCredit).toBe(0);
  });

  it("calculates worker payroll obligation with allowances and deductions", () => {
    const base = 25000;
    const allowance = 3000; // e.g. travel allowance
    const deduction = 1000; // e.g. advance deduction

    // Net payable = 25000 + 3000 - 1000 = 27000
    const disbursements = [
      { amount: 15000, is_reversed: false },
      { amount: 5000, is_reversed: true }, // Reversed disbursement
    ];

    const payroll = computePayrollBalance(base, allowance, deduction, disbursements);

    expect(payroll.netPayable).toBe(27000);
    expect(payroll.amountPaid).toBe(15000);
    expect(payroll.balanceDue).toBe(12000);
    expect(payroll.status).toBe("partially_paid");
  });

  it("calculates shoot profitability, contribution margin and net profit with overhead allocation", () => {
    const shoot = {
      id: "shoot-test-1",
      couple_name: "Maya & Arjun",
      event_type: "Wedding",
      event_date: "2026-10-22",
    };

    const invoices: ClientInvoiceRecord[] = [
      {
        id: "inv-1",
        invoice_number: "INV-2026-001",
        shoot_id: "shoot-test-1",
        client_name: "Maya & Arjun",
        currency: "INR",
        agreed_price: 200000,
        additional_charges: 0,
        discount_amount: 0,
        tax_amount: 0,
        total_billed: 200000,
        total_paid: 150000,
        outstanding_balance: 50000,
        status: "partially_paid",
        issue_date: "2026-10-01",
        due_date: "2026-10-22",
      },
    ];

    const payments: ClientPaymentRecord[] = [
      {
        id: "pay-1",
        receipt_number: "REC-001",
        invoice_id: "inv-1",
        shoot_id: "shoot-test-1",
        amount: 150000,
        currency: "INR",
        payment_method: "upi",
        payment_date: "2026-10-05",
        is_reversed: false,
      },
    ];

    const payroll: PayrollObligationRecord[] = [
      {
        id: "obl-1",
        worker_id: "w-1",
        shoot_id: "shoot-test-1",
        period_label: "Maya Wedding Shoot",
        compensation_type: "per_shoot",
        base_amount: 30000,
        allowance_amount: 5000,
        deduction_amount: 0,
        net_payable: 35000,
        amount_paid: 35000,
        balance_due: 0,
        status: "paid",
      },
    ];

    const expenses: OperatingExpenseRecord[] = [
      {
        id: "exp-1",
        expense_number: "EXP-001",
        category: "Camera & Lighting Rentals",
        payee_supplier: "Rental Hub",
        description: "Sony FX3 Cine Kit",
        amount: 25000,
        currency: "INR",
        expense_date: "2026-10-21",
        is_direct_cost: true,
        shoot_id: "shoot-test-1",
        payment_method: "bank_transfer",
        payment_status: "paid",
        amount_paid: 25000,
        status: "recorded",
      },
    ];

    // Total overhead = 40000 distributed over 2 active shoots = 20000 per shoot
    const prof = calculateShootProfitability(shoot, invoices, payments, payroll, expenses, 40000, 2);

    expect(prof.recognizedRevenue).toBe(200000);
    expect(prof.cashCollected).toBe(150000);
    expect(prof.outstandingClientBalance).toBe(50000);
    expect(prof.allocatedWorkerCost).toBe(35000);
    expect(prof.allocatedDirectExpenses).toBe(25000);
    expect(prof.totalDirectCosts).toBe(60000);
    expect(prof.contributionMargin).toBe(140000); // 200000 - 60000
    expect(prof.allocatedOverhead).toBe(20000);
    expect(prof.estimatedNetProfit).toBe(120000); // 140000 - 20000
    expect(prof.profitMarginPct).toBe(60); // 120000 / 200000 = 60%
  });

  it("handles zero-revenue shoots gracefully without division by zero errors", () => {
    const shoot = {
      id: "shoot-zero",
      couple_name: "Test Couple",
      event_type: "Other",
      event_date: "2026-10-20",
    };

    const prof = calculateShootProfitability(shoot, [], [], [], [], 10000, 1);

    expect(prof.recognizedRevenue).toBe(0);
    expect(prof.estimatedNetProfit).toBe(-10000);
    expect(prof.profitMarginPct).toBe(0);
    expect(prof.isFullyPaid).toBe(false);
  });

  it("computes studio-wide executive overview correctly", () => {
    const invoices: ClientInvoiceRecord[] = [
      {
        id: "i-1",
        invoice_number: "INV-1",
        shoot_id: "s-1",
        client_name: "Client 1",
        currency: "INR",
        agreed_price: 100000,
        additional_charges: 0,
        discount_amount: 0,
        tax_amount: 0,
        total_billed: 100000,
        total_paid: 60000,
        outstanding_balance: 40000,
        status: "partially_paid",
        issue_date: "2026-10-01",
        due_date: "2026-10-20",
      },
    ];

    const clientPayments: ClientPaymentRecord[] = [
      {
        id: "p-1",
        receipt_number: "R-1",
        invoice_id: "i-1",
        shoot_id: "s-1",
        amount: 60000,
        currency: "INR",
        payment_method: "bank_transfer",
        payment_date: "2026-10-05",
        is_reversed: false,
      },
    ];

    const payroll: PayrollObligationRecord[] = [
      {
        id: "o-1",
        worker_id: "w-1",
        period_label: "Oct 2026",
        compensation_type: "monthly_salary",
        base_amount: 40000,
        allowance_amount: 0,
        deduction_amount: 0,
        net_payable: 40000,
        amount_paid: 20000,
        balance_due: 20000,
        status: "partially_paid",
      },
    ];

    const workerPayments: WorkerPaymentRecord[] = [
      {
        id: "wp-1",
        payment_voucher_no: "V-1",
        obligation_id: "o-1",
        worker_id: "w-1",
        amount: 20000,
        currency: "INR",
        payment_method: "bank_transfer",
        disbursement_date: "2026-10-10",
        is_reversed: false,
      },
    ];

    const expenses: OperatingExpenseRecord[] = [
      {
        id: "e-1",
        expense_number: "E-1",
        category: "Studio Rent",
        payee_supplier: "Landlord",
        description: "Studio Premises",
        amount: 15000,
        currency: "INR",
        expense_date: "2026-10-01",
        is_direct_cost: false,
        payment_method: "bank_transfer",
        payment_status: "paid",
        amount_paid: 15000,
        status: "recorded",
      },
    ];

    const totals = calculateStudioTotals(invoices, clientPayments, payroll, workerPayments, expenses);

    expect(totals.totalRevenueBilled).toBe(100000);
    expect(totals.totalCashCollected).toBe(60000);
    expect(totals.totalClientOutstanding).toBe(40000);
    expect(totals.totalOperatingExpenses).toBe(15000);
    expect(totals.totalPayrollAccrued).toBe(40000);
    expect(totals.totalPayrollPaid).toBe(20000);
    expect(totals.totalPayrollOutstanding).toBe(20000);
    // Estimated Net Profit = Revenue (100000) - Costs (40000 payroll + 15000 expenses) = 45000
    expect(totals.estimatedNetProfit).toBe(45000);
    // Cash Flow = Cash In (60000) - Cash Out (20000 worker + 15000 expense) = 25000
    expect(totals.operatingCashFlow).toBe(25000);
  });
});
