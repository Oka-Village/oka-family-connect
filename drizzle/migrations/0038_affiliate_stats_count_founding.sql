CREATE OR REPLACE FUNCTION public.affiliate_referral_stats(_affiliate_id uuid DEFAULT NULL)
RETURNS TABLE(referred_user_id uuid, display_name text, photo_url text, joined_at timestamptz,
              membership_tier text, paid_cents bigint, test_cents bigint, earned_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT a.id, a.commission_pct FROM public.affiliates a
    WHERE (_affiliate_id IS NULL AND a.user_id = auth.uid())
       OR (_affiliate_id IS NOT NULL AND a.id = _affiliate_id AND public.has_role(auth.uid(), 'admin'))
  )
  SELECT r.referred_user_id, p.display_name, p.photo_url, r.created_at,
    CASE WHEN EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = r.referred_user_id AND m.active) THEN 'full' ELSE p.membership_tier END,
    coalesce(sum(pay.amount_cents) FILTER (WHERE coalesce(pay.metadata->>'test','') <> 'true'),0)::bigint,
    coalesce(sum(pay.amount_cents) FILTER (WHERE pay.metadata->>'test' = 'true'),0)::bigint,
    floor(coalesce(sum(pay.amount_cents) FILTER (WHERE coalesce(pay.metadata->>'test','') <> 'true'),0) * me.commission_pct / 100)::bigint
  FROM me
  JOIN public.affiliate_referrals r ON r.affiliate_id = me.id
  JOIN public.profiles p ON p.id = r.referred_user_id
  LEFT JOIN public.payments pay ON pay.user_id = r.referred_user_id
    AND pay.status = 'paid' AND (pay.purpose LIKE 'membership_%' OR pay.purpose = 'founding_lifetime')
  GROUP BY r.referred_user_id, p.display_name, p.photo_url, r.created_at, p.membership_tier, me.commission_pct
  ORDER BY r.created_at DESC
  LIMIT 500;
$$;