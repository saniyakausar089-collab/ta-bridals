-- 1. Extend app_role enum to support 'team_member'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_member';

-- 2. Add email, approval_status, reviewed_at, and reviewed_by to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

-- Ensure valid approval_status values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Backfill email from auth.users if available
UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '');

-- Ensure owner and any existing admin accounts are marked approved
UPDATE public.profiles
SET approval_status = 'approved'
WHERE user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
) OR lower(COALESCE(email, '')) = 'saniyakausar089@gmail.com';

-- 3. Update handle_new_user trigger to populate email and pending status safely
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  user_display_name text;
BEGIN
  is_owner := (lower(COALESCE(NEW.email, '')) = 'saniyakausar089@gmail.com');
  user_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  INSERT INTO public.profiles (user_id, display_name, email, approval_status)
  VALUES (
    NEW.id,
    user_display_name,
    lower(COALESCE(NEW.email, '')),
    CASE WHEN is_owner THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = CASE WHEN profiles.display_name = '' THEN EXCLUDED.display_name ELSE profiles.display_name END;

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Protect profiles table so non-admins cannot tamper with approval_status or review fields
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      RAISE EXCEPTION 'Only administrators can modify registration approval status.' USING ERRCODE = '42501';
    END IF;
    IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
      RAISE EXCEPTION 'Only administrators can modify review fields.' USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot modify user ID.' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 5. Helper function to check if a user is approved
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND approval_status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated, service_role;

-- 6. Helper functions for Admin to approve / reject user registrations
CREATE OR REPLACE FUNCTION public.approve_user_registration(p_user_id uuid, p_role text DEFAULT 'team_member')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can approve registrations.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'team_member')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_user_registration(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_user_registration(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_user_registration(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can reject registrations.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE user_id = p_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = 'team_member';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_user_registration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_user_registration(uuid) TO authenticated, service_role;

-- 7. RLS Policies: Profiles & User Roles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. RLS Policies: Shoots, Team Members & Assignments for approved users
CREATE POLICY "Approved users can view shoots"
  ON public.shoots FOR SELECT
  TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can view team members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can view shoot assignments"
  ON public.shoot_assignments FOR SELECT
  TO authenticated
  USING (public.is_approved_user(auth.uid()));
