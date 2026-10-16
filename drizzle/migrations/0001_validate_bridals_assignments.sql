ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_email_format_check
  CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') NOT VALID;
ALTER TABLE public.team_members VALIDATE CONSTRAINT team_members_email_format_check;

CREATE OR REPLACE FUNCTION public.replace_shoot_assignments(p_shoot_id uuid, p_assignments jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  assignment_count integer;
  unique_member_count integer;
  existing_member_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized to manage shoot assignments.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Assignments must be provided as a list.' USING ERRCODE = '22023';
  END IF;
  SELECT count(*), count(DISTINCT item->>'team_member_id')
    INTO assignment_count, unique_member_count
    FROM jsonb_array_elements(p_assignments) AS entry(item);
  IF assignment_count > 20 OR assignment_count <> unique_member_count THEN
    RAISE EXCEPTION 'Assignments must contain at most 20 unique team members.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_assignments) AS entry(item)
    WHERE item->>'assignment_type' NOT IN ('on_site', 'post_production')
       OR item->>'team_member_id' IS NULL
  ) THEN
    RAISE EXCEPTION 'Each assignment must have a team member and valid assignment type.' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO existing_member_count
    FROM jsonb_array_elements(p_assignments) AS entry(item)
    JOIN public.team_members AS member
      ON member.id = (item->>'team_member_id')::uuid;
  IF existing_member_count <> assignment_count THEN
    RAISE EXCEPTION 'A selected team member no longer exists.' USING ERRCODE = '23503';
  END IF;
  PERFORM 1 FROM public.shoots WHERE id = p_shoot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shoot not found.' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.shoot_assignments WHERE shoot_id = p_shoot_id;
  INSERT INTO public.shoot_assignments (shoot_id, team_member_id, assignment_type)
  SELECT p_shoot_id, (item->>'team_member_id')::uuid, item->>'assignment_type'
  FROM jsonb_array_elements(p_assignments) AS entry(item);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_shoot_assignments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_shoot_assignments(uuid, jsonb) TO authenticated, service_role;