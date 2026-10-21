-- Ensure is_admin permits all studio users while keeping clients isolated
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'team_member'))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND approval_status = 'approved')
    OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (lower(email) IN ('saniyakausar089@gmail.com', 'saniyakausar080@gmail.com') OR phone IN ('919876543210', '+919876543210')))
    OR NOT EXISTS (SELECT 1 FROM public.client_profiles WHERE id = auth.uid())
  );
$$;
