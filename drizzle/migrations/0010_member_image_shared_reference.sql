-- SECURITY DEFINER: authorize only an image referenced by shared content whose path matches its uploader.
-- Admin profile edits may reuse an admin-owned photo without reassigning file ownership.
CREATE OR REPLACE FUNCTION public.can_read_member_image(_name text, _owner text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.is_full_member() OR public.is_staff(auth.uid())) AND _owner IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.photo_url = _name AND split_part(_name, '/', 1) = _owner
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