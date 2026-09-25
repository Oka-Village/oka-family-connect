-- 1. Roles: add moderator (existing values kept for later phases)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin','moderator','facilitator','affiliate','member'));

-- Staff = admin or moderator. SECURITY DEFINER for the same reason as has_role: read user_roles without RLS recursion.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','moderator'));
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- 2. Moderators manage events
CREATE POLICY events_moderator_all ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'moderator'));
CREATE POLICY event_locations_moderator_all ON public.event_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'moderator'));

CREATE OR REPLACE FUNCTION public.events_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_admin boolean := auth.uid() IS NOT NULL AND public.is_staff(auth.uid());
  internal boolean := coalesce(current_setting('oka.rsvp_internal', true),'') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.going_count := 0; NEW.waitlist_count := 0;
    IF auth.uid() IS NOT NULL AND NOT is_admin THEN
      NEW.status := 'pending_approval';
      NEW.host_id := NEW.created_by;
    END IF;
    NEW.host_id := coalesce(NEW.host_id, NEW.created_by);
    RETURN NEW;
  END IF;
  IF internal OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.going_count := OLD.going_count;
  NEW.waitlist_count := OLD.waitlist_count;
  IF NOT is_admin THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only admins and moderators can change an event''s status';
    END IF;
    NEW.host_id := OLD.host_id;
    NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.capacity IS NOT NULL AND NEW.capacity < OLD.going_count THEN
    RAISE EXCEPTION 'Capacity cannot be lower than the % people already going', OLD.going_count;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Houses publish directly; archived = moderated takedown
ALTER TABLE public.houses DROP CONSTRAINT IF EXISTS houses_status_check;
ALTER TABLE public.houses ADD CONSTRAINT houses_status_check
  CHECK (status IN ('draft','pending_approval','published','rejected','archived'));
ALTER TABLE public.houses ALTER COLUMN status SET DEFAULT 'published';

CREATE POLICY houses_moderator_update ON public.houses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'moderator'));
CREATE POLICY houses_moderator_select ON public.houses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'moderator'));
CREATE POLICY skills_moderator_update ON public.skills FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'moderator'));
CREATE POLICY skills_moderator_select ON public.skills FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'moderator'));

-- Owners can't reverse a moderation takedown.
CREATE OR REPLACE FUNCTION public.listing_moderation_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid())
     AND OLD.status = 'archived' AND NEW.status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION 'This listing was unlisted by a moderator';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER houses_moderation_guard BEFORE UPDATE ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.listing_moderation_guard();
CREATE TRIGGER skills_moderation_guard BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.listing_moderation_guard();

-- 4. Seed Daniel as first admin (new sign-ups)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- SECURITY DEFINER: runs on auth.users insert and must write profiles/user_roles regardless of RLS.
BEGIN
  INSERT INTO public.profiles (id, display_name, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Founding admin. Every other admin/moderator is granted from the admin panel.
  IF lower(NEW.email) = 'daniel@zoe.garden' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 5. One-time: existing account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'daniel@zoe.garden'
ON CONFLICT (user_id, role) DO NOTHING;