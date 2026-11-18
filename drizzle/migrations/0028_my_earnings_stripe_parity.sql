-- =====================================================================
-- My Earnings parity: expand my_earnings_raw, schedule payouts, refund helper.
-- Tables from Sheet 6 already exist; this migration only replaces functions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- schedule_member_payouts: one scheduled row per member with a positive
-- net balance for the upcoming 20th, if none exists for that payout date.
-- Net = approved(referral+contribution) + credits - advances - deductions - paid payouts
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_member_payouts(p_for date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheduled date;
  v_count integer := 0;
  r record;
  v_approved integer;
  v_credits integer;
  v_advances integer;
  v_deductions integer;
  v_paid integer;
  v_net integer;
  v_scope uuid := auth.uid();
BEGIN
  -- Next payout date on or after p_for (20th of this or next month).
  IF extract(day from p_for) <= 20 THEN
    v_scheduled := date_trunc('month', p_for)::date + 19;
  ELSE
    v_scheduled := (date_trunc('month', p_for) + interval '1 month')::date + 19;
  END IF;

  FOR r IN
    SELECT DISTINCT user_id FROM public.member_earnings_ledger
    WHERE v_scope IS NULL OR user_id = v_scope
  LOOP
    SELECT
      coalesce(sum(amount_cents) FILTER (WHERE kind IN ('referral','contribution') AND status = 'approved'), 0),
      coalesce(sum(amount_cents) FILTER (WHERE kind = 'credit'), 0),
      coalesce(sum(amount_cents) FILTER (WHERE kind = 'advance'), 0),
      coalesce(sum(amount_cents) FILTER (WHERE kind = 'deduction'), 0)
    INTO v_approved, v_credits, v_advances, v_deductions
    FROM public.member_earnings_ledger
    WHERE user_id = r.user_id;

    -- Previous + in-flight payouts live on member_payouts (Stripe/manual disbursements).
    SELECT coalesce(sum(amount_cents), 0) INTO v_paid
    FROM public.member_payouts
    WHERE user_id = r.user_id AND status IN ('scheduled','processing','paid');

    v_net := v_approved + v_credits - v_advances - v_deductions - v_paid;
    IF v_net <= 0 THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.member_payouts
      WHERE user_id = r.user_id AND scheduled_for = v_scheduled
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.member_payouts (user_id, amount_cents, status, scheduled_for, payout_method)
    VALUES (r.user_id, v_net, 'scheduled', v_scheduled, 'bank_transfer');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_member_payouts(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_member_payouts(date) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- apply_referral_refund_deduction: when Stripe refunds a referred payment,
-- debit the referring member's ledger (idempotent on related_id).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_refund_deduction(p_payment_id uuid, p_amount_cents integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_affiliate_user uuid;
  v_commission numeric;
  v_deduct integer;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT af.user_id, af.commission_pct INTO v_affiliate_user, v_commission
  FROM public.affiliate_referrals ar
  JOIN public.affiliates af ON af.id = ar.affiliate_id
  WHERE ar.referred_user_id = v_payment.user_id
  LIMIT 1;

  IF v_affiliate_user IS NULL THEN
    RETURN;
  END IF;

  v_deduct := coalesce(
    p_amount_cents,
    round(v_payment.amount_cents * v_commission / 100.0)::integer
  );
  IF v_deduct <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.member_earnings_ledger (
    user_id, kind, amount_cents, status, period_month, reference_code, description, related_id
  ) VALUES (
    v_affiliate_user,
    'deduction',
    v_deduct,
    'approved',
    to_char(now(), 'YYYY-MM'),
    'RFN-' || upper(substr(p_payment_id::text, 1, 8)),
    'Refund/dispute deduction on referred membership payment',
    p_payment_id
  )
  ON CONFLICT (kind, related_id) WHERE related_id IS NOT NULL DO NOTHING;

  UPDATE public.payments SET status = 'refunded' WHERE id = p_payment_id AND status = 'paid';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral_refund_deduction(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_refund_deduction(uuid, integer) TO service_role;

-- ---------------------------------------------------------------------
-- Expanded my_earnings_raw: full My Earnings payload for auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_earnings_raw()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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

  -- Month series from earliest activity through current month.
  SELECT least(
    coalesce((SELECT min(created_at)::date FROM public.affiliate_referrals ar JOIN public.affiliates af ON af.id = ar.affiliate_id AND af.user_id = v_uid), CURRENT_DATE),
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
$$;

REVOKE ALL ON FUNCTION public.my_earnings_raw() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_earnings_raw() TO authenticated;