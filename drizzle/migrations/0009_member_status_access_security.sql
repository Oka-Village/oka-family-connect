ALTER TABLE public.profiles ADD COLUMN member_status text NOT NULL DEFAULT 'full';
UPDATE public.profiles SET member_status = 'full';
ALTER TABLE public.profiles ALTER COLUMN member_status SET DEFAULT 'limited';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_member_status_valid CHECK (member_status IN ('full', 'limited'));

-- SECURITY DEFINER: read only the caller's status without recursive profiles RLS.
CREATE OR REPLACE FUNCTION public.is_full_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
      AND (member_status = 'full' OR (member_status = 'limited' AND (now() AT TIME ZONE 'UTC')::date >= DATE '2026-12-01'))
  );
$$;
REVOKE ALL ON FUNCTION public.is_full_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_full_member() TO authenticated, service_role;

-- Membership status is not an editable profile field. Preserve all other writes.
CREATE OR REPLACE FUNCTION public.profiles_member_status_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.member_status <> 'limited' THEN RAISE EXCEPTION 'New membership status must be limited'; END IF;
    ELSIF NEW.member_status IS DISTINCT FROM OLD.member_status THEN
      RAISE EXCEPTION 'Only admins can change membership status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_member_status_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_member_status_guard();

ALTER POLICY profiles_select_authenticated ON public.profiles USING (id = auth.uid() OR public.is_full_member() OR public.is_staff(auth.uid()));
ALTER POLICY "Signed-in members read themes" ON public.themes USING (public.is_full_member() OR public.is_staff(auth.uid()));

-- SECURITY DEFINER: resolve only references to shared images, never list arbitrary objects.
CREATE OR REPLACE FUNCTION public.can_read_member_image(_name text, _owner text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.is_full_member() OR public.is_staff(auth.uid())) AND _owner IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id::text = _owner AND p.photo_url = _name
    UNION ALL
    SELECT 1 FROM public.houses h WHERE h.status = 'published' AND _name = ANY(h.photos) AND split_part(_name, '/', 1) = _owner
    UNION ALL
    SELECT 1 FROM public.skills s WHERE s.status = 'published' AND s.photo_url = _name AND split_part(_name, '/', 1) = _owner
    UNION ALL
    SELECT 1 FROM public.events e WHERE e.status IN ('published', 'cancelled') AND e.photo_url = _name AND split_part(_name, '/', 1) = _owner
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_member_image(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_member_image(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_theme_image(_name text, _owner text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.is_full_member() OR public.is_staff(auth.uid())) AND _owner IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.themes t WHERE t.image_path = _name);
$$;
REVOKE ALL ON FUNCTION public.can_read_theme_image(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_theme_image(text, text) TO authenticated, service_role;

ALTER POLICY avatars_read_authenticated ON storage.objects USING (
  bucket_id = 'avatars' AND (owner_id = auth.uid()::text OR public.can_read_member_image(name, owner_id))
);
ALTER POLICY "Signed-in members read theme images" ON storage.objects USING (
  bucket_id = 'theme-images' AND (owner_id = auth.uid()::text OR public.can_read_theme_image(name, owner_id))
);