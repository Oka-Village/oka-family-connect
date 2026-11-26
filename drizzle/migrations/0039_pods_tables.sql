CREATE TABLE IF NOT EXISTS public.pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  photo_url text,
  format text NOT NULL DEFAULT 'online' CHECK (format IN ('online', 'in_person', 'hybrid')),
  timezone text NOT NULL DEFAULT 'UTC',
  meet_url text,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('draft', 'pending_approval', 'published', 'unpublished')),
  capacity_members int NOT NULL DEFAULT 3 CHECK (capacity_members > 0 AND capacity_members <= 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pods_status_idx ON public.pods (status);
CREATE INDEX IF NOT EXISTS pods_host_idx ON public.pods (host_id);

GRANT SELECT ON public.pods TO authenticated;
GRANT ALL ON public.pods TO service_role;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pods_select_published ON public.pods;
CREATE POLICY pods_select_published ON public.pods
  FOR SELECT TO authenticated
  USING (status = 'published' OR host_id = auth.uid() OR created_by = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS pods_insert_creator ON public.pods;
CREATE POLICY pods_insert_creator ON public.pods
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND host_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'facilitator')));

DROP POLICY IF EXISTS pods_update_manager ON public.pods;
CREATE POLICY pods_update_manager ON public.pods
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR created_by = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (host_id = auth.uid() OR created_by = auth.uid() OR public.is_staff(auth.uid()));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pod_id uuid REFERENCES public.pods(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_index smallint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_session_index_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_session_index_check
      CHECK (session_index IS NULL OR session_index BETWEEN 1 AND 3);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS events_pod_session_uidx ON public.events (pod_id, session_index) WHERE pod_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_pod_id_idx ON public.events (pod_id) WHERE pod_id IS NOT NULL;

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
  WHERE e.status = 'published' AND e.pod_id IS NULL;
$$;

CREATE TABLE IF NOT EXISTS public.pod_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'paid', 'cancelled', 'expired', 'needs_refund')),
  held_until timestamptz,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  commitments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pod_id, user_id)
);

CREATE INDEX IF NOT EXISTS pod_enrollments_pod_status_idx ON public.pod_enrollments (pod_id, status);

GRANT SELECT ON public.pod_enrollments TO authenticated;
GRANT ALL ON public.pod_enrollments TO service_role;
ALTER TABLE public.pod_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pod_enrollments_select_own ON public.pod_enrollments;
CREATE POLICY pod_enrollments_select_own ON public.pod_enrollments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.pods p WHERE p.id = pod_enrollments.pod_id AND (p.host_id = auth.uid() OR p.created_by = auth.uid())));

CREATE OR REPLACE FUNCTION public.hold_pod_enrollment(_pod_id uuid, _commitments jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pod public.pods%ROWTYPE;
  paid_count int;
  held_count int;
  enrollment_id uuid;
  until_at timestamptz := now() + interval '15 minutes';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO pod FROM public.pods WHERE id = _pod_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pod not found'; END IF;
  IF pod.status <> 'published' THEN RAISE EXCEPTION 'Pod is not open for joining'; END IF;
  IF pod.host_id = uid THEN RAISE EXCEPTION 'Facilitators do not enroll as members'; END IF;

  SELECT count(*)::int INTO paid_count FROM public.pod_enrollments WHERE pod_id = _pod_id AND status = 'paid';
  IF paid_count >= pod.capacity_members THEN RAISE EXCEPTION 'This pod is full'; END IF;

  UPDATE public.pod_enrollments SET status = 'expired', updated_at = now()
  WHERE pod_id = _pod_id AND status = 'held' AND held_until IS NOT NULL AND held_until < now();

  SELECT count(*)::int INTO held_count FROM public.pod_enrollments
  WHERE pod_id = _pod_id AND status = 'held' AND (held_until IS NULL OR held_until >= now());

  IF NOT EXISTS (SELECT 1 FROM public.pod_enrollments WHERE pod_id = _pod_id AND user_id = uid AND status IN ('held', 'paid'))
     AND paid_count + held_count >= pod.capacity_members THEN
    RAISE EXCEPTION 'No seats available right now';
  END IF;

  INSERT INTO public.pod_enrollments (pod_id, user_id, status, held_until, commitments)
  VALUES (_pod_id, uid, 'held', until_at, coalesce(_commitments, '[]'::jsonb))
  ON CONFLICT (pod_id, user_id) DO UPDATE
    SET status = CASE WHEN pod_enrollments.status = 'paid' THEN 'paid' ELSE 'held' END,
        held_until = CASE WHEN pod_enrollments.status = 'paid' THEN pod_enrollments.held_until ELSE until_at END,
        commitments = coalesce(_commitments, pod_enrollments.commitments),
        updated_at = now()
  RETURNING id INTO enrollment_id;

  IF (SELECT status FROM public.pod_enrollments WHERE id = enrollment_id) = 'paid' THEN
    RETURN jsonb_build_object('id', enrollment_id, 'status', 'paid', 'already_paid', true);
  END IF;
  RETURN jsonb_build_object('id', enrollment_id, 'status', 'held', 'held_until', until_at, 'already_paid', false);
END;
$$;

REVOKE ALL ON FUNCTION public.hold_pod_enrollment(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hold_pod_enrollment(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_pod_enrollment(_enrollment_id uuid, _payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  enr public.pod_enrollments%ROWTYPE;
  pod public.pods%ROWTYPE;
  paid_count int;
  ev record;
  spots int;
BEGIN
  SELECT * INTO enr FROM public.pod_enrollments WHERE id = _enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  IF enr.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'pod_id', enr.pod_id, 'user_id', enr.user_id);
  END IF;

  SELECT * INTO pod FROM public.pods WHERE id = enr.pod_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pod not found'; END IF;

  SELECT count(*)::int INTO paid_count FROM public.pod_enrollments WHERE pod_id = enr.pod_id AND status = 'paid';
  IF paid_count >= pod.capacity_members THEN
    UPDATE public.pod_enrollments SET status = 'needs_refund', payment_id = _payment_id, updated_at = now() WHERE id = _enrollment_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'full', 'needs_refund', true);
  END IF;

  UPDATE public.pod_enrollments SET status = 'paid', payment_id = _payment_id, held_until = NULL, updated_at = now() WHERE id = _enrollment_id;

  FOR ev IN SELECT id FROM public.events WHERE pod_id = enr.pod_id ORDER BY session_index LOOP
    INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES (ev.id, enr.user_id, 'going')
    ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';
  END LOOP;

  SELECT count(*)::int INTO spots FROM public.pod_enrollments WHERE pod_id = enr.pod_id AND status = 'paid';
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'pod_id', enr.pod_id, 'user_id', enr.user_id,
    'paid_count', spots, 'capacity', pod.capacity_members, 'full', spots >= pod.capacity_members);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_pod_enrollment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_pod_enrollment(uuid, uuid) TO service_role;