CREATE OR REPLACE FUNCTION public.public_event_catalog()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description,
    'event_type', e.event_type, 'format', e.format,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'capacity', e.capacity, 'going_count', e.going_count, 'waitlist_count', e.waitlist_count,
    'status', e.status, 'host_id', e.host_id, 'created_by', NULL,
    'created_at', e.created_at, 'join_slug', e.join_slug,
    'photo_url', e.photo_url, 'video_url', e.video_url,
    'host', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'photo_url', p.photo_url) END
  ) ORDER BY e.starts_at), '[]'::jsonb)
  FROM public.events e LEFT JOIN public.profiles p ON p.id = e.host_id
  WHERE e.status = 'published';
$$;
REVOKE ALL ON FUNCTION public.public_event_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_catalog() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_public_event_image(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e LEFT JOIN public.profiles p ON p.id = e.host_id
    WHERE e.status = 'published' AND (e.photo_url = _name OR p.photo_url = _name)
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_public_event_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_public_event_image(text) TO anon, authenticated, service_role;
CREATE POLICY public_event_images_read ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'avatars' AND public.can_read_public_event_image(name));