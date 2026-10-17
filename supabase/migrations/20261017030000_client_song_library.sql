-- Phase 1 Migration: Client Song Library Portal & Access Control
-- Idempotent script for portal_admins, client_profiles, song_libraries, songs,
-- client_library_assignments, client_song_selections, and storage bucket 'songs-audio'

create table if not exists public.portal_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.portal_admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.portal_admins where user_id = auth.uid()); $$;

drop policy if exists "portal_admin_read_portal_admins" on public.portal_admins;
create policy "portal_admin_read_portal_admins" on public.portal_admins
  for select using (public.is_admin());

do $$ begin
  create type public.event_group as enum (
    'Haldi','Mehendi','Sangeet','Baraat','Entry','Nikah',
    'Pheras/Ceremony','Couple Dance','Cocktail','Reception','Vidaai','Other');
exception when duplicate_object then null; end $$;

create table if not exists public.client_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  partner_name text,
  wedding_date date,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.song_libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.song_libraries(id) on delete cascade,
  title text not null,
  artist text,
  event_group public.event_group not null default 'Other',
  audio_path text,
  created_at timestamptz not null default now()
);
create index if not exists songs_library_idx on public.songs(library_id);

create table if not exists public.client_library_assignments (
  client_id uuid primary key references public.client_profiles(id) on delete cascade,
  library_id uuid not null references public.song_libraries(id) on delete restrict,
  assigned_at timestamptz not null default now()
);

create table if not exists public.client_song_selections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client_profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  event_group public.event_group not null,
  created_at timestamptz not null default now(),
  unique (client_id, song_id, event_group)
);

create or replace function public.enforce_approved_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  if not exists (select 1 from public.client_profiles
                 where id = new.client_id and approval_status = 'approved') then
    raise exception 'client must be approved before assignment';
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_approved_assignment on public.client_library_assignments;
create trigger trg_enforce_approved_assignment
  before insert or update on public.client_library_assignments
  for each row execute function public.enforce_approved_assignment();

create or replace function public.my_library_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select library_id from public.client_library_assignments where client_id = auth.uid(); $$;

-- Enable RLS on all portal tables
alter table public.client_profiles enable row level security;
alter table public.song_libraries enable row level security;
alter table public.songs enable row level security;
alter table public.client_library_assignments enable row level security;
alter table public.client_song_selections enable row level security;

-- Policies on client_profiles
drop policy if exists "portal_admin_all_profiles" on public.client_profiles;
create policy "portal_admin_all_profiles" on public.client_profiles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "client_read_own_profile" on public.client_profiles;
create policy "client_read_own_profile" on public.client_profiles
  for select using (id = auth.uid());

drop policy if exists "client_insert_pending_profile" on public.client_profiles;
create policy "client_insert_pending_profile" on public.client_profiles
  for insert with check (id = auth.uid() and approval_status = 'pending');

-- Policies on song_libraries
drop policy if exists "portal_admin_all_libraries" on public.song_libraries;
create policy "portal_admin_all_libraries" on public.song_libraries
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "client_read_assigned_library" on public.song_libraries;
create policy "client_read_assigned_library" on public.song_libraries
  for select using (id = public.my_library_id() and not is_archived);

-- Policies on songs
drop policy if exists "portal_admin_all_songs" on public.songs;
create policy "portal_admin_all_songs" on public.songs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "client_read_assigned_songs" on public.songs;
create policy "client_read_assigned_songs" on public.songs
  for select using (library_id = public.my_library_id());

-- Policies on client_library_assignments
drop policy if exists "portal_admin_all_assignments" on public.client_library_assignments;
create policy "portal_admin_all_assignments" on public.client_library_assignments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "client_read_own_assignment" on public.client_library_assignments;
create policy "client_read_own_assignment" on public.client_library_assignments
  for select using (client_id = auth.uid());

-- Policies on client_song_selections
drop policy if exists "portal_admin_all_selections" on public.client_song_selections;
create policy "portal_admin_all_selections" on public.client_song_selections
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "client_read_own_selections" on public.client_song_selections;
create policy "client_read_own_selections" on public.client_song_selections
  for select using (client_id = auth.uid());

drop policy if exists "client_write_own_selections" on public.client_song_selections;
create policy "client_write_own_selections" on public.client_song_selections
  for insert with check (client_id = auth.uid());

drop policy if exists "client_delete_own_selections" on public.client_song_selections;
create policy "client_delete_own_selections" on public.client_song_selections
  for delete using (client_id = auth.uid());

-- Storage bucket 'songs-audio'
insert into storage.buckets (id, name, public)
values ('songs-audio', 'songs-audio', false)
on conflict (id) do update set public = false;

drop policy if exists "admin_audio_all" on storage.objects;
create policy "admin_audio_all" on storage.objects
  for all using (bucket_id = 'songs-audio' and public.is_admin())
  with check (bucket_id = 'songs-audio' and public.is_admin());

drop policy if exists "client_audio_read" on storage.objects;
create policy "client_audio_read" on storage.objects
  for select using (bucket_id = 'songs-audio' and auth.role() = 'authenticated');

-- Seed portal_admins from existing studio admins and owner accounts
insert into public.portal_admins (user_id)
select u.id from auth.users u
where u.email in ('saniyakausar089@gmail.com', 'admin@tabridals.com', 'admin@123.com')
   or exists (
     select 1 from public.user_roles r
     where r.user_id = u.id and r.role = 'admin'
   )
on conflict (user_id) do nothing;

-- Update handle_new_user trigger to handle client signups
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = 'public'
as $$
declare
  is_owner boolean;
  user_display_name text;
  signup_type text;
begin
  is_owner := (lower(coalesce(new.email, '')) = 'saniyakausar089@gmail.com');
  signup_type := coalesce(new.raw_user_meta_data->>'signup_type', '');

  if signup_type = 'client' then
    insert into public.client_profiles (id, email, full_name, partner_name, wedding_date, approval_status)
    values (
      new.id,
      lower(coalesce(new.email, '')),
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'partner_name', ''),
      case 
        when (new.raw_user_meta_data->>'wedding_date') ~ '^\d{4}-\d{2}-\d{2}$' 
        then (new.raw_user_meta_data->>'wedding_date')::date 
        else null 
      end,
      'pending'
    )
    on conflict (id) do nothing;
    return new;
  end if;

  user_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (user_id, display_name, email, approval_status)
  values (
    new.id,
    user_display_name,
    lower(coalesce(new.email, '')),
    case when is_owner then 'approved' else 'pending' end
  )
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = case when profiles.display_name = '' then excluded.display_name else profiles.display_name end;

  if is_owner then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  
  return new;
end;
$$;

