-- TA BRIDALS — ADVANCED STUDIO ERP, FINANCE, PAYROLL & PROFITABILITY MIGRATION
-- Supports:
-- 1. Client Billing & Invoices (shoot revenue, agreed price, extra charges, discounts, taxes)
-- 2. Client Payment Transactions (advances, instalments, balance calculations, receipts)
-- 3. Worker Compensation Plans & Payroll Obligations (salary, per-shoot, per-day, per-assignment, bonuses, deductions)
-- 4. Worker Payment Transactions (partial/full disbursements, payment methods, receipts)
-- 5. Operating Expenses & Categories (supplier tracking, payment status, shoot attribution, overhead allocation)
-- 6. Financial Adjustments & Reversals (non-destructive accounting corrections)
-- 7. Comprehensive RLS for Admin vs. Worker isolation

-- 1. EXPENSE CATEGORIES & SUPPLIERS
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_direct_cost boolean NOT NULL DEFAULT true, -- true = shoot direct cost, false = general studio overhead
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed standard photography/bridal studio expense categories
INSERT INTO public.expense_categories (name, description, is_direct_cost)
VALUES
  ('Worker Compensation', 'Crew and freelancer wages, shoot allowances', true),
  ('Travel & Accommodation', 'Flights, fuel, taxi, hotel for destination weddings', true),
  ('Camera & Lighting Rentals', 'Rented bodies, cine lenses, gimbals, lighting rigs', true),
  ('Equipment Purchases & Maintenance', 'Camera sensors, storage SSDs, maintenance and repairs', false),
  ('Editing & Post-Production', 'Third-party grading, retouching, CGI, audio mastering', true),
  ('Album Printing & Production', 'Flush mount albums, canvas prints, presentation boxes', true),
  ('Studio Rent & Utilities', 'Studio premises rent, power, high-speed fibre', false),
  ('Software Subscriptions', 'Adobe Creative Cloud, CRM, cloud backup, music licenses', false),
  ('Marketing & Advertising', 'Social ads, bridal expos, website hosting, samples', false),
  ('Meals & Event Logistics', 'On-site crew catering, refreshments, permits', true),
  ('Miscellaneous Expenses', 'Courier, client gifts, sundry studio sundries', false)
ON CONFLICT (name) DO NOTHING;

