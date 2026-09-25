-- =====================================================================
-- Phase 5: Houses — stays paid in credits (1 credit = 1 night).
-- Ledger lifecycle per booking (append-only, all via functions below):
--   request  -> guest  booking_lock          -nights   (credits held)
--   decline / cancel -> guest booking_refund +nights  (hold returned)
--   complete (on/after check-in, by host)
--            -> guest  booking_lock_release  +nights  (hold released)
--               guest  booking_spend         -nights  (the stay)
--               host   hosting_night         +nights
-- Double-booking is impossible: a GiST exclusion constraint forbids
-- overlapping live bookings (pending/approved/completed) per house.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- New ledger reason for releasing a hold when the stay converts to a spend.
ALTER TABLE public.credit_ledger DROP CONSTRAINT credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check CHECK (reason IN (
  'hosting_night','pod_completion','profile_completion','workshop_hosting',
  'skill_session_earn','skill_session_spend',
  'booking_lock','booking_lock_release','booking_spend','booking_refund',
  'manual_adjustment'));

-- Houses directory indexes.
CREATE INDEX IF NOT EXISTS idx_houses_directory ON public.houses (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_houses_location_trgm ON public.houses USING gin (location_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_houses_property_type ON public.houses (property_type) WHERE status = 'published';

-- ---------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  nights integer GENERATED ALWAYS AS (check_out - check_in) STORED,
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in),
  CHECK (check_out - check_in <= 30),
  CHECK (guest_id <> host_id),
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    house_id WITH =, daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('pending','approved','completed'))
);

-- Reads only; every write goes through the functions below.
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select_parties ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = guest_id OR auth.uid() = host_id);
CREATE POLICY bookings_select_admin ON public.bookings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_bookings_house ON public.bookings (house_id);
CREATE INDEX idx_bookings_guest ON public.bookings (guest_id, created_at DESC);
CREATE INDEX idx_bookings_host ON public.bookings (host_id, created_at DESC);
CREATE INDEX idx_bookings_status ON public.bookings (status);

CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Each booking posts each ledger reason at most once per party.
CREATE UNIQUE INDEX uq_ledger_booking ON public.credit_ledger (reason, reference_id, user_id)
  WHERE reference_type = 'booking';

-- Booked (live) date ranges for a published house, without exposing who booked.
-- SECURITY DEFINER: guests can't read other members' bookings, but need the busy dates.
CREATE OR REPLACE FUNCTION public.house_booked_ranges(_house_id uuid)
RETURNS TABLE (check_in date, check_out date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.check_in, b.check_out FROM public.bookings b
  JOIN public.houses h ON h.id = b.house_id AND h.status = 'published'
  WHERE b.house_id = _house_id AND b.status IN ('pending','approved','completed')
    AND b.check_out >= current_date
  ORDER BY b.check_in LIMIT 200;
$$;

-- ---------------------------------------------------------------------
-- request_booking
-- SECURITY DEFINER: inserts the booking and the guest's booking_lock ledger
-- entry (clients cannot write either) under a lock on the guest's profile row.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_booking(_house_id uuid, _check_in date, _check_out date, _message text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); h public.houses%ROWTYPE; n int; bal int; open_sessions int; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO h FROM public.houses WHERE id = _house_id;
  IF NOT FOUND OR h.status <> 'published' THEN RAISE EXCEPTION 'This home is not available'; END IF;
  IF h.owner_id = uid THEN RAISE EXCEPTION 'You cannot book your own home'; END IF;
  IF _check_in IS NULL OR _check_out IS NULL OR _check_out <= _check_in THEN RAISE EXCEPTION 'Check-out must be after check-in'; END IF;
  IF _check_in < current_date + 2 THEN RAISE EXCEPTION 'Please give your host at least 2 days notice'; END IF;
  n := _check_out - _check_in;
  IF n > 30 THEN RAISE EXCEPTION 'Stays can be up to 30 nights'; END IF;

  -- Serialise every credit check for this member.
  PERFORM 1 FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT coalesce(sum(delta),0) INTO bal FROM public.credit_ledger WHERE user_id = uid;
  SELECT count(*) INTO open_sessions FROM public.skill_session_requests
    WHERE requester_id = uid AND status IN ('pending','accepted');
  IF bal - open_sessions < n THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  BEGIN
    INSERT INTO public.bookings (house_id, guest_id, host_id, check_in, check_out, message)
    VALUES (_house_id, uid, h.owner_id, _check_in, _check_out, nullif(trim(_message), ''))
    RETURNING id INTO new_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'DATES_UNAVAILABLE';
  END;

  INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, reference_id, note)
  VALUES (uid, -n, 'booking_lock', 'booking', new_id, 'Credits held for a stay request');
  RETURN new_id;
END;
$$;

-- ---------------------------------------------------------------------
-- update_booking: approve / decline / complete (host), cancel (guest).
-- SECURITY DEFINER: changes booking status and posts refund / spend / earn
-- ledger entries atomically; clients cannot write either table directly.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_booking(_booking_id uuid, _action text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); b public.bookings%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND OR (uid <> b.host_id AND uid <> b.guest_id) THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF _action = 'approve' THEN
    IF uid <> b.host_id OR b.status <> 'pending' THEN RAISE EXCEPTION 'This request can no longer be approved'; END IF;
    UPDATE public.bookings SET status = 'approved' WHERE id = b.id;

  ELSIF _action IN ('decline','cancel') THEN
    IF _action = 'decline' AND (uid <> b.host_id OR b.status NOT IN ('pending','approved')) THEN
      RAISE EXCEPTION 'This request can no longer be declined'; END IF;
    IF _action = 'cancel' AND (uid <> b.guest_id OR b.status NOT IN ('pending','approved') OR b.check_in <= current_date) THEN
      RAISE EXCEPTION 'This stay can no longer be cancelled'; END IF;
    UPDATE public.bookings SET status = CASE WHEN _action = 'decline' THEN 'declined' ELSE 'cancelled' END WHERE id = b.id;
    INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, reference_id, note)
    VALUES (b.guest_id, b.nights, 'booking_refund', 'booking', b.id,
            CASE WHEN _action = 'decline' THEN 'Stay request declined' ELSE 'Stay cancelled' END);

  ELSIF _action = 'complete' THEN
    IF uid <> b.host_id OR b.status <> 'approved' THEN RAISE EXCEPTION 'Only approved stays can be completed'; END IF;
    IF current_date < b.check_in THEN RAISE EXCEPTION 'You can mark the stay complete from the check-in date'; END IF;
    UPDATE public.bookings SET status = 'completed' WHERE id = b.id;
    INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, reference_id, note) VALUES
      (b.guest_id,  b.nights, 'booking_lock_release', 'booking', b.id, 'Held credits released'),
      (b.guest_id, -b.nights, 'booking_spend',        'booking', b.id, 'Stay'),
      (b.host_id,   b.nights, 'hosting_night',        'booking', b.id, 'Nights hosted');
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
  RETURN _action;
END;
$$;

REVOKE ALL ON FUNCTION public.house_booked_ranges(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_booking(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.house_booked_ranges(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_booking(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking(uuid, text) TO authenticated;