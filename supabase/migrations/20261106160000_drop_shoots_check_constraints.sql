-- Migration: Relax shoots constraints to support overnight shoots and flexible crew sizes (1-20)
-- 1. Drop the legacy unnamed table-level check constraint (end_time > start_time) which broke overnight shoots
ALTER TABLE public.shoots DROP CONSTRAINT IF EXISTS shoots_check;

-- 2. Drop any legacy planned_team_size check that required 7-20 members
ALTER TABLE public.shoots DROP CONSTRAINT IF EXISTS shoots_planned_team_size_check;

-- 3. Add modern planned_team_size check allowing 1 to 20 crew members matching the UI
ALTER TABLE public.shoots ADD CONSTRAINT shoots_planned_team_size_check CHECK (planned_team_size BETWEEN 1 AND 20);

