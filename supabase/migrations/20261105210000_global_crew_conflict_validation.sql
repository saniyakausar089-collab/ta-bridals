-- =====================================================================
-- TA BRIDALS: GLOBAL CREW SCHEDULING & DOUBLE-BOOKING PREVENTION
-- Enforces server-side time-interval overlap validation across all shoots.
-- Same-day non-overlapping assignments allowed.
-- Overlapping assignments strictly blocked with informative exception.
-- Prevents race conditions with row locking.
-- =====================================================================

-- 1. Helper function to check if two shoots overlap in time
CREATE OR REPLACE FUNCTION public.check_shoot_time_overlap(
  p_date_a date,
  p_start_a time,
  p_end_a time,
  p_date_b date,
  p_end_b time,
  p_start_b time
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_effective_end_a time;
  v_effective_end_b time;
  v_crosses_a boolean;
  v_crosses_b boolean;
BEGIN
  -- Default end times to start_time + 3 hours if missing
  v_effective_end_a := COALESCE(p_end_a, (p_start_a + interval '3 hours')::time);
  v_effective_end_b := COALESCE(p_end_b, (p_start_b + interval '3 hours')::time);

  v_crosses_a := v_effective_end_a < p_start_a;
  v_crosses_b := v_effective_end_b < p_start_b;

  -- Same date check
  IF p_date_a = p_date_b THEN
    IF NOT v_crosses_a AND NOT v_crosses_b THEN
      -- Strict interval overlap: abutting times (start_b = end_a or start_a = end_b) do NOT overlap
      RETURN p_start_a < v_effective_end_b AND p_start_b < v_effective_end_a;
    ELSE
      -- Midnight crossing handled on same date
      RETURN (p_start_a < '24:00:00'::time AND p_start_b < v_effective_end_a)
          OR (p_start_b < '24:00:00'::time AND p_start_a < v_effective_end_b);
    END IF;
  END IF;

  -- Adjacent dates (midnight crossing into next day)
  IF p_date_b = p_date_a + 1 AND v_crosses_a THEN
    RETURN p_start_b < v_effective_end_a;
  END IF;

  IF p_date_a = p_date_b + 1 AND v_crosses_b THEN
    RETURN p_start_a < v_effective_end_b;
  END IF;

  RETURN false;
END;
$$;

-- 2. Enhanced Atomic Server-Side Crew Assignment RPC with Conflict Validation
CREATE OR REPLACE FUNCTION public.replace_shoot_assignments(
  p_shoot_id uuid,
  p_assignments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_target_shoot record;
  v_elem jsonb;
  v_team_member_id uuid;
  v_assignment_type text;
  v_on_site_count integer := 0;
  v_unique_workers uuid[] := ARRAY[]::uuid[];
  v_conflicting_shoot record;
  v_worker_name text;
BEGIN
  -- Verify caller is an administrator
  v_is_admin := (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.is_admin())) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND lower(COALESCE(email, '')) = 'saniyakausar089@gmail.com'
  );

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to manage shoot assignments.' USING ERRCODE = '42501';
  END IF;

  -- Retrieve and lock target shoot
  SELECT id, couple_name, event_type, event_date, start_time, end_time, status
  INTO v_target_shoot
  FROM public.shoots
  WHERE id = p_shoot_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shoot with ID % not found.', p_shoot_id USING ERRCODE = 'P0002';
  END IF;

  -- Validate array and compute on-site headcount
  IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      v_team_member_id := (v_elem->>'team_member_id')::uuid;
      v_assignment_type := COALESCE(v_elem->>'assignment_type', 'on_site');

      -- Validate team member exists and acquire lock to serialize concurrent assignment operations
      SELECT full_name INTO v_worker_name
      FROM public.team_members
      WHERE id = v_team_member_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker with ID % does not exist in team registry.', v_team_member_id USING ERRCODE = 'P0002';
      END IF;

      IF v_assignment_type = 'on_site' THEN
        IF NOT (v_unique_workers @> ARRAY[v_team_member_id]) THEN
          v_unique_workers := array_append(v_unique_workers, v_team_member_id);
          v_on_site_count := v_on_site_count + 1;
        END IF;

        -- Global crew availability check across all active shoots if target shoot is active
        IF v_target_shoot.status <> 'Cancelled' THEN
          SELECT s.id, s.couple_name, s.event_type, s.event_date, s.start_time, s.end_time
          INTO v_conflicting_shoot
          FROM public.shoot_assignments sa
          JOIN public.shoots s ON s.id = sa.shoot_id
          WHERE sa.team_member_id = v_team_member_id
            AND sa.assignment_type = 'on_site'
            AND s.id <> p_shoot_id
            AND s.status <> 'Cancelled'
            AND public.check_shoot_time_overlap(
              v_target_shoot.event_date,
              v_target_shoot.start_time::time,
              v_target_shoot.end_time::time,
              s.event_date,
              s.end_time::time,
              s.start_time::time
            )
          LIMIT 1;

          IF FOUND THEN
            RAISE EXCEPTION 'CREW MEMBER UNAVAILABLE: % is already assigned to Project "%", Event "%" on % (% to %). The selected shoot overlaps with this assignment.',
              v_worker_name,
              v_conflicting_shoot.couple_name,
              v_conflicting_shoot.event_type,
              v_conflicting_shoot.event_date,
              v_conflicting_shoot.start_time,
              COALESCE(v_conflicting_shoot.end_time::text, 'end')
              USING ERRCODE = '23P01';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Enforce studio maximum capacity of 20 unique on-site workers per shoot
  IF v_on_site_count > 20 THEN
    RAISE EXCEPTION 'Cannot exceed the studio maximum of 20 on-site crew members (attempted: %).', v_on_site_count USING ERRCODE = '22000';
  END IF;

  -- Atomic replace: delete old assignments for this shoot
  DELETE FROM public.shoot_assignments WHERE shoot_id = p_shoot_id;

  -- Insert new validated assignments
  IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      v_team_member_id := (v_elem->>'team_member_id')::uuid;
      v_assignment_type := COALESCE(v_elem->>'assignment_type', 'on_site');

      INSERT INTO public.shoot_assignments (
        shoot_id,
        team_member_id,
        assignment_type
      )
      VALUES (
        p_shoot_id,
        v_team_member_id,
        v_assignment_type
      )
      ON CONFLICT (shoot_id, team_member_id)
      DO UPDATE SET assignment_type = EXCLUDED.assignment_type;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'shoot_id', p_shoot_id,
    'assigned_crew_count', v_on_site_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_shoot_assignments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_shoot_assignments(uuid, jsonb) TO authenticated, service_role;

