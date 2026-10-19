-- TA BRIDALS — Audit Log DELETE policy for admins
-- Allows admins to delete individual or all audit log entries.

DROP POLICY IF EXISTS "Only admins can delete audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can delete audit logs"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