-- 2. CLIENT INVOICES / BILLING STATEMENTS
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  shoot_id uuid NOT NULL REFERENCES public.shoots(id) ON DELETE RESTRICT,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  currency text NOT NULL DEFAULT 'INR',
  agreed_price numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (agreed_price >= 0),
  additional_charges numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (additional_charges >= 0),
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total_billed numeric(12, 2) GENERATED ALWAYS AS (agreed_price + additional_charges - discount_amount + tax_amount) STORED,
  total_paid numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_paid >= 0),
  outstanding_balance numeric(12, 2) GENERATED ALWAYS AS (agreed_price + additional_charges - discount_amount + tax_amount - total_paid) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_invoices_shoot ON public.client_invoices(shoot_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_status ON public.client_invoices(status);
CREATE INDEX IF NOT EXISTS idx_client_invoices_due ON public.client_invoices(due_date);

-- 3. CLIENT PAYMENT TRANSACTIONS (MANUAL CASH/BANK LEDGER)
CREATE TABLE IF NOT EXISTS public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES public.client_invoices(id) ON DELETE RESTRICT,
  shoot_id uuid NOT NULL REFERENCES public.shoots(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  payment_method text NOT NULL CHECK (payment_method IN ('bank_transfer', 'upi', 'cash', 'cheque', 'credit_card', 'other')),
  transaction_reference text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_reversed boolean NOT NULL DEFAULT false,
  reversal_reason text,
  reversed_at timestamptz,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_invoice ON public.client_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_shoot ON public.client_payments(shoot_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON public.client_payments(payment_date);

-- 4. WORKER COMPENSATION ARRANGEMENTS & PAYROLL OBLIGATIONS
CREATE TABLE IF NOT EXISTS public.worker_compensation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE UNIQUE,
  compensation_type text NOT NULL CHECK (compensation_type IN ('monthly_salary', 'per_shoot', 'per_day', 'per_assignment')),
  base_rate numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (base_rate >= 0),
  currency text NOT NULL DEFAULT 'INR',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  bank_account_info text, -- Masked or internal routing notes
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  shoot_id uuid REFERENCES public.shoots(id) ON DELETE SET NULL, -- nullable if monthly salary
  period_label text NOT NULL, -- e.g. "October 2026" or "Maya & Arjun Wedding"
  compensation_type text NOT NULL CHECK (compensation_type IN ('monthly_salary', 'per_shoot', 'per_day', 'per_assignment', 'bonus', 'adjustment')),
  base_amount numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (base_amount >= 0),
  allowance_amount numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (allowance_amount >= 0),
  deduction_amount numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (deduction_amount >= 0),
  net_payable numeric(12, 2) GENERATED ALWAYS AS (base_amount + allowance_amount - deduction_amount) STORED,
  amount_paid numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  balance_due numeric(12, 2) GENERATED ALWAYS AS (base_amount + allowance_amount - deduction_amount - amount_paid) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'partially_paid', 'paid', 'disputed', 'cancelled')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate monthly salary for the same worker and period
  CONSTRAINT unique_worker_salary_period UNIQUE NULLS NOT DISTINCT (worker_id, period_label, compensation_type)
);

CREATE INDEX IF NOT EXISTS idx_payroll_obligations_worker ON public.payroll_obligations(worker_id);
CREATE INDEX IF NOT EXISTS idx_payroll_obligations_shoot ON public.payroll_obligations(shoot_id);
CREATE INDEX IF NOT EXISTS idx_payroll_obligations_status ON public.payroll_obligations(status);

-- 5. WORKER DISBURSEMENT / PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.worker_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_voucher_no text NOT NULL UNIQUE,
  obligation_id uuid NOT NULL REFERENCES public.payroll_obligations(id) ON DELETE RESTRICT,
  worker_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  payment_method text NOT NULL CHECK (payment_method IN ('bank_transfer', 'upi', 'cash', 'cheque', 'other')),
  transaction_reference text,
  disbursement_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_reversed boolean NOT NULL DEFAULT false,
  reversal_reason text,
  reversed_at timestamptz,
  disbursed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_payments_obligation ON public.worker_payments(obligation_id);
CREATE INDEX IF NOT EXISTS idx_worker_payments_worker ON public.worker_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_payments_date ON public.worker_payments(disbursement_date);

-- 6. OPERATING EXPENSES (SHOOT DIRECT & OVERHEAD)
CREATE TABLE IF NOT EXISTS public.operating_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL UNIQUE,
  category text NOT NULL,
  payee_supplier text NOT NULL,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  is_direct_cost boolean NOT NULL DEFAULT true,
  shoot_id uuid REFERENCES public.shoots(id) ON DELETE SET NULL, -- Attributable shoot if direct
  payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'upi', 'cash', 'credit_card', 'cheque', 'unpaid')),
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partially_paid', 'unpaid')),
  amount_paid numeric(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('submitted', 'approved', 'rejected', 'recorded', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_shoot ON public.operating_expenses(shoot_id);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_category ON public.operating_expenses(category);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_date ON public.operating_expenses(expense_date);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_compensation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

-- Permissions: Expense Categories
DROP POLICY IF EXISTS "Admins manage expense categories" ON public.expense_categories;
CREATE POLICY "Admins manage expense categories"
  ON public.expense_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Approved users can read expense categories" ON public.expense_categories;
CREATE POLICY "Approved users can read expense categories"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (public.is_approved_user(auth.uid()));

-- Permissions: Invoices & Client Payments (Admin strictly)
DROP POLICY IF EXISTS "Admins manage client invoices" ON public.client_invoices;
CREATE POLICY "Admins manage client invoices"
  ON public.client_invoices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage client payments" ON public.client_payments;
CREATE POLICY "Admins manage client payments"
  ON public.client_payments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Permissions: Operating Expenses (Admin strictly)
DROP POLICY IF EXISTS "Admins manage operating expenses" ON public.operating_expenses;
CREATE POLICY "Admins manage operating expenses"
  ON public.operating_expenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Permissions: Worker Compensation & Payroll
DROP POLICY IF EXISTS "Admins manage worker compensation plans" ON public.worker_compensation_plans;
CREATE POLICY "Admins manage worker compensation plans"
  ON public.worker_compensation_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Workers can read their own compensation plan" ON public.worker_compensation_plans;
CREATE POLICY "Workers can read their own compensation plan"
  ON public.worker_compensation_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = worker_id AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage payroll obligations" ON public.payroll_obligations;
CREATE POLICY "Admins manage payroll obligations"
  ON public.payroll_obligations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Workers can read their own approved payroll obligations" ON public.payroll_obligations;
CREATE POLICY "Workers can read their own approved payroll obligations"
  ON public.payroll_obligations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = worker_id AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage worker payments" ON public.worker_payments;
CREATE POLICY "Admins manage worker payments"
  ON public.worker_payments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Workers can read their own disbursement history" ON public.worker_payments;
CREATE POLICY "Workers can read their own disbursement history"
  ON public.worker_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = worker_id AND tm.user_id = auth.uid()
    )
  );
