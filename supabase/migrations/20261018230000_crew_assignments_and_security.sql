-- =====================================================================
-- TA BRIDALS: CREW ASSIGNMENTS, CAPACITY LIMITS & DATABASE INTEGRITY
-- =====================================================================

-- 1. Ensure RLS is active and enforced on public.shoots
ALTER TABLE public.shoots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoots FORCE ROW LEVEL SECURITY;

-- 2. Ensure RLS is active and enforced on public.shoot_assignments
ALTER TABLE public.shoot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_assignments FORCE ROW LEVEL SECURITY;

-- 3. Unique constraint preventing duplicate assignments of the same worker to a shoot
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_shoot_assignments_shoot_member'
  ) THEN
    ALTER TABLE public.shoot_assignments
      ADD CONSTRAINT uq_shoot_assignments_shoot_member
      UNIQUE (shoot_id, team_member_id);
  END IF;
END $$;

-- 4. Atomic Server-Side Crew Assignment RPC
-- Validates:
-- - Admin authorization
-- - Valid shoot existence
-- - Maximum 20 unique on-site workers per shoot
-- - Valid worker IDs
-- Executes deletion and replacement within a single atomic database transaction
DROP FUNCTION IF EXISTS public.replace_shoot_assignments(uuid, jsonb);

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
  v_elem jsonb;
  v_team_member_id uuid;
  v_assignment_type text;
  v_on_site_count integer := 0;
  v_unique_workers uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Verify caller is an administrator
  v_is_admin := public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND lower(COALESCE(email, '')) = 'saniyakausar089@gmail.com'
  );

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to manage shoot assignments.' USING ERRCODE = '42501';
  END IF;

  -- Verify shoot exists
  IF NOT EXISTS (SELECT 1 FROM public.shoots WHERE id = p_shoot_id) THEN
    RAISE EXCEPTION 'Shoot with ID % not found.', p_shoot_id USING ERRCODE = 'P0002';
  END IF;

  -- Validate array and compute on-site headcount
  IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      v_team_member_id := (v_elem->>'team_member_id')::uuid;
      v_assignment_type := COALESCE(v_elem->>'assignment_type', 'on_site');

      IF v_assignment_type = 'on_site' THEN
        IF NOT (v_unique_workers @> ARRAY[v_team_member_id]) THEN
          v_unique_workers := array_append(v_unique_workers, v_team_member_id);
          v_on_site_count := v_on_site_count + 1;
        END IF;
      END IF;

      -- Validate team member existence
      IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = v_team_member_id) THEN
        RAISE EXCEPTION 'Worker with ID % does not exist in team registry.', v_team_member_id USING ERRCODE = 'P0002';
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
