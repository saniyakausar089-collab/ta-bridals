-- Migration: YouTube Music Integration and Category Harmonization
-- 16 Wedding Categories:
-- Bride Entry, Groom Entry, Couple Entry, Haldi, Mehendi, Sangeet,
-- Wedding Ceremony, Varmala/Jaimala, Pheras, Reception, First Dance,
-- Couple Portraits, Family Moments, Emotional/Romantic Moments, Grand Finale, Custom Event

-- 1. Alter songs and client_song_selections event_group to text with check constraint
-- so that it supports the required 16 wedding categories seamlessly.
alter table public.songs alter column event_group type text;
alter table public.client_song_selections alter column event_group type text;

-- 2. Add YouTube metadata and soft-delete/active status to songs table
alter table public.songs
  add column if not exists youtube_video_id text,
  add column if not exists channel_name text,
  add column if not exists thumbnail_url text,
  add column if not exists youtube_url text,
  add column if not exists is_active boolean not null default true;

-- 3. Prevent duplicate YouTube videos in the same library
create unique index if not exists idx_songs_library_youtube_unique
  on public.songs (library_id, youtube_video_id)
  where youtube_video_id is not null and is_active = true;

-- 4. Index for active songs by library
create index if not exists idx_songs_library_active
  on public.songs (library_id, is_active);
