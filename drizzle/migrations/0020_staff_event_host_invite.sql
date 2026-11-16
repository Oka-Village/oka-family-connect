CREATE OR REPLACE FUNCTION public.ensure_event_host_invite(_event_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE host_uid uuid; code text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT host_id INTO host_uid FROM public.events WHERE id = _event_id AND status = 'published';
  IF host_uid IS NULL THEN RAISE EXCEPTION 'Published event host not found'; END IF;
  INSERT INTO public.affiliates (user_id, display_name)
  SELECT id, display_name FROM public.profiles WHERE id = host_uid
  ON CONFLICT (user_id) DO NOTHING;
  SELECT invite_code INTO code FROM public.affiliates WHERE user_id = host_uid AND status = 'active';
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_event_host_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_event_host_invite(uuid) TO authenticated;