-- Enable phone authentication for clients portal
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.get_client_auth_email(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_digits text;
BEGIN
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_digits) > 10 THEN
    v_digits := substring(v_digits from length(v_digits) - 9);
  END IF;

  -- 1. Check client_profiles directly by phone or matching last 10 digits
  SELECT email INTO v_email
  FROM public.client_profiles
  WHERE (phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') LIKE '%' || v_digits)
     OR (email IS NOT NULL AND regexp_replace(email, '\D', '', 'g') LIKE '%' || v_digits)
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 2. Check auth.users phone or raw_user_meta_data->>'phone'
  SELECT email INTO v_email
  FROM auth.users
  WHERE (phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') LIKE '%' || v_digits)
     OR (raw_user_meta_data->>'phone' IS NOT NULL AND regexp_replace(raw_user_meta_data->>'phone', '\D', '', 'g') LIKE '%' || v_digits)
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- Grant execution to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_client_auth_email(text) TO anon, authenticated, service_role;
