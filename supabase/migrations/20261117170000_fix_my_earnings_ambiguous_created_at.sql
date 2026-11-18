CREATE OR REPLACE FUNCTION public.my_earnings_raw()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_invites jsonb;
  v_statement jsonb;
  v_totals jsonb;
  v_month_series jsonb;
  v_events jsonb;
  v_payouts jsonb;
  v_payout_method jsonb;
  v_start date;
  v_end date;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'invites', '[]'::jsonb, 'statement', '[]'::jsonb,
      'totals', jsonb_build_object(
        'referralCents', 0, 'contributionCents', 0, 'pendingCents', 0, 'paidCents', 0,
        'creditsCents', 0, 'advancesCents', 0, 'deductionsCents', 0
      ),
      'monthSeries', '[]'::jsonb, 'events', '[]'::jsonb, 'payouts', '[]'::jsonb,
      'payoutMethod', null
    );
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ar.referred_user_id,
    'firstName', pr.display_name,
    'registered', to_char(ar.created_at, 'YYYY-MM-DD'),
    'status', CASE
      WHEN m.active THEN 'active-paid'
      WHEN pr.trial_started_at IS NOT NULL AND pr.trial_started_at >= now() - interval '7 days' THEN 'free-trial'
      WHEN pr.trial_started_at IS NOT NULL THEN 'expired-trial'
      ELSE 'expired-trial'
    END,
    'membershipType', m.kind,
    'lastPayment', (
      SELECT to_char(max(p2.created_at), 'YYYY-MM-DD')
      FROM public.payments p2
      WHERE p2.user_id = ar.referred_user_id AND p2.status = 'paid'
    ),
    'earnedCents', (
      SELECT coalesce(sum(mel.amount_cents), 0)
      FROM public.member_earnings_ledger mel
      WHERE mel.user_id = v_uid AND mel.kind = 'referral' AND mel.status = 'approved'
        AND mel.related_id IN (SELECT id FROM public.payments WHERE user_id = ar.referred_user_id)
    ),
    'pendingCents', (
      SELECT coalesce(sum(mel.amount_cents), 0)
      FROM public.member_earnings_ledger mel
      WHERE mel.user_id = v_uid AND mel.kind = 'referral' AND mel.status = 'estimated'
        AND mel.related_id IN (SELECT id FROM public.payments WHERE user_id = ar.referred_user_id)
    )
  ) ORDER BY ar.created_at DESC), '[]'::jsonb) INTO v_invites
  FROM public.affiliate_referrals ar
  JOIN public.affiliates af ON af.id = ar.affiliate_id AND af.user_id = v_uid
  JOIN public.profiles pr ON pr.id = ar.referred_user_id
  LEFT JOIN public.memberships m ON m.user_id = ar.referred_user_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'date', to_char(created_at, 'YYYY-MM-DD'),
    'reason', description,
    'cents', amount_cents,
    'kind', kind,
    'reference', reference_code
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_statement
  FROM public.member_earnings_ledger
  WHERE user_id = v_uid AND kind IN ('advance','deduction','credit');

  SELECT jsonb_build_object(
    'referralCents', coalesce(sum(amount_cents) FILTER (WHERE kind = 'referral' AND status = 'approved'), 0),
    'contributionCents', coalesce(sum(amount_cents) FILTER (WHERE kind = 'contribution' AND status = 'approved'), 0),
    'pendingCents', coalesce(sum(amount_cents) FILTER (WHERE kind IN ('referral','contribution') AND status = 'estimated'), 0),
    'paidCents', coalesce((
      SELECT coalesce(sum(amount_cents), 0) FROM public.member_payouts
      WHERE user_id = v_uid AND status = 'paid'
    ), 0),
    'creditsCents', coalesce(sum(amount_cents) FILTER (WHERE kind = 'credit'), 0),
    'advancesCents', coalesce(sum(amount_cents) FILTER (WHERE kind = 'advance'), 0),
    'deductionsCents', coalesce(sum(amount_cents) FILTER (WHERE kind = 'deduction'), 0)
  ) INTO v_totals
  FROM public.member_earnings_ledger
  WHERE user_id = v_uid;

  SELECT least(
    coalesce((SELECT min(ar.created_at)::date FROM public.affiliate_referrals ar JOIN public.affiliates af ON af.id = ar.affiliate_id AND af.user_id = v_uid), CURRENT_DATE),
    coalesce((SELECT min(to_date(period_month || '-01', 'YYYY-MM-DD')) FROM public.member_earnings_ledger WHERE user_id = v_uid), CURRENT_DATE)
  ) INTO v_start;
  v_end := date_trunc('month', CURRENT_DATE)::date;

  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS id
    FROM generate_series(date_trunc('month', v_start), v_end, interval '1 month') AS d
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'referralCents', coalesce((
      SELECT sum(mel.amount_cents) FROM public.member_earnings_ledger mel
      WHERE mel.user_id = v_uid AND mel.kind = 'referral' AND mel.status = 'approved' AND mel.period_month = m.id
    ), 0),
    'contributionCents', coalesce((
      SELECT sum(mel.amount_cents) FROM public.member_earnings_ledger mel
      WHERE mel.user_id = v_uid AND mel.kind = 'contribution' AND mel.status = 'approved' AND mel.period_month = m.id
    ), 0),
    'invitedCount', coalesce((
      SELECT count(*) FROM public.affiliate_referrals ar
      JOIN public.affiliates af ON af.id = ar.affiliate_id AND af.user_id = v_uid
      WHERE to_char(ar.created_at, 'YYYY-MM') = m.id
    ), 0),
    'payingCount', coalesce((
      SELECT count(DISTINCT ar.referred_user_id)
      FROM public.affiliate_referrals ar
      JOIN public.affiliates af ON af.id = ar.affiliate_id AND af.user_id = v_uid
      JOIN public.payments p ON p.user_id = ar.referred_user_id AND p.status = 'paid'
        AND to_char(p.created_at, 'YYYY-MM') = m.id
        AND coalesce(p.metadata ->> 'test', 'false') <> 'true'
    ), 0)
  ) ORDER BY m.id), '[]'::jsonb) INTO v_month_series
  FROM months m;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ec.id,
    'name', e.title,
    'date', to_char(e.starts_at, 'YYYY-MM-DD'),
    'number', e.event_number::text,
    'eventStatus', e.status,
    'status', ec.status,
    'registered', (SELECT count(*) FROM public.event_rsvps r WHERE r.event_id = e.id),
    'verified', ec.verified_attendees,
    'points', ec.total_points,
    'earningsCents', ec.converted_amount_cents
  ) ORDER BY e.starts_at DESC), '[]'::jsonb) INTO v_events
  FROM public.event_contributions ec
  JOIN public.events e ON e.id = ec.event_id
  WHERE ec.host_id = v_uid;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'date', to_char(scheduled_for, 'YYYY-MM-DD'),
    'covers', to_char(scheduled_for - interval '1 month', 'YYYY-MM'),
    'cents', amount_cents,
    'status', status,
    'method', payout_method,
    'stripePayoutId', stripe_payout_id
  ) ORDER BY scheduled_for DESC), '[]'::jsonb) INTO v_payouts
  FROM public.member_payouts
  WHERE user_id = v_uid;

  SELECT jsonb_build_object(
    'methodType', method_type,
    'bankName', bank_name,
    'accountLast4', account_last4
  ) INTO v_payout_method
  FROM public.member_payout_methods
  WHERE user_id = v_uid AND is_active
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'invites', v_invites,
    'statement', v_statement,
    'totals', v_totals,
    'monthSeries', coalesce(v_month_series, '[]'::jsonb),
    'events', coalesce(v_events, '[]'::jsonb),
    'payouts', coalesce(v_payouts, '[]'::jsonb),
    'payoutMethod', v_payout_method
  );
END;
$function$;
