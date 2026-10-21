-- Fix Song Library schema and enable multi-library assignments per client

-- 1. Alter songs and client_song_selections event_group to text
ALTER TABLE public.songs ALTER COLUMN event_group TYPE text;
ALTER TABLE public.client_song_selections ALTER COLUMN event_group TYPE text;

-- 2. Add YouTube metadata and soft-delete/active status to songs table
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS channel_name text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. Prevent duplicate YouTube videos in the same library
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_library_youtube_unique
  ON public.songs (library_id, youtube_video_id)
  WHERE youtube_video_id IS NOT NULL AND is_active = true;

-- 4. Index for active songs by library
CREATE INDEX IF NOT EXISTS idx_songs_library_active
  ON public.songs (library_id, is_active);

-- 5. Allow multiple song libraries to be assigned to a single client
ALTER TABLE public.client_library_assignments DROP CONSTRAINT IF EXISTS client_library_assignments_pkey;
ALTER TABLE public.client_library_assignments ADD CONSTRAINT client_library_assignments_pkey PRIMARY KEY (client_id, library_id);

-- 6. Update is_admin function to recognize all admin channels
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (lower(email) = 'saniyakausar089@gmail.com' OR phone IN ('919876543210', '+919876543210')))
  );
$$;

-- 7. Update RLS policies so client can access ALL assigned libraries and songs
DROP POLICY IF EXISTS "client_read_assigned_library" ON public.song_libraries;
CREATE POLICY "client_read_assigned_library" ON public.song_libraries
  FOR SELECT USING (
    id IN (SELECT library_id FROM public.client_library_assignments WHERE client_id = auth.uid())
    AND NOT is_archived
  );

DROP POLICY IF EXISTS "client_read_assigned_songs" ON public.songs;
CREATE POLICY "client_read_assigned_songs" ON public.songs
  FOR SELECT USING (
    library_id IN (SELECT library_id FROM public.client_library_assignments WHERE client_id = auth.uid())
  );
