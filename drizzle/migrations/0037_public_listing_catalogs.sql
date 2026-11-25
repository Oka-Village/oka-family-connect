CREATE OR REPLACE FUNCTION public.public_skills_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'owner_id', s.owner_id, 'title', s.title, 'category', s.category, 'format', s.format,
    'duration_minutes', s.duration_minutes, 'description', s.description, 'status', s.status,
    'photo_url', s.photo_url, 'created_at', s.created_at,
    'owner', jsonb_build_object('id', p.id, 'display_name', p.display_name, 'photo_url', p.photo_url)
  ) ORDER BY s.created_at DESC, s.id DESC), '[]'::jsonb)
  FROM public.skills s LEFT JOIN public.profiles p ON p.id = s.owner_id
  WHERE s.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.public_houses_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'owner_id', h.owner_id, 'title', h.title, 'description', h.description,
    'property_type', h.property_type, 'location_text', h.location_text, 'photos', h.photos,
    'house_rules', h.house_rules, 'status', h.status, 'created_at', h.created_at,
    'owner', jsonb_build_object('id', p.id, 'display_name', p.display_name, 'photo_url', p.photo_url)
  ) ORDER BY h.created_at DESC, h.id DESC), '[]'::jsonb)
  FROM public.houses h LEFT JOIN public.profiles p ON p.id = h.owner_id
  WHERE h.status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.public_skills_catalog() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_houses_catalog() TO anon, authenticated, service_role;