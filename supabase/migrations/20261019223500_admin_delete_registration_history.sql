-- =====================================================================
-- Migration: Admin Delete Registration History
-- Adds policy & security definer procedures for admins to delete
-- individual registration records or clear rejected registration history.
-- =====================================================================

-- 1. DELETE policy on public.profiles for admins
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND lower(COALESCE(p.email, '')) = 'saniyakausar089@gmail.com'
    )
  );

-- 2. Procedure to delete a single registration and its auth user
CREATE OR REPLACE FUNCTION public.delete_registration_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND lower(COALESCE(email, '')) = 'saniyakausar089@gmail.com'
    )
  ) THEN
    RAISE EXCEPTION 'Only administrators can delete registrations.' USING ERRCODE = '42501';
  END IF;

  -- Protect main owner
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_user_id AND lower(COALESCE(email, '')) = 'saniyakausar089@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Cannot delete the primary studio administrator profile.' USING ERRCODE = '22000';
  END IF;

  DELETE FROM public.profiles WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_registration_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_registration_profile(uuid) TO authenticated, service_role;

-- 3. Procedure to bulk clear rejected registrations
CREATE OR REPLACE FUNCTION public.clear_rejected_registrations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_ids uuid[];
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND lower(COALESCE(email, '')) = 'saniyakausar089@gmail.com'
    )
  ) THEN
    RAISE EXCEPTION 'Only administrators can clear registrations.' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(user_id) INTO v_ids
  FROM public.profiles
  WHERE approval_status = 'rejected'
    AND lower(COALESCE(email, '')) <> 'saniyakausar089@gmail.com';

  v_count := COALESCE(array_length(v_ids, 1), 0);

  IF v_count > 0 THEN
    DELETE FROM public.profiles WHERE user_id = ANY(v_ids);
    DELETE FROM auth.users WHERE id = ANY(v_ids);
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_rejected_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_rejected_registrations() TO authenticated, service_role;
