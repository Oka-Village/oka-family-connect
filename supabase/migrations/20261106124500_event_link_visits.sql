-- A join link must be remembered even when paid_member_content_read hides the event.
-- The visit unlocks that one event for the recipient. It does not open the schedule
-- or event locations (the meeting link stays payment-gated).

CREATE TABLE public.event_link_visits (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

REVOKE ALL ON public.event_link_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_link_visits TO authenticated;
GRANT ALL ON public.event_link_visits TO service_role;

ALTER TABLE public.event_link_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_link_visits_select_own ON public.event_link_visits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- SECURITY DEFINER: the caller may not be able to SELECT the event yet.
-- Hosts and creators already can, so they do not get a visit row.
CREATE OR REPLACE FUNCTION public.remember_event_invite(_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.events%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _slug IS NULL OR btrim(_slug) = '' THEN RETURN NULL; END IF;

  SELECT * INTO ev FROM public.events WHERE join_slug = btrim(_slug);
  IF NOT FOUND OR ev.status <> 'published' OR ev.format <> 'virtual' THEN
    RETURN NULL;
  END IF;
  IF coalesce(ev.ends_at, ev.starts_at) < now() THEN
    RETURN NULL;
  END IF;

  IF ev.host_id IS DISTINCT FROM uid AND ev.created_by IS DISTINCT FROM uid THEN
    INSERT INTO public.event_link_visits (user_id, event_id)
    VALUES (uid, ev.id)
    ON CONFLICT (user_id, event_id) DO NOTHING;
  END IF;

  RETURN ev.id;
END;
$$;

REVOKE ALL ON FUNCTION public.remember_event_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remember_event_invite(text) TO authenticated, service_role;

DROP POLICY IF EXISTS paid_member_content_read ON public.events;
CREATE POLICY paid_member_content_read ON public.events
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR created_by = auth.uid()
    OR host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.event_link_visits v
      WHERE v.event_id = events.id AND v.user_id = auth.uid()
    )
  );
