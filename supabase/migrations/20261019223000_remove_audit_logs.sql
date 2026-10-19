-- =====================================================================
-- Migration: Remove Audit Logs Feature
-- Drops the audit_logs table, associated indexes, and policies.
-- =====================================================================

DROP TABLE IF EXISTS public.audit_logs CASCADE;
