-- =====================================================================
-- Migration: Fix shoot name / couple name column synchronization
-- Ensures adding shoots succeeds regardless of whether "shoot name" or "couple_name"
-- is provided, keeping both columns synchronized and removing the blocking NOT NULL constraint.
-- =====================================================================

-- 1. Relax NOT NULL constraint on "shoot name" column so inserts without it succeed
ALTER TABLE public.shoots ALTER COLUMN "shoot name" DROP NOT NULL;
ALTER TABLE public.shoots ALTER COLUMN "shoot name" SET DEFAULT '';

-- 2. Trigger function to keep "shoot name" and "couple_name" bidirectionally in sync
CREATE OR REPLACE FUNCTION public.sync_shoot_names()
RETURNS trigger AS $$
BEGIN
  -- If couple_name is present and shoot name is missing, populate shoot name
  IF (NEW.couple_name IS NOT NULL AND TRIM(NEW.couple_name) <> '') AND 
     (NEW."shoot name" IS NULL OR TRIM(NEW."shoot name") = '') THEN
    NEW."shoot name" := NEW.couple_name;
  END IF;

  -- If shoot name is present and couple_name is missing, populate couple_name
  IF (NEW."shoot name" IS NOT NULL AND TRIM(NEW."shoot name") <> '') AND 
     (NEW.couple_name IS NULL OR TRIM(NEW.couple_name) = '') THEN
    NEW.couple_name := NEW."shoot name";
  END IF;

  -- Fallback if neither was provided
  IF (NEW.couple_name IS NULL OR TRIM(NEW.couple_name) = '') AND 
     (NEW."shoot name" IS NULL OR TRIM(NEW."shoot name") = '') THEN
    NEW.couple_name := 'Untitled Shoot';
    NEW."shoot name" := 'Untitled Shoot';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to public.shoots
DROP TRIGGER IF EXISTS trg_sync_shoots_name ON public.shoots;
CREATE TRIGGER trg_sync_shoots_name
  BEFORE INSERT OR UPDATE ON public.shoots
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shoot_names();

-- 4. Backfill any existing rows
UPDATE public.shoots
SET "shoot name" = COALESCE("shoot name", couple_name, 'Untitled Shoot'),
    couple_name = COALESCE(couple_name, "shoot name", 'Untitled Shoot')
WHERE "shoot name" IS NULL OR couple_name IS NULL OR "shoot name" = '' OR couple_name = '';
