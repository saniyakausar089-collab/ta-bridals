-- Migration: 10-Digit Mobile Number Authentication
-- Adds normalized 10-digit phone number column, uniqueness constraints,
-- and secure email resolution RPC for mobile + password login.

-- 1. Extend public.profiles with normalized 10-digit phone_number
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number text;

-- Clean any non-digit characters in public.profiles.phone_number if present
UPDATE public.profiles
SET phone_number = substring(regexp_replace(phone_number, '\D', '', 'g') from length(regexp_replace(phone_number, '\D', '', 'g')) - 9)
WHERE phone_number IS NOT NULL AND length(regexp_replace(phone_number, '\D', '', 'g')) >= 10;

-- Enforce 10-digit format check on profiles.phone_number
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_number_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_number_format_check
  CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{10}$');

-- Enforce uniqueness on profiles.phone_number
DROP INDEX IF EXISTS idx_profiles_phone_number_unique;
CREATE UNIQUE INDEX idx_profiles_phone_number_unique
  ON public.profiles(phone_number)
  WHERE phone_number IS NOT NULL;

-- 2. Clean and standardize client_profiles.phone
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.client_profiles
SET phone = substring(regexp_replace(phone, '\D', '', 'g') from length(regexp_replace(phone, '\D', '', 'g')) - 9)
WHERE phone IS NOT NULL AND length(regexp_replace(phone, '\D', '', 'g')) >= 10;

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_phone_format_check;

ALTER TABLE public.client_profiles
  ADD CONSTRAINT client_profiles_phone_format_check
  CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$');

DROP INDEX IF EXISTS idx_client_profiles_phone_unique;
CREATE UNIQUE INDEX idx_client_profiles_phone_unique
  ON public.client_profiles(phone)
  WHERE phone IS NOT NULL;

-- 3. Backfill known studio owner / admin and staff accounts
UPDATE public.profiles
SET phone_number = '9876543210'
WHERE lower(email) = 'saniyakausar089@gmail.com' AND (phone_number IS NULL OR phone_number = '');

UPDATE public.profiles
SET phone_number = '9398978342'
WHERE lower(email) = 'achiever7182@gmail.com' AND (phone_number IS NULL OR phone_number = '');

-- Backfill client_profiles from auth.users raw_user_meta_data if available
UPDATE public.client_profiles cp
SET phone = substring(regexp_replace(u.raw_user_meta_data->>'phone', '\D', '', 'g') from length(regexp_replace(u.raw_user_meta_data->>'phone', '\D', '', 'g')) - 9)
FROM auth.users u
WHERE cp.id = u.id
  AND (cp.phone IS NULL OR cp.phone = '')
  AND u.raw_user_meta_data->>'phone' IS NOT NULL
  AND length(regexp_replace(u.raw_user_meta_data->>'phone', '\D', '', 'g')) >= 10
  AND NOT EXISTS (
    SELECT 1 FROM public.client_profiles existing
    WHERE existing.phone = substring(regexp_replace(u.raw_user_meta_data->>'phone', '\D', '', 'g') from length(regexp_replace(u.raw_user_meta_data->>'phone', '\D', '', 'g')) - 9)
  );

