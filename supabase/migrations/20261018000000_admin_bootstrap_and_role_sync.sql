-- Migration: Admin Bootstrap & Role Synchronization
-- Ensures admin role in user_roles and portal_admins are unified,
-- and provides a secure server-side procedure for promoting administrators.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Secure procedure to promote an existing user to admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(p_user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Only existing admins or postgres/service_role can promote
  IF NOT (public.has_role(auth.uid(), 'admin') OR current_user IN ('postgres', 'service_role')) THEN
    RAISE EXCEPTION 'Only an administrator can promote users to admin.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_user_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found.', p_user_email USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.portal_admins (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_user_to_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(text) TO authenticated, service_role;

-- Ensure primary studio owner is synchronized across all admin tables
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE lower(email) = 'saniyakausar089@gmail.com';

  IF v_owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET approval_status = 'approved'
    WHERE user_id = v_owner_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_owner_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.portal_admins (user_id)
    VALUES (v_owner_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