-- 3. Trigger to validate crew availability when an event is rescheduled
CREATE OR REPLACE FUNCTION public.validate_shoot_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict record;
BEGIN
  -- Only validate if timing has changed and shoot is active
  IF NEW.status <> 'Cancelled' AND (
    NEW.event_date <> OLD.event_date OR
    NEW.start_time <> OLD.start_time OR
    NEW.end_time IS DISTINCT FROM OLD.end_time
  ) THEN
    SELECT tm.full_name, other.couple_name, other.event_type, other.event_date, other.start_time, other.end_time
    INTO v_conflict
    FROM public.shoot_assignments sa
    JOIN public.team_members tm ON tm.id = sa.team_member_id
    JOIN public.shoot_assignments other_sa ON other_sa.team_member_id = sa.team_member_id AND other_sa.assignment_type = 'on_site'
    JOIN public.shoots other ON other.id = other_sa.shoot_id
    WHERE sa.shoot_id = NEW.id
      AND sa.assignment_type = 'on_site'
      AND other.id <> NEW.id
      AND other.status <> 'Cancelled'
      AND public.check_shoot_time_overlap(
        NEW.event_date,
        NEW.start_time::time,
        NEW.end_time::time,
        other.event_date,
        other.end_time::time,
        other.start_time::time
      )
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'CREW MEMBER UNAVAILABLE: Rescheduling conflicts with existing assignment for % on Project "%" (Event: "%") on % (% to %).',
        v_conflict.full_name,
        v_conflict.couple_name,
        v_conflict.event_type,
        v_conflict.event_date,
        v_conflict.start_time,
        COALESCE(v_conflict.end_time::text, 'end')
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shoot_reschedule ON public.shoots;
CREATE TRIGGER trg_validate_shoot_reschedule
  BEFORE UPDATE OF event_date, start_time, end_time, status ON public.shoots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_shoot_reschedule();