-- 4. Secure RPC function: resolve_auth_email_by_phone
CREATE OR REPLACE FUNCTION public.resolve_auth_email_by_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_digits text;
  v_email text;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extract numeric digits only
  v_digits := regexp_replace(p_phone, '\D', '', 'g');

  -- If country code +91 was passed (12 digits starting with 91), strip leading 91
  IF length(v_digits) = 12 AND v_digits LIKE '91%' THEN
    v_digits := substring(v_digits from 3);
  ELSIF length(v_digits) = 11 AND v_digits LIKE '0%' THEN
    v_digits := substring(v_digits from 2);
  ELSIF length(v_digits) > 10 THEN
    v_digits := substring(v_digits from length(v_digits) - 9);
  END IF;

  -- Validate exactly 10 digits
  IF length(v_digits) != 10 THEN
    RETURN NULL;
  END IF;

  -- 1. Check studio profiles (staff & admin)
  SELECT lower(email) INTO v_email
  FROM public.profiles
  WHERE phone_number = v_digits AND email IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 2. Check client_profiles
  SELECT lower(email) INTO v_email
  FROM public.client_profiles
  WHERE phone = v_digits AND email IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 3. Check auth.users by phone or metadata
  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE (phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') LIKE '%' || v_digits)
     OR (raw_user_meta_data->>'phone' IS NOT NULL AND regexp_replace(raw_user_meta_data->>'phone', '\D', '', 'g') LIKE '%' || v_digits)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 4. Fallback for studio owner account
  IF v_digits IN ('9948026203', '9876543210') THEN
    RETURN 'saniyakausar089@gmail.com';
  END IF;

  RETURN NULL;
END;
$$;

-- Grant execution to anon, authenticated, service_role
REVOKE ALL ON FUNCTION public.resolve_auth_email_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_auth_email_by_phone(text) TO anon, authenticated, service_role;

-- Backward compatibility for get_client_auth_email
CREATE OR REPLACE FUNCTION public.get_client_auth_email(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.resolve_auth_email_by_phone(p_phone);
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_auth_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_auth_email(text) TO anon, authenticated, service_role;

-- 5. RPC function: check_mobile_number_available
CREATE OR REPLACE FUNCTION public.check_mobile_number_available(p_phone text, p_exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_exists boolean;
BEGIN
  IF p_phone IS NULL THEN
    RETURN false;
  END IF;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_digits) = 12 AND v_digits LIKE '91%' THEN
    v_digits := substring(v_digits from 3);
  ELSIF length(v_digits) = 11 AND v_digits LIKE '0%' THEN
    v_digits := substring(v_digits from 2);
  ELSIF length(v_digits) > 10 THEN
    v_digits := substring(v_digits from length(v_digits) - 9);
  END IF;

  IF length(v_digits) != 10 THEN
    RETURN false;
  END IF;

  -- Check profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone_number = v_digits
      AND (p_exclude_user_id IS NULL OR user_id != p_exclude_user_id)
  ) INTO v_exists;

  IF v_exists THEN
    RETURN false;
  END IF;

  -- Check client_profiles
  SELECT EXISTS (
    SELECT 1 FROM public.client_profiles
    WHERE phone = v_digits
      AND (p_exclude_user_id IS NULL OR id != p_exclude_user_id)
  ) INTO v_exists;

  IF v_exists THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_mobile_number_available(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_mobile_number_available(text, uuid) TO anon, authenticated, service_role;

-- 6. RPC function: link_user_mobile_number (for authenticated users)
CREATE OR REPLACE FUNCTION public.link_user_mobile_number(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_digits text;
  v_available boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_digits) = 12 AND v_digits LIKE '91%' THEN
    v_digits := substring(v_digits from 3);
  ELSIF length(v_digits) = 11 AND v_digits LIKE '0%' THEN
    v_digits := substring(v_digits from 2);
  ELSIF length(v_digits) > 10 THEN
    v_digits := substring(v_digits from length(v_digits) - 9);
  END IF;

  IF length(v_digits) != 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid 10-digit mobile number.');
  END IF;

  v_available := public.check_mobile_number_available(v_digits, v_user_id);
  IF NOT v_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already linked to another account.');
  END IF;

  -- Update in profiles if user is in profiles
  UPDATE public.profiles
  SET phone_number = v_digits, updated_at = now()
  WHERE user_id = v_user_id;

  -- Update in client_profiles if user is client
  UPDATE public.client_profiles
  SET phone = v_digits
  WHERE id = v_user_id;

  -- Update raw_user_meta_data in auth.users
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', v_digits)
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'phone', v_digits);
END;
$$;

REVOKE ALL ON FUNCTION public.link_user_mobile_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_user_mobile_number(text) TO authenticated, service_role;


-- 7. Update handle_new_user trigger to populate normalized 10-digit phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  user_display_name text;
  signup_type text;
  raw_phone text;
  phone_digits text;
BEGIN
  is_owner := (lower(coalesce(NEW.email, '')) = 'saniyakausar089@gmail.com');
  signup_type := coalesce(NEW.raw_user_meta_data->>'signup_type', '');

  raw_phone := coalesce(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number', NEW.phone, '');
  phone_digits := regexp_replace(raw_phone, '\D', '', 'g');
  IF length(phone_digits) = 12 AND phone_digits LIKE '91%' THEN
    phone_digits := substring(phone_digits from 3);
  ELSIF length(phone_digits) = 11 AND phone_digits LIKE '0%' THEN
    phone_digits := substring(phone_digits from 2);
  ELSIF length(phone_digits) > 10 THEN
    phone_digits := substring(phone_digits from length(phone_digits) - 9);
  END IF;
  IF length(phone_digits) != 10 THEN
    phone_digits := NULL;
  END IF;

  IF is_owner AND phone_digits IS NULL THEN
    phone_digits := '9876543210';
  END IF;

  IF signup_type = 'client' THEN
    INSERT INTO public.client_profiles (id, email, full_name, partner_name, wedding_date, approval_status, phone)
    VALUES (
      NEW.id,
      lower(coalesce(NEW.email, '')),
      coalesce(NEW.raw_user_meta_data->>'full_name', ''),
      nullif(NEW.raw_user_meta_data->>'partner_name', ''),
      CASE 
        WHEN (NEW.raw_user_meta_data->>'wedding_date') ~ '^\d{4}-\d{2}-\d{2}$' 
        THEN (NEW.raw_user_meta_data->>'wedding_date')::date 
        ELSE null 
      END,
      'pending',
      phone_digits
    )
    ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(client_profiles.phone, EXCLUDED.phone),
        email = COALESCE(client_profiles.email, EXCLUDED.email);
    RETURN NEW;
  END IF;

  user_display_name := coalesce(
    nullif(NEW.raw_user_meta_data->>'display_name', ''),
    nullif(NEW.raw_user_meta_data->>'full_name', ''),
    nullif(NEW.raw_user_meta_data->>'name', ''),
    split_part(coalesce(NEW.email, ''), '@', 1)
  );

  INSERT INTO public.profiles (user_id, display_name, email, approval_status, phone_number)
  VALUES (
    NEW.id,
    user_display_name,
    lower(coalesce(NEW.email, '')),
    CASE WHEN is_owner THEN 'approved' ELSE 'pending' END,
    phone_digits
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      phone_number = COALESCE(profiles.phone_number, EXCLUDED.phone_number),
      display_name = CASE WHEN profiles.display_name = '' THEN EXCLUDED.display_name ELSE profiles.display_name END;

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


-- 8. Enforce authorization check on replace_shoot_assignments
CREATE OR REPLACE FUNCTION public.replace_shoot_assignments(
  p_shoot_id uuid,
  p_assignments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_elem jsonb;
  v_team_member_id uuid;
  v_assignment_type text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shoots WHERE id = p_shoot_id) THEN
    RAISE EXCEPTION 'Shoot with ID % not found', p_shoot_id;
  END IF;

  DELETE FROM public.shoot_assignments WHERE shoot_id = p_shoot_id;

  IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
      v_team_member_id := (v_elem->>'team_member_id')::uuid;
      v_assignment_type := COALESCE(v_elem->>'assignment_type', 'on_site');

      INSERT INTO public.shoot_assignments (shoot_id, team_member_id, assignment_type)
      VALUES (p_shoot_id, v_team_member_id, v_assignment_type)
      ON CONFLICT (shoot_id, team_member_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(COALESCE(p_assignments, '[]'::jsonb)));
END;
$$;
