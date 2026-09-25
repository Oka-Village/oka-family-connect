-- =====================================================================
-- Phase 6: credit surface + profile-completion award.
-- 1. Onboarding "done/skipped" is now onboarded_at — separate from
--    profile_completed, which the DATABASE computes from the profile
--    fields (clients can no longer set it), so the +2 can't be farmed.
-- 2. profile_completed flipping true awards 'profile_completion' +2 exactly
--    once (unique partial index + ON CONFLICT DO NOTHING).
-- 3. my_credit_history(): paginated, human-readable ledger (SECURITY INVOKER,
--    so RLS on ledger/bookings/sessions/profiles applies as the caller).
-- 4. my_credit_summary() reads the balance from credit_balances.
-- =====================================================================

ALTER TABLE public.profiles ADD COLUMN onboarded_at timestamptz;
UPDATE public.profiles SET onboarded_at = coalesce(updated_at, created_at) WHERE profile_completed;

CREATE UNIQUE INDEX uq_ledger_profile_completion ON public.credit_ledger (user_id)
  WHERE reason = 'profile_completion';
CREATE UNIQUE INDEX uq_ledger_pod_completion ON public.credit_ledger (user_id)
  WHERE reason = 'pod_completion';

-- Mirrors COMPLETENESS_FIELDS in src/lib/profile.ts.
CREATE OR REPLACE FUNCTION public.profile_is_complete(p public.profiles)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(trim(p.display_name),'') <> '' AND coalesce(trim(p.photo_url),'') <> ''
     AND coalesce(trim(p.age_range),'') <> '' AND coalesce(trim(p.location),'') <> ''
     AND coalesce(trim(p.relationship_status),'') <> '' AND coalesce(trim(p.profession),'') <> ''
     AND cardinality(p.intentions) > 0
     AND coalesce(trim(p.gift_excited_to_give),'') <> '' AND coalesce(trim(p.gift_loved_gestures),'') <> ''
     AND cardinality(p.skill_tags) > 0 AND cardinality(p.travel_frequent) > 0 AND cardinality(p.travel_desired) > 0;
$$;

-- BEFORE trigger: profile_completed is derived, never client-set. Once true it stays true.
CREATE OR REPLACE FUNCTION public.profiles_set_completed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.profile_completed := (TG_OP = 'UPDATE' AND OLD.profile_completed) OR public.profile_is_complete(NEW);
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_set_completed BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_completed();

-- AFTER trigger. SECURITY DEFINER: members cannot insert ledger rows; this is
-- the only path that posts the one-time profile_completion award.
CREATE OR REPLACE FUNCTION public.award_profile_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.profile_completed AND (TG_OP = 'INSERT' OR NOT OLD.profile_completed) THEN
    INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, note)
    VALUES (NEW.id, 2, 'profile_completion', 'profile', 'Welcome gift for completing your profile')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.award_profile_completion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_award_completion AFTER INSERT OR UPDATE OF profile_completed ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.award_profile_completion();

-- Recompute existing rows: skipped-onboarding profiles lose the flag unless truly complete.
UPDATE public.profiles p SET profile_completed = public.profile_is_complete(p);

-- Balance straight from the credit_balances view.
CREATE OR REPLACE FUNCTION public.my_credit_summary()
RETURNS TABLE(balance integer, reserved integer, available integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (SELECT coalesce((SELECT cb.balance FROM public.credit_balances cb WHERE cb.user_id = auth.uid()),0)::int AS v),
       r AS (SELECT count(*)::int AS v FROM public.skill_session_requests
             WHERE requester_id = auth.uid() AND status IN ('pending','accepted'))
  SELECT b.v, r.v, b.v - r.v FROM b, r;
$$;

-- Human-readable history, keyset-paginated (newest first).
CREATE OR REPLACE FUNCTION public.my_credit_history(_before_created timestamptz DEFAULT NULL, _before_id uuid DEFAULT NULL, _limit int DEFAULT 25)
RETURNS TABLE(id uuid, delta int, reason text, description text, note text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT l.id, l.delta, l.reason,
    CASE l.reason
      WHEN 'hosting_night' THEN 'Hosted ' || coalesce(g.display_name,'a guest') || ' for ' || b.nights || ' night' || CASE WHEN b.nights = 1 THEN '' ELSE 's' END
      WHEN 'booking_spend' THEN 'Stayed with ' || coalesce(h.display_name,'a host') || ' for ' || b.nights || ' night' || CASE WHEN b.nights = 1 THEN '' ELSE 's' END
      WHEN 'booking_lock' THEN 'Credits held for a stay at ' || coalesce(hs.title,'a home')
      WHEN 'booking_lock_release' THEN 'Held credits released for ' || coalesce(hs.title,'a stay')
      WHEN 'booking_refund' THEN 'Credits returned for ' || coalesce(hs.title,'a stay')
      WHEN 'skill_session_earn' THEN 'Skill session with ' || coalesce(rq.display_name,'a member') || coalesce(' · ' || sk.title,'')
      WHEN 'skill_session_spend' THEN 'Skill session with ' || coalesce(sh.display_name,'a member') || coalesce(' · ' || sk.title,'')
      WHEN 'profile_completion' THEN 'Completed your profile'
      WHEN 'pod_completion' THEN 'Completed a Pod'
      WHEN 'workshop_hosting' THEN 'Hosted a workshop'
      WHEN 'manual_adjustment' THEN 'Adjustment from the Oka team'
      ELSE l.reason END,
    l.note, l.created_at
  FROM public.credit_ledger l
  LEFT JOIN public.bookings b ON l.reference_type = 'booking' AND b.id = l.reference_id
  LEFT JOIN public.houses hs ON hs.id = b.house_id
  LEFT JOIN public.profiles g ON g.id = b.guest_id
  LEFT JOIN public.profiles h ON h.id = b.host_id
  LEFT JOIN public.skill_session_requests s ON l.reference_type = 'skill_session_request' AND s.id = l.reference_id
  LEFT JOIN public.skills sk ON sk.id = s.skill_id
  LEFT JOIN public.profiles rq ON rq.id = s.requester_id
  LEFT JOIN public.profiles sh ON sh.id = s.host_id
  WHERE l.user_id = auth.uid()
    AND (_before_created IS NULL OR (l.created_at, l.id) < (_before_created, _before_id))
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT least(greatest(_limit,1),100);
$$;
REVOKE ALL ON FUNCTION public.my_credit_history(timestamptz, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_credit_history(timestamptz, uuid, int) TO authenticated;

-- Admin manual adjustments: note required, non-zero, bounded.
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_manual_note
  CHECK (reason <> 'manual_adjustment' OR (coalesce(trim(note),'') <> '' AND delta <> 0 AND abs(delta) <= 1000));