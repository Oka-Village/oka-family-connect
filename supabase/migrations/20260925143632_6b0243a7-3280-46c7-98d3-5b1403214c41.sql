-- =====================================================================
-- Phase 7: Affiliates.
-- Commission math (single source of truth: affiliate_referral_stats):
--   earned_cents = floor( sum(amount_cents of the referral's payments where
--                  status='paid' AND purpose LIKE 'membership_%') * commission_pct / 100 )
--   using the affiliate's CURRENT commission_pct. Refunded/failed/pending and
--   'pod' payments never count. Test payments (metadata->>'test' = 'true',
--   admin-entered while Stripe isn't wired) are reported separately and are
--   NOT included in earned_cents.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_payments_user_membership ON public.payments (user_id)
  WHERE status = 'paid' AND purpose LIKE 'membership_%';

-- SECURITY DEFINER: affiliates has no member INSERT policy; this creates only the caller's own row.
CREATE OR REPLACE FUNCTION public.activate_affiliate()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.affiliates (user_id, display_name)
  SELECT uid, p.display_name FROM public.profiles p WHERE p.id = uid
  ON CONFLICT (user_id) DO NOTHING;
  SELECT invite_code INTO code FROM public.affiliates WHERE user_id = uid;
  RETURN code;
END; $$;

-- SECURITY DEFINER: signed-out visitors can't read affiliates/profiles; exposes only
-- the inviter's display name + first photo path for an ACTIVE code.
CREATE OR REPLACE FUNCTION public.affiliate_invite_info(_code text)
RETURNS TABLE(inviter_name text, inviter_photo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(p.display_name, a.display_name), CASE WHEN p.photo_url LIKE 'http%' THEN p.photo_url END
  FROM public.affiliates a JOIN public.profiles p ON p.id = a.user_id
  WHERE a.invite_code = upper(trim(_code)) AND a.status = 'active' LIMIT 1;
$$;

-- SECURITY DEFINER: members can't write affiliate_referrals. Attributes the caller only,
-- only if they joined within the last 24h (existing members clicking a link aren't claimed),
-- never to themselves, and at most once (unique referred_user_id).
CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); a public.affiliates%ROWTYPE; joined timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO a FROM public.affiliates WHERE invite_code = upper(trim(_code)) AND status = 'active';
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF a.user_id = uid THEN RETURN 'self'; END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_referrals WHERE referred_user_id = uid) THEN RETURN 'already'; END IF;
  SELECT created_at INTO joined FROM public.profiles WHERE id = uid;
  IF joined < now() - interval '24 hours' THEN RETURN 'existing'; END IF;
  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id) VALUES (a.id, uid)
  ON CONFLICT (referred_user_id) DO NOTHING;
  RETURN 'claimed';
END; $$;

-- Per-referral stats for the caller's affiliate account (or any, for admins).
-- SECURITY DEFINER: affiliates can't read referred members' payments directly;
-- this returns only aggregated amounts, never payment rows.
CREATE OR REPLACE FUNCTION public.affiliate_referral_stats(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE(referred_user_id uuid, display_name text, photo_url text, joined_at timestamptz,
              membership_tier text, paid_cents bigint, test_cents bigint, earned_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT a.id, a.commission_pct FROM public.affiliates a
    WHERE (_affiliate_id IS NULL AND a.user_id = auth.uid())
       OR (_affiliate_id IS NOT NULL AND a.id = _affiliate_id AND public.has_role(auth.uid(), 'admin'))
  )
  SELECT r.referred_user_id, p.display_name, p.photo_url, r.created_at, p.membership_tier,
    coalesce(sum(pay.amount_cents) FILTER (WHERE coalesce(pay.metadata->>'test','') <> 'true'),0)::bigint,
    coalesce(sum(pay.amount_cents) FILTER (WHERE pay.metadata->>'test' = 'true'),0)::bigint,
    floor(coalesce(sum(pay.amount_cents) FILTER (WHERE coalesce(pay.metadata->>'test','') <> 'true'),0) * me.commission_pct / 100)::bigint
  FROM me
  JOIN public.affiliate_referrals r ON r.affiliate_id = me.id
  JOIN public.profiles p ON p.id = r.referred_user_id
  LEFT JOIN public.payments pay ON pay.user_id = r.referred_user_id
    AND pay.status = 'paid' AND pay.purpose LIKE 'membership_%'
  GROUP BY r.referred_user_id, p.display_name, p.photo_url, r.created_at, p.membership_tier, me.commission_pct
  ORDER BY r.created_at DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.activate_affiliate() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.affiliate_referral_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.affiliate_invite_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_affiliate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_referral_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_invite_info(text) TO anon, authenticated;