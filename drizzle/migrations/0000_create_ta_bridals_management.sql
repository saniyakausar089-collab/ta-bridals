CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 100),
  role text NOT NULL CHECK (role IN ('Photographer', 'Videographer', 'Photo Editor', 'Video Editor', 'Album Designer', 'Cinematographer / Creative Director', 'Drone Operator', 'Assistant Photographer', 'Assistant Videographer', 'Lighting Assistant', 'Data Manager / Footage Backup Assistant')),
  email text CHECK (email IS NULL OR length(email) <= 255),
  phone text CHECK (phone IS NULL OR length(phone) <= 32),
  available boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage team members" ON public.team_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.shoots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_name text NOT NULL CHECK (length(trim(couple_name)) BETWEEN 1 AND 120),
  event_type text NOT NULL CHECK (event_type IN ('Wedding', 'Reception', 'Engagement', 'Pre-wedding', 'Other')),
  event_date date NOT NULL,
  location text NOT NULL CHECK (length(trim(location)) BETWEEN 1 AND 160),
  venue text CHECK (venue IS NULL OR length(venue) <= 160),
  start_time time NOT NULL,
  end_time time,
  planned_team_size integer NOT NULL DEFAULT 7 CHECK (planned_team_size BETWEEN 7 AND 20),
  status text NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'In Progress', 'Completed', 'Cancelled')),
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoots TO authenticated;
GRANT ALL ON public.shoots TO service_role;
ALTER TABLE public.shoots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage shoots" ON public.shoots FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.shoot_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id uuid NOT NULL REFERENCES public.shoots(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'on_site' CHECK (assignment_type IN ('on_site', 'post_production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shoot_id, team_member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoot_assignments TO authenticated;
GRANT ALL ON public.shoot_assignments TO service_role;
ALTER TABLE public.shoot_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage shoot assignments" ON public.shoot_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX shoots_event_date_idx ON public.shoots (event_date);
CREATE INDEX shoot_assignments_shoot_id_idx ON public.shoot_assignments (shoot_id);
CREATE INDEX shoot_assignments_team_member_id_idx ON public.shoot_assignments (team_member_id);

CREATE OR REPLACE FUNCTION public.enforce_shoot_assignment_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_count integer;
BEGIN
  PERFORM 1 FROM public.shoots WHERE id = NEW.shoot_id FOR UPDATE;
  SELECT count(*) INTO assignment_count
  FROM public.shoot_assignments
  WHERE shoot_id = NEW.shoot_id AND id <> NEW.id;
  IF assignment_count >= 20 THEN
    RAISE EXCEPTION 'An event cannot have more than 20 team assignments.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_shoot_assignment_limit() FROM PUBLIC;
CREATE TRIGGER enforce_shoot_assignment_limit
BEFORE INSERT OR UPDATE OF shoot_id, team_member_id ON public.shoot_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_shoot_assignment_limit();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;

  IF lower(COALESCE(NEW.email, '')) = 'saniyakausar089@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();