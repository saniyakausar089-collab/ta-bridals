ALTER TABLE public.shoots DROP CONSTRAINT IF EXISTS shoots_check;
ALTER TABLE public.shoots DROP CONSTRAINT IF EXISTS shoots_planned_team_size_check;
ALTER TABLE public.shoots ADD CONSTRAINT shoots_planned_team_size_check CHECK (planned_team_size BETWEEN 1 AND 20);

