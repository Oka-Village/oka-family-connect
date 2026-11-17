ALTER TABLE public.events ADD COLUMN IF NOT EXISTS video_url text;
UPDATE public.events e SET video_url = l.video_link FROM public.event_locations l WHERE l.event_id = e.id AND e.video_url IS NULL AND l.video_link ~* '^https?://(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/';
COMMENT ON COLUMN public.events.video_url IS 'Public YouTube teaser or recording, independent of RSVP and meeting access.';
COMMENT ON COLUMN public.event_locations.video_link IS 'DEPRECATED: YouTube videos use events.video_url; legacy non-YouTube links remain private meeting fallbacks.';
CREATE FUNCTION public.public_event_preview_v2(_slug text)
RETURNS TABLE(id uuid, title text, description text, event_type text, format text, starts_at timestamptz, ends_at timestamptz, timezone text, capacity integer, going_count integer, host_name text, is_live boolean, live_link text, video_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT e.id, e.title, e.description, e.event_type, e.format, e.starts_at, e.ends_at, e.timezone, e.capacity, e.going_count, p.display_name,
 (now() BETWEEN e.starts_at - interval '15 minutes' AND coalesce(e.ends_at, e.starts_at + interval '2 hours')),
 CASE WHEN e.format = 'virtual' AND now() BETWEEN e.starts_at - interval '15 minutes' AND coalesce(e.ends_at, e.starts_at + interval '2 hours') THEN coalesce(l.meeting_link, CASE WHEN l.video_link !~* '^https?://(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/' THEN l.video_link END) END,
 e.video_url
 FROM public.events e LEFT JOIN public.profiles p ON p.id = e.host_id LEFT JOIN public.event_locations l ON l.event_id = e.id
 WHERE e.join_slug = _slug AND e.status = 'published' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_event_preview_v2(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_event_preview_v2(text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.public_event_preview(_slug text)
RETURNS TABLE(id uuid, title text, description text, event_type text, format text, starts_at timestamptz, ends_at timestamptz, timezone text, capacity integer, going_count integer, host_name text, is_live boolean, live_link text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT v.id, v.title, v.description, v.event_type, v.format, v.starts_at, v.ends_at, v.timezone, v.capacity, v.going_count, v.host_name, v.is_live, v.live_link FROM public.public_event_preview_v2(_slug) v $$;
REVOKE ALL ON FUNCTION public.public_event_preview(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_event_preview(text) TO anon, authenticated;