-- Event notifications: in-app rows, preferences, delivery log, and reconfirmation
-- that keeps the original RSVP timestamp and the held seat.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Members may stamp read_at. Service-role inserts are not updates, so they skip this.
CREATE OR REPLACE FUNCTION public.notifications_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.user_id := OLD.user_id;
  NEW.type := OLD.type;
  NEW.title := OLD.title;
  NEW.body := OLD.body;
  NEW.link := OLD.link;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_guard BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_guard();

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
REVOKE ALL ON FUNCTION public.notifications_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notifications_guard() TO authenticated;

CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_own ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  channel text NOT NULL CHECK (channel IN ('email', 'in_app', 'slack')),
  recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_address text,
  recipient_key text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  schedule_key text NOT NULL,
  timezone text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled', 'not_configured')),
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, channel, recipient_key, event_id, schedule_key)
);

CREATE INDEX notification_deliveries_status_idx ON public.notification_deliveries (status, template_key);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_deliveries_staff_select ON public.notification_deliveries
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check;
ALTER TABLE public.event_rsvps ADD CONSTRAINT event_rsvps_status_check
  CHECK (status IN ('going', 'waitlist', 'cancelled', 'awaiting_reconfirmation'));

ALTER TABLE public.event_rsvps ADD COLUMN status_changed_at timestamptz;
UPDATE public.event_rsvps SET status_changed_at = created_at WHERE status_changed_at IS NULL;
ALTER TABLE public.event_rsvps ALTER COLUMN status_changed_at SET DEFAULT now();
ALTER TABLE public.event_rsvps ALTER COLUMN status_changed_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_event_rsvps_awaiting_reconfirmation(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_rsvps
  SET status = 'awaiting_reconfirmation', status_changed_at = now()
  WHERE event_id = _event_id AND status = 'going';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_event_rsvps_awaiting_reconfirmation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_event_rsvps_awaiting_reconfirmation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.promote_waitlist(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    UPDATE public.event_rsvps SET status = 'going', status_changed_at = now() WHERE id = next_id;
    UPDATE public.events SET going_count = going_count + 1, waitlist_count = waitlist_count - 1
      WHERE id = _event_id;
  END LOOP;
  PERFORM set_config('oka.rsvp_internal','off',true);
END;
$$;
REVOKE ALL ON FUNCTION public.promote_waitlist(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ev public.events%ROWTYPE; cur text; new_status text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR ev.status <> 'published' THEN RAISE EXCEPTION 'This event is not open for RSVPs'; END IF;
  IF coalesce(ev.ends_at, ev.starts_at) < now() THEN RAISE EXCEPTION 'This event has already happened'; END IF;

  SELECT status INTO cur FROM public.event_rsvps WHERE event_id = _event_id AND user_id = uid FOR UPDATE;
  IF cur IN ('going','waitlist') THEN RETURN cur; END IF;
  -- The seat is already counted. Keep created_at so a late-joiner rule still sees the original RSVP.
  IF cur = 'awaiting_reconfirmation' THEN
    UPDATE public.event_rsvps
    SET status = 'going', status_changed_at = now()
    WHERE event_id = _event_id AND user_id = uid;
    RETURN 'going';
  END IF;

  new_status := CASE WHEN ev.capacity IS NULL OR ev.going_count < ev.capacity THEN 'going' ELSE 'waitlist' END;
  INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES (_event_id, uid, new_status)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = EXCLUDED.status, created_at = now(), status_changed_at = now();

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
DECLARE uid uuid := auth.uid(); cur text; held boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM 1 FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  SELECT status INTO cur FROM public.event_rsvps WHERE event_id = _event_id AND user_id = uid FOR UPDATE;
  IF cur IS NULL OR cur = 'cancelled' THEN RETURN 'cancelled'; END IF;

  held := cur IN ('going', 'awaiting_reconfirmation');
  UPDATE public.event_rsvps
  SET status = 'cancelled', status_changed_at = now()
  WHERE event_id = _event_id AND user_id = uid;
  PERFORM set_config('oka.rsvp_internal','on',true);
  UPDATE public.events SET
    going_count = going_count - held::int,
    waitlist_count = waitlist_count - (cur = 'waitlist')::int
  WHERE id = _event_id;
  IF held THEN PERFORM public.promote_waitlist(_event_id); END IF;
  PERFORM set_config('oka.rsvp_internal','off',true);
  RETURN 'cancelled';
END;
$$;

REVOKE ALL ON FUNCTION public.rsvp_event(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_rsvp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_rsvp(uuid) TO authenticated, service_role;
