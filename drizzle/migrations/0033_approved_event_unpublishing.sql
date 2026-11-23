ALTER TABLE public.events ADD COLUMN IF NOT EXISTS unpublished_schedule jsonb;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check CHECK (status IN ('draft','pending_approval','published','unpublished','rejected','cancelled','completed'));
CREATE POLICY events_unpublished_manager_read ON public.events AS RESTRICTIVE FOR SELECT TO authenticated USING (status <> 'unpublished' OR created_by = auth.uid() OR host_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.events_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
  is_admin boolean := auth.uid() IS NOT NULL AND public.is_staff(auth.uid());
  internal boolean := coalesce(current_setting('oka.rsvp_internal', true),'') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.going_count := 0; NEW.waitlist_count := 0;
    NEW.unpublished_schedule := NULL;
    IF auth.uid() IS NOT NULL AND NOT is_admin THEN
      NEW.status := 'pending_approval'; NEW.host_id := NEW.created_by;
    END IF;
    IF NEW.status = 'unpublished' THEN RAISE EXCEPTION 'Only previously published events can be unpublished'; END IF;
    NEW.host_id := coalesce(NEW.host_id, NEW.created_by);
    RETURN NEW;
  END IF;
  IF internal OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.going_count := OLD.going_count; NEW.waitlist_count := OLD.waitlist_count;
  NEW.unpublished_schedule := OLD.unpublished_schedule;
  IF NEW.status = 'unpublished' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT is_admin OR OLD.status <> 'published' THEN RAISE EXCEPTION 'Only staff can unpublish a published event'; END IF;
    NEW.unpublished_schedule := jsonb_build_object('starts_at', OLD.starts_at, 'ends_at', OLD.ends_at, 'timezone', coalesce(OLD.timezone,'UTC'));
  END IF;
  IF NOT is_admin THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'unpublished' AND NEW.status = 'published' AND (OLD.created_by = auth.uid() OR OLD.host_id = auth.uid())) THEN
      RAISE EXCEPTION 'Only admins and moderators can change an event''s status';
    END IF;
    NEW.host_id := OLD.host_id; NEW.created_by := OLD.created_by;
  END IF;
  IF OLD.status = 'unpublished' AND NEW.status = 'published' THEN NEW.unpublished_schedule := NULL; END IF;
  IF NEW.capacity IS NOT NULL AND NEW.capacity < OLD.going_count THEN
    RAISE EXCEPTION 'Capacity cannot be lower than the % people already going', OLD.going_count;
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON COLUMN public.events.unpublished_schedule IS 'Guard-managed previous published schedule; used for RSVP reconfirmation when an approved event is republished.';