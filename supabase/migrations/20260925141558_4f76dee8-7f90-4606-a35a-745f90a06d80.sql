-- =====================================================================
-- Phase 4: Skills exchange — 1:1 sessions paid in credits.
-- Credits move ONLY through the append-only credit_ledger, and only via
-- the functions below. Requests reserve nothing in the ledger; instead the
-- requester's "available" balance = ledger sum − open (pending/accepted)
-- requests, checked under a per-member row lock so it is race-safe.
-- =====================================================================

-- Optional listing photo (stored in the avatars bucket under <owner_id>/skills/...).
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS photo_url text;

-- Skills directory indexes: newest-first keyset pagination, filters, title search.
CREATE INDEX IF NOT EXISTS idx_skills_directory ON public.skills (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills (category) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_skills_title_trgm ON public.skills USING gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- skill_session_requests
-- ---------------------------------------------------------------------
CREATE TABLE public.skill_session_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_at timestamptz NOT NULL,
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','completed','declined','cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> host_id)
);

-- Reads only; every write goes through the functions below.
GRANT SELECT ON public.skill_session_requests TO authenticated;
GRANT ALL ON public.skill_session_requests TO service_role;
ALTER TABLE public.skill_session_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ssr_select_parties ON public.skill_session_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = host_id);
CREATE POLICY ssr_select_admin ON public.skill_session_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ssr_skill ON public.skill_session_requests (skill_id);
CREATE INDEX idx_ssr_requester ON public.skill_session_requests (requester_id, created_at DESC);
CREATE INDEX idx_ssr_host ON public.skill_session_requests (host_id, created_at DESC);
CREATE INDEX idx_ssr_status ON public.skill_session_requests (status);
-- Fast "open commitments" count used by the balance check.
CREATE INDEX idx_ssr_requester_open ON public.skill_session_requests (requester_id)
  WHERE status IN ('pending','accepted');

CREATE TRIGGER skill_session_requests_set_updated_at
  BEFORE UPDATE ON public.skill_session_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A session can post each ledger entry at most once, even under retries.
CREATE UNIQUE INDEX uq_ledger_skill_session ON public.credit_ledger (reason, reference_id)
  WHERE reference_type = 'skill_session_request';

-- ---------------------------------------------------------------------
-- Available credits = ledger balance − open requests (pending/accepted).
-- SECURITY DEFINER: reads the caller's own ledger/requests only (auth.uid()).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_credit_summary()
RETURNS TABLE (balance integer, reserved integer, available integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH b AS (SELECT coalesce(sum(delta),0)::int AS v FROM public.credit_ledger WHERE user_id = auth.uid()),
       r AS (SELECT count(*)::int AS v FROM public.skill_session_requests
             WHERE requester_id = auth.uid() AND status IN ('pending','accepted'))
  SELECT b.v, r.v, b.v - r.v FROM b, r;
$$;

-- ---------------------------------------------------------------------
-- request_skill_session
-- SECURITY DEFINER: inserts into skill_session_requests (no client insert
-- policy) after a balance check serialised by locking the caller's profile row.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_skill_session(_skill_id uuid, _proposed_at timestamptz, _message text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); sk public.skills%ROWTYPE; bal int; open_count int; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO sk FROM public.skills WHERE id = _skill_id;
  IF NOT FOUND OR sk.status <> 'published' THEN RAISE EXCEPTION 'This skill is not available'; END IF;
  IF sk.owner_id = uid THEN RAISE EXCEPTION 'You cannot request your own skill'; END IF;
  IF _proposed_at IS NULL OR _proposed_at < now() THEN RAISE EXCEPTION 'Please propose a time in the future'; END IF;
  IF _message IS NOT NULL AND char_length(_message) > 1000 THEN RAISE EXCEPTION 'Message is too long'; END IF;

  -- Serialise all credit checks for this member.
  PERFORM 1 FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT coalesce(sum(delta),0) INTO bal FROM public.credit_ledger WHERE user_id = uid;
  SELECT count(*) INTO open_count FROM public.skill_session_requests
    WHERE requester_id = uid AND status IN ('pending','accepted');
  IF bal - open_count < 1 THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  INSERT INTO public.skill_session_requests (skill_id, requester_id, host_id, proposed_at, message)
  VALUES (_skill_id, uid, sk.owner_id, _proposed_at, nullif(trim(_message), ''))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- ---------------------------------------------------------------------
-- update_skill_session: accept / decline / complete (host), cancel (requester).
-- SECURITY DEFINER: changes request status and, on completion, posts the two
-- ledger entries atomically — clients cannot write either table directly.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_skill_session(_request_id uuid, _action text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); r public.skill_session_requests%ROWTYPE; bal int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO r FROM public.skill_session_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR (uid <> r.host_id AND uid <> r.requester_id) THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF _action = 'accept' THEN
    IF uid <> r.host_id OR r.status <> 'pending' THEN RAISE EXCEPTION 'This request can no longer be accepted'; END IF;
    UPDATE public.skill_session_requests SET status = 'accepted' WHERE id = r.id;
  ELSIF _action = 'decline' THEN
    IF uid <> r.host_id OR r.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'This request can no longer be declined'; END IF;
    UPDATE public.skill_session_requests SET status = 'declined' WHERE id = r.id;
  ELSIF _action = 'cancel' THEN
    IF uid <> r.requester_id OR r.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'This request can no longer be cancelled'; END IF;
    UPDATE public.skill_session_requests SET status = 'cancelled' WHERE id = r.id;
  ELSIF _action = 'complete' THEN
    IF uid <> r.host_id OR r.status <> 'accepted' THEN RAISE EXCEPTION 'Only accepted sessions can be completed'; END IF;
    -- Lock the requester's credits and confirm the reserved credit still exists.
    PERFORM 1 FROM public.profiles WHERE id = r.requester_id FOR UPDATE;
    SELECT coalesce(sum(delta),0) INTO bal FROM public.credit_ledger WHERE user_id = r.requester_id;
    IF bal < 1 THEN RAISE EXCEPTION 'The requester no longer has a credit for this session'; END IF;
    UPDATE public.skill_session_requests SET status = 'completed', completed_at = now() WHERE id = r.id;
    INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, reference_id, note) VALUES
      (r.requester_id, -1, 'skill_session_spend', 'skill_session_request', r.id, 'Skill session received'),
      (r.host_id,       1, 'skill_session_earn',  'skill_session_request', r.id, 'Skill session given');
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
  RETURN _action;
END;
$$;

REVOKE ALL ON FUNCTION public.my_credit_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_skill_session(uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_skill_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_credit_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_skill_session(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_skill_session(uuid, text) TO authenticated;