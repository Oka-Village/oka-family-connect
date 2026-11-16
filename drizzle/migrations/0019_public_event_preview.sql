CREATE OR REPLACE FUNCTION public.public_event_preview(_slug text)
RETURNS TABLE(id uuid, title text, description text, event_type text, format text, starts_at timestamptz, ends_at timestamptz, timezone text, capacity integer, going_count integer, host_name text, is_live boolean, live_link text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, e.description, e.event_type, e.format, e.starts_at, e.ends_at, e.timezone, e.capacity, e.going_count,
    p.display_name,
    (now() BETWEEN e.starts_at - interval '15 minutes' AND coalesce(e.ends_at, e.starts_at + interval '2 hours')) AS is_live,
    CASE WHEN e.format = 'virtual' AND now() BETWEEN e.starts_at - interval '15 minutes' AND coalesce(e.ends_at, e.starts_at + interval '2 hours')
      THEN coalesce(l.meeting_link, l.video_link) END
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.host_id
  LEFT JOIN public.event_locations l ON l.event_id = e.id
  WHERE e.join_slug = _slug AND e.status = 'published'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_event_preview(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_event_preview(text) TO anon, authenticated;