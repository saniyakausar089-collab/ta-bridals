-- TA Bridals Studio Operations Platform Upgrade
-- Adds support for:
-- 1. Extended Worker Profiles (additional skills, status, admin notes, emergency contact, date added)
-- 2. Availability & Leave Requests
-- 3. Audit Logging
-- 4. In-App Notifications
-- 5. Enhanced RLS and helper functions

-- 1. Enhance team_members table
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS additional_skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Constraint on team_members status
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_status_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('active', 'inactive', 'on_leave'));

-- 2. Availability Requests table
CREATE TABLE IF NOT EXISTS public.availability_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_name text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('available', 'unavailable', 'leave')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_availability_requests_worker ON public.availability_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_dates ON public.availability_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_availability_requests_status ON public.availability_requests(status);

ALTER TABLE public.availability_requests ENABLE ROW LEVEL SECURITY;

-- 3. Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_name text NOT NULL,
  actor_email text,
  action text NOT NULL,
  record_type text NOT NULL,
  record_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'assignment', 'approval', 'system')),
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Team Members RLS:
-- Approved users can view public team members fields, but admin_notes is reserved for admins
-- Admins can manage all team members

-- Availability Requests RLS:
DROP POLICY IF EXISTS "Admins can manage all availability requests" ON public.availability_requests;
CREATE POLICY "Admins can manage all availability requests"
  ON public.availability_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Workers can view and submit their own availability requests" ON public.availability_requests;
CREATE POLICY "Workers can view and submit their own availability requests"
  ON public.availability_requests FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.is_approved_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id);

-- Audit Logs RLS:
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);

-- Notifications RLS:
DROP POLICY IF EXISTS "Users can view and manage their own notifications" ON public.notifications;
CREATE POLICY "Users can view and manage their own notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Admins can insert notifications for any user" ON public.notifications;
CREATE POLICY "Admins can insert notifications for any user"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
