-- TA BRIDALS — SECURE READ-ONLY RPC INTERFACE FOR N8N GEMINI AI AGENT
--
-- Security specifications:
-- 1. All functions are STRICTLY SECURITY DEFINER with fixed search_path = public.
-- 2. Authorization check: The caller MUST have 'admin' role or be an authorized service caller.
-- 3. Read-only queries only: No arbitrary SQL execution, no writes, no destructive operations.
-- 4. No service-role key is ever exposed to the client or AI agent chat.
--

-- Function 1: Query upcoming shoots and understaffed alerts for AI agent
CREATE OR REPLACE FUNCTION public.n8n_get_upcoming_shoots_summary(p_days_ahead integer DEFAULT 30)
RETURNS TABLE (
  shoot_id uuid,
  couple_name text,
  event_type text,
  event_date date,
  location text,
  venue text,
  start_time time,
  end_time time,
  planned_team_size integer,
  assigned_onsite_crew bigint,
  is_understaffed boolean,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS shoot_id,
    s.couple_name,
    s.event_type,
    s.event_date,
    s.location,
    s.venue,
    s.start_time,
    s.end_time,
    s.planned_team_size,
    COUNT(sa.id) FILTER (WHERE sa.assignment_type = 'on_site') AS assigned_onsite_crew,
    (COUNT(sa.id) FILTER (WHERE sa.assignment_type = 'on_site') < s.planned_team_size) AS is_understaffed,
    s.status
  FROM public.shoots s
  LEFT JOIN public.shoot_assignments sa ON sa.shoot_id = s.id
  WHERE s.event_date >= CURRENT_DATE 
    AND s.event_date <= CURRENT_DATE + p_days_ahead
    AND s.status != 'Cancelled'
  GROUP BY s.id, s.couple_name, s.event_type, s.event_date, s.location, s.venue, s.start_time, s.end_time, s.planned_team_size, s.status
  ORDER BY s.event_date ASC;
END;
$$;

-- Function 2: Query team availability and pending leave for AI agent
CREATE OR REPLACE FUNCTION public.n8n_get_team_availability_summary(p_target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  worker_id uuid,
  full_name text,
  primary_role text,
  status text,
  is_on_leave boolean,
  leave_reason text,
  assigned_shoot_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tm.id AS worker_id,
    tm.full_name,
    tm.role AS primary_role,
    tm.status,
    EXISTS (
      SELECT 1 FROM public.availability_requests ar
      WHERE ar.worker_id = tm.id
        AND ar.status = 'approved'
        AND ar.request_type = 'leave'
        AND p_target_date BETWEEN ar.start_date AND ar.end_date
    ) AS is_on_leave,
    (
      SELECT ar.reason FROM public.availability_requests ar
      WHERE ar.worker_id = tm.id
        AND ar.status = 'approved'
        AND ar.request_type = 'leave'
        AND p_target_date BETWEEN ar.start_date AND ar.end_date
      LIMIT 1
    ) AS leave_reason,
    (
      SELECT COUNT(sa.id) FROM public.shoot_assignments sa
      JOIN public.shoots s ON s.id = sa.shoot_id
      WHERE sa.team_member_id = tm.id AND s.event_date = p_target_date AND s.status != 'Cancelled'
    ) AS assigned_shoot_count
  FROM public.team_members tm
  WHERE tm.status = 'active'
  ORDER BY tm.full_name ASC;
END;
$$;

-- Function 3: Query studio operational workload & financial metrics for AI agent
CREATE OR REPLACE FUNCTION public.n8n_get_studio_operational_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_active_workers', (SELECT COUNT(*) FROM public.team_members WHERE status = 'active'),
    'upcoming_shoots_next_30_days', (SELECT COUNT(*) FROM public.shoots WHERE event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + 30 AND status != 'Cancelled'),
    'understaffed_shoots', (
      SELECT COUNT(*) FROM (
        SELECT s.id, s.planned_team_size, COUNT(sa.id) FILTER (WHERE sa.assignment_type = 'on_site') as crew
        FROM public.shoots s
        LEFT JOIN public.shoot_assignments sa ON sa.shoot_id = s.id
        WHERE s.event_date >= CURRENT_DATE AND s.status != 'Cancelled'
        GROUP BY s.id, s.planned_team_size
        HAVING COUNT(sa.id) FILTER (WHERE sa.assignment_type = 'on_site') < s.planned_team_size
      ) u
    ),
    'pending_registrations', (SELECT COUNT(*) FROM public.profiles WHERE approval_status = 'pending'),
    'pending_leave_requests', (SELECT COUNT(*) FROM public.availability_requests WHERE status = 'pending')
  ) INTO v_metrics;

  RETURN v_metrics;
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_get_upcoming_shoots_summary(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_get_team_availability_summary(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_get_studio_operational_metrics() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_get_upcoming_shoots_summary(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.n8n_get_team_availability_summary(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.n8n_get_studio_operational_metrics() TO authenticated, service_role;
