ALTER TABLE public.events DROP CONSTRAINT events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft','pending_approval','published','rejected','cancelled','completed'));
ALTER TABLE public.events
  ADD COLUMN going_count integer NOT NULL DEFAULT 0 CHECK (going_count >= 0),
  ADD COLUMN waitlist_count integer NOT NULL DEFAULT 0 CHECK (waitlist_count >= 0);

CREATE TABLE public.event_locations (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  venue_address text,
  video_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_locations TO authenticated;
GRANT ALL ON public.event_locations TO service_role;
ALTER TABLE public.event_locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER event_locations_set_updated_at BEFORE UPDATE ON public.event_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.event_locations (event_id, venue_address, video_link)
  SELECT id, venue_address, video_link FROM public.events
  WHERE venue_address IS NOT NULL OR video_link IS NOT NULL;
ALTER TABLE public.events DROP COLUMN venue_address, DROP COLUMN video_link;

CREATE OR REPLACE FUNCTION public.is_event_manager(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- SECURITY DEFINER: read events without re-entering its RLS (avoids policy recursion).
  SELECT EXISTS (SELECT 1 FROM public.events
    WHERE id = _event_id AND (host_id = auth.uid() OR created_by = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.has_event_rsvp(_event_id uuid, _going_only boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- SECURITY DEFINER: read event_rsvps without re-entering its RLS (avoids policy recursion).
  SELECT EXISTS (SELECT 1 FROM public.event_rsvps
    WHERE event_id = _event_id AND user_id = auth.uid()
      AND (CASE WHEN _going_only THEN status = 'going' ELSE status <> 'cancelled' END));
$$;
REVOKE ALL ON FUNCTION public.is_event_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_event_rsvp(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_event_rsvp(uuid, boolean) TO authenticated, service_role;

CREATE POLICY event_locations_select ON public.event_locations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_event_manager(event_id)
         OR public.has_event_rsvp(event_id, true));
CREATE POLICY event_locations_write ON public.event_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_event_manager(event_id))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_event_manager(event_id));

CREATE POLICY events_select_rsvpd ON public.events FOR SELECT TO authenticated
  USING (public.has_event_rsvp(id, false));

DROP POLICY event_rsvps_select_host ON public.event_rsvps;
CREATE POLICY event_rsvps_select_host ON public.event_rsvps FOR SELECT TO authenticated
  USING (public.is_event_manager(event_id));
DROP POLICY event_rsvps_insert_own ON public.event_rsvps;
DROP POLICY event_rsvps_update_own ON public.event_rsvps;
DROP POLICY event_rsvps_delete_own ON public.event_rsvps;

CREATE INDEX idx_event_rsvps_waitlist ON public.event_rsvps (event_id, status, created_at);
CREATE INDEX idx_events_starts_at ON public.events (starts_at);

CREATE OR REPLACE FUNCTION public.events_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_admin boolean := auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin');
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
      RAISE EXCEPTION 'Only admins can change an event''s status';
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
CREATE TRIGGER events_guard BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_guard();

CREATE OR REPLACE FUNCTION public.promote_waitlist(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- SECURITY DEFINER: moves other members' RSVP rows, which RLS forbids to callers. Not granted to clients.
DECLARE ev public.events%ROWTYPE; next_id uuid;
BEGIN
  PERFORM set_config('oka.rsvp_internal','on',true);
  LOOP
    SELECT * INTO ev FROM public.events WHERE id = _event_id;
    EXIT WHEN ev.status <> 'published' OR (ev.capacity IS NOT NULL AND ev.going_count >= ev.capacity);
    SELECT id INTO next_id FROM public.event_rsvps
      WHERE event_id = _event_id AND status = 'waitlist'
      ORDER BY created_at, id LIMIT 1 FOR UPDATE;
    EXIT WHEN next_id IS NULL;
    UPDATE public.event_rsvps SET status = 'going' WHERE id = next_id;
    UPDATE public.events SET going_count = going_count + 1, waitlist_count = waitlist_count - 1
      WHERE id = _event_id;
  END LOOP;
  PERFORM set_config('oka.rsvp_internal','off',true);
END;
$$;
REVOKE ALL ON FUNCTION public.promote_waitlist(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- SECURITY DEFINER: updates the event's counters under a row lock; members cannot write those directly.
DECLARE uid uuid := auth.uid(); ev public.events%ROWTYPE; cur text; new_status text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR ev.status <> 'published' THEN RAISE EXCEPTION 'This event is not open for RSVPs'; END IF;
  IF coalesce(ev.ends_at, ev.starts_at) < now() THEN RAISE EXCEPTION 'This event has already happened'; END IF;

  SELECT status INTO cur FROM public.event_rsvps WHERE event_id = _event_id AND user_id = uid FOR UPDATE;
  IF cur IN ('going','waitlist') THEN RETURN cur; END IF;

  new_status := CASE WHEN ev.capacity IS NULL OR ev.going_count < ev.capacity THEN 'going' ELSE 'waitlist' END;
  INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES (_event_id, uid, new_status)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, created_at = now();

  PERFORM set_config('oka.rsvp_internal','on',true);
  UPDATE public.events SET
    going_count = going_count + (new_status = 'going')::int,
    waitlist_count = waitlist_count + (new_status = 'waitlist')::int
  WHERE id = _event_id;
  PERFORM set_config('oka.rsvp_internal','off',true);
  RETURN new_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_rsvp(_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- SECURITY DEFINER: releases a spot and promotes another member's RSVP atomically.
DECLARE uid uuid := auth.uid(); cur text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM 1 FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  SELECT status INTO cur FROM public.event_rsvps WHERE event_id = _event_id AND user_id = uid FOR UPDATE;
  IF cur IS NULL OR cur = 'cancelled' THEN RETURN 'cancelled'; END IF;

  UPDATE public.event_rsvps SET status = 'cancelled' WHERE event_id = _event_id AND user_id = uid;
  PERFORM set_config('oka.rsvp_internal','on',true);
  UPDATE public.events SET
    going_count = going_count - (cur = 'going')::int,
    waitlist_count = waitlist_count - (cur = 'waitlist')::int
  WHERE id = _event_id;
  IF cur = 'going' THEN PERFORM public.promote_waitlist(_event_id); END IF;
  PERFORM set_config('oka.rsvp_internal','off',true);
  RETURN 'cancelled';
END;
$$;
REVOKE ALL ON FUNCTION public.rsvp_event(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_rsvp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_rsvp(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.events_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- SECURITY DEFINER: calls promote_waitlist, which clients cannot execute directly.
BEGIN
  IF NEW.status = 'published' AND NEW.waitlist_count > 0
     AND (NEW.capacity IS DISTINCT FROM OLD.capacity OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.promote_waitlist(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER events_after_update AFTER UPDATE OF capacity, status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_after_update();
REVOKE ALL ON FUNCTION public.events_after_update() FROM PUBLIC, anon, authenticated;