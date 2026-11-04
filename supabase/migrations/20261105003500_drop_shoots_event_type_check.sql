-- Migration: Drop shoots_event_type_check constraint
-- Allows shoots to accept custom event types (e.g. Haldi, Sangeet, Birthday, Corporate, etc.)
-- without violating the legacy check constraint.

ALTER TABLE public.shoots DROP CONSTRAINT IF EXISTS shoots_event_type_check;
