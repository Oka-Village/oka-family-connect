-- Drive Open Accounting cash from payments.amount_cents (and metadata fees),
-- not client-side list-price multiplication. Sync snapshots before reads so
-- openingCashCents comes from company_financial_snapshots.

CREATE OR REPLACE FUNCTION public.sync_open_accounting(p_as_of date DEFAULT now()::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start text;
BEGIN
  PERFORM public.sync_member_earnings();
  PERFORM public.sync_event_contributions();
  PERFORM public.run_monthly_contribution_conversion(to_char(p_as_of - interval '1 month', 'YYYY-MM'));

  SELECT to_char(date_trunc('month', min(created_at)), 'YYYY-MM') INTO v_start FROM public.profiles;
  IF v_start IS NULL THEN
    v_start := to_char(date_trunc('month', p_as_of), 'YYYY-MM');
  END IF;
  PERFORM public.sync_financial_snapshots(v_start);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_open_accounting(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_open_accounting(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.open_accounting_raw(p_start_month text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_months jsonb;
  v_earners jsonb;
  v_ledger jsonb;
  v_ownership jsonb;
  v_today jsonb;
  v_opening integer;
BEGIN
  SELECT coalesce(
    (SELECT opening_cash_cents FROM public.company_financial_snapshots WHERE period_key = p_start_month),
    (SELECT opening_cash_cents FROM public.company_financial_snapshots ORDER BY period_key ASC LIMIT 1),
    0
  ) INTO v_opening;

  SELECT jsonb_build_object(
    'monthlyInvoices', (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_monthly' AND p.created_at >= date_trunc('day', now())),
    'annualInvoices', (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_annual' AND p.created_at >= date_trunc('day', now())),
    'lifetimeInvoices', (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'founding_lifetime' AND p.created_at >= date_trunc('day', now())),
    'monthlyCashCents', (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_monthly' AND p.created_at >= date_trunc('day', now())),
    'annualCashCents', (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_annual' AND p.created_at >= date_trunc('day', now())),
    'lifetimeCashCents', (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'founding_lifetime' AND p.created_at >= date_trunc('day', now())),
    'discountCents', (SELECT coalesce(sum(CASE WHEN (p.metadata->>'discount_cents') ~ '^-?\d+$' THEN (p.metadata->>'discount_cents')::int ELSE 0 END),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= date_trunc('day', now())),
    'refundCents', (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'refunded' AND p.created_at >= date_trunc('day', now())),
    'chargebackCents', (SELECT coalesce(sum(CASE WHEN (p.metadata->>'chargeback_cents') ~ '^-?\d+$' THEN (p.metadata->>'chargeback_cents')::int ELSE 0 END),0) FROM public.payments p WHERE coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= date_trunc('day', now())),
    'taxCents', (SELECT coalesce(sum(CASE WHEN (p.metadata->>'tax_cents') ~ '^-?\d+$' THEN (p.metadata->>'tax_cents')::int ELSE 0 END),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= date_trunc('day', now())),
    'processingFeeCents', (SELECT coalesce(sum(CASE WHEN (p.metadata->>'processing_fee_cents') ~ '^-?\d+$' THEN (p.metadata->>'processing_fee_cents')::int ELSE 0 END),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= date_trunc('day', now())),
    'otherRevenueCents', (SELECT coalesce(sum(amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'pod' AND p.created_at >= date_trunc('day', now())),
    'newMembers', (SELECT count(*) FROM public.profiles pr WHERE pr.created_at >= date_trunc('day', now())),
    'eventsCreated', (SELECT count(*) FROM public.events e WHERE e.created_at >= date_trunc('day', now())),
    'eventsCompleted', (SELECT count(*) FROM public.events e WHERE e.status = 'completed' AND e.starts_at >= date_trunc('day', now())),
    'creditsIssued', (SELECT count(*) FROM public.credit_ledger cl WHERE cl.delta > 0 AND cl.created_at >= date_trunc('day', now())),
    'creditsRedeemed', (SELECT count(*) FROM public.credit_ledger cl WHERE cl.delta < 0 AND cl.created_at >= date_trunc('day', now())),
    'hostingNights', (SELECT coalesce(sum(b.nights),0) FROM public.bookings b WHERE b.status = 'completed' AND b.check_in >= date_trunc('day', now())),
    'completedStays', (SELECT count(*) FROM public.bookings b WHERE b.status = 'completed' AND b.check_out >= date_trunc('day', now())),
    'skillExchanges', (SELECT count(*) FROM public.skill_session_requests sr WHERE sr.status = 'completed' AND sr.completed_at >= date_trunc('day', now())),
    'points', (SELECT coalesce(sum(ec.total_points),0) FROM public.event_contributions ec JOIN public.events e ON e.id = ec.event_id WHERE e.starts_at >= date_trunc('day', now())),
    'expenses', '{}'::jsonb
  ) INTO v_today;

  WITH month_series AS (
    SELECT generate_series(to_date(p_start_month || '-01', 'YYYY-MM-DD')::timestamptz, date_trunc('month', now()), interval '1 month')::date AS month_start
  ),
  per_month AS (
    SELECT
      to_char(ms.month_start, 'YYYY-MM') AS id,
      (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_monthly' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS monthly_invoices,
      (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_annual' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS annual_invoices,
      (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'founding_lifetime' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS lifetime_invoices,
      (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_monthly' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS monthly_cash_cents,
      (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_annual' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS annual_cash_cents,
      (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'founding_lifetime' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS lifetime_cash_cents,
      (SELECT coalesce(sum(CASE WHEN (p.metadata->>'discount_cents') ~ '^-?\d+$' THEN (p.metadata->>'discount_cents')::int ELSE 0 END),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS discount_cents,
      (SELECT coalesce(sum(p.amount_cents),0) FROM public.payments p WHERE p.status = 'refunded' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS refund_cents,
      (SELECT coalesce(sum(CASE WHEN (p.metadata->>'chargeback_cents') ~ '^-?\d+$' THEN (p.metadata->>'chargeback_cents')::int ELSE 0 END),0) FROM public.payments p WHERE coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS chargeback_cents,
      (SELECT coalesce(sum(CASE WHEN (p.metadata->>'tax_cents') ~ '^-?\d+$' THEN (p.metadata->>'tax_cents')::int ELSE 0 END),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS tax_cents,
      (SELECT coalesce(sum(CASE WHEN (p.metadata->>'processing_fee_cents') ~ '^-?\d+$' THEN (p.metadata->>'processing_fee_cents')::int ELSE 0 END),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS processing_fee_cents,
      (SELECT coalesce(sum(amount_cents),0) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'pod' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS other_revenue_cents,
      (SELECT coalesce(jsonb_object_agg(category, total), '{}'::jsonb) FROM (
        SELECT category, sum(amount_cents) AS total FROM public.company_expenses WHERE month_key = to_char(ms.month_start,'YYYY-MM') GROUP BY category
      ) e) AS expenses,
      (SELECT coalesce(jsonb_object_agg(category, total), '{}'::jsonb) FROM (
        SELECT category, sum(budget_cents) AS total FROM public.company_expenses WHERE month_key = to_char(ms.month_start,'YYYY-MM') AND budget_cents > 0 GROUP BY category
      ) b) AS budgets,
      (SELECT coalesce(sum(amount_cents),0) FROM public.member_earnings_ledger WHERE kind = 'referral' AND status = 'approved' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS referral_approved_cents,
      (SELECT coalesce(sum(amount_cents),0) FROM public.member_earnings_ledger WHERE kind = 'referral' AND status = 'estimated' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS referral_pending_cents,
      (SELECT coalesce(sum(amount_cents),0) FROM public.member_earnings_ledger WHERE kind = 'referral' AND status = 'paid' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS referral_paid_cents,
      (SELECT coalesce(sum(amount_cents),0) FROM public.member_earnings_ledger WHERE kind = 'contribution' AND status = 'approved' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS contributor_approved_cents,
      (SELECT coalesce(sum(amount_cents),0) FROM public.member_earnings_ledger WHERE kind = 'contribution' AND status = 'paid' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS contributor_paid_cents,
      (SELECT coalesce(sum(ec.total_points),0) FROM public.event_contributions ec JOIN public.events e ON e.id = ec.event_id WHERE e.starts_at >= ms.month_start AND e.starts_at < ms.month_start + interval '1 month') AS points,
      (SELECT count(*) FROM public.profiles pr WHERE pr.created_at >= ms.month_start AND pr.created_at < ms.month_start + interval '1 month') AS new_members,
      (SELECT count(*) FROM public.events e WHERE e.created_at >= ms.month_start AND e.created_at < ms.month_start + interval '1 month') AS events_created,
      (SELECT count(*) FROM public.events e WHERE e.status = 'completed' AND e.starts_at >= ms.month_start AND e.starts_at < ms.month_start + interval '1 month') AS events_completed,
      (SELECT count(*) FROM public.credit_ledger cl WHERE cl.delta > 0 AND cl.created_at >= ms.month_start AND cl.created_at < ms.month_start + interval '1 month') AS credits_issued,
      (SELECT count(*) FROM public.credit_ledger cl WHERE cl.delta < 0 AND cl.created_at >= ms.month_start AND cl.created_at < ms.month_start + interval '1 month') AS credits_redeemed,
      (SELECT count(*) FROM public.skill_session_requests sr WHERE sr.status = 'completed' AND sr.completed_at >= ms.month_start AND sr.completed_at < ms.month_start + interval '1 month') AS skill_exchanges,
      (SELECT coalesce(sum(b.nights),0) FROM public.bookings b WHERE b.status = 'completed' AND b.check_in >= ms.month_start AND b.check_in < ms.month_start + interval '1 month') AS hosting_nights,
      (SELECT count(*) FROM public.bookings b WHERE b.status = 'completed' AND b.check_out >= ms.month_start AND b.check_out < ms.month_start + interval '1 month') AS completed_stays,
      (SELECT count(*) FROM public.profiles pr WHERE pr.created_at < ms.month_start + interval '1 month') AS registered,
      (SELECT count(*) FROM public.memberships m WHERE m.active AND m.kind = 'monthly' AND m.created_at < ms.month_start + interval '1 month') AS paying_monthly,
      (SELECT count(DISTINCT p.user_id) FROM public.payments p WHERE p.status='paid' AND coalesce(p.metadata->>'test','false')<>'true' AND p.purpose='membership_annual' AND p.created_at >= (ms.month_start + interval '1 month' - interval '1 year') AND p.created_at < ms.month_start + interval '1 month') AS paying_annual,
      (SELECT count(*) FROM public.memberships m WHERE m.active AND m.kind = 'founding' AND m.created_at < ms.month_start + interval '1 month') AS paying_lifetime,
      (SELECT count(*) FROM public.profiles pr WHERE pr.trial_started_at IS NOT NULL
         AND pr.trial_started_at < ms.month_start + interval '1 month'
         AND pr.trial_started_at >= (ms.month_start + interval '1 month' - interval '7 days')
         AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = pr.id AND m.active)) AS trials,
      (SELECT count(*) FROM public.houses h WHERE h.status = 'published' AND h.created_at < ms.month_start + interval '1 month') AS homes_participating,
      (SELECT count(*) FROM public.skills s WHERE s.status = 'published' AND s.created_at < ms.month_start + interval '1 month') AS skills_offered,
      (SELECT count(DISTINCT user_id) FROM public.member_earnings_ledger WHERE kind = 'referral' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS referral_earners,
      (SELECT count(DISTINCT user_id) FROM public.member_earnings_ledger WHERE kind = 'contribution' AND period_month = to_char(ms.month_start,'YYYY-MM')) AS contribution_earners,
      (SELECT count(DISTINCT ar.referred_user_id) FROM public.affiliate_referrals ar
         WHERE ar.created_at >= ms.month_start AND ar.created_at < ms.month_start + interval '1 month'
         AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = ar.referred_user_id AND m.active)) AS paying_members_acquired,
      -- MRR estimate from real paid amounts: latest monthly avg × active monthly + avg annual/12 × active annual
      (
        coalesce((
          SELECT round(avg(p.amount_cents))::int
          FROM public.payments p
          WHERE p.status = 'paid' AND coalesce(p.metadata->>'test','false') <> 'true'
            AND p.purpose = 'membership_monthly'
            AND p.created_at < ms.month_start + interval '1 month'
            AND p.created_at >= ms.month_start - interval '2 months'
        ), 0)
        * (SELECT count(*) FROM public.memberships m WHERE m.active AND m.kind = 'monthly' AND m.created_at < ms.month_start + interval '1 month')
      )
      + (
        coalesce((
          SELECT round(avg(p.amount_cents) / 12.0)::int
          FROM public.payments p
          WHERE p.status = 'paid' AND coalesce(p.metadata->>'test','false') <> 'true'
            AND p.purpose = 'membership_annual'
            AND p.created_at < ms.month_start + interval '1 month'
        ), 0)
        * (SELECT count(DISTINCT p.user_id) FROM public.payments p WHERE p.status='paid' AND coalesce(p.metadata->>'test','false')<>'true' AND p.purpose='membership_annual' AND p.created_at >= (ms.month_start + interval '1 month' - interval '1 year') AND p.created_at < ms.month_start + interval '1 month')
      ) AS mrr_cents
    FROM month_series ms
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'monthlyInvoices', monthly_invoices, 'annualInvoices', annual_invoices, 'lifetimeInvoices', lifetime_invoices,
    'monthlyCashCents', monthly_cash_cents, 'annualCashCents', annual_cash_cents, 'lifetimeCashCents', lifetime_cash_cents,
    'discountCents', discount_cents, 'refundCents', refund_cents, 'chargebackCents', chargeback_cents,
    'taxCents', tax_cents, 'processingFeeCents', processing_fee_cents,
    'otherRevenueCents', other_revenue_cents, 'expenses', expenses, 'budgets', budgets,
    'depreciationCents', 0, 'interestCents', 0, 'taxProvisionCents', 0,
    'referralApprovedCents', referral_approved_cents, 'referralPendingCents', referral_pending_cents, 'referralPaidCents', referral_paid_cents,
    'contributorApprovedCents', contributor_approved_cents, 'contributorPaidCents', contributor_paid_cents,
    'points', points, 'newMembers', new_members, 'eventsCreated', events_created, 'eventsCompleted', events_completed,
    'creditsIssued', credits_issued, 'creditsRedeemed', credits_redeemed, 'creditsExchanged', skill_exchanges,
    'hostingNights', hosting_nights, 'completedStays', completed_stays, 'skillExchanges', skill_exchanges,
    'registered', registered, 'payingMonthly', paying_monthly, 'payingAnnual', paying_annual, 'payingLifetime', paying_lifetime,
    'trials', trials, 'homesParticipating', homes_participating, 'skillsOffered', skills_offered,
    'referralEarners', referral_earners, 'contributionEarners', contribution_earners, 'payingMembersAcquired', paying_members_acquired,
    'mrrCents', mrr_cents
  ) ORDER BY id) INTO v_months
  FROM per_month;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pr.id, 'firstName', pr.display_name, 'optedIn', pr.show_on_referral_leaderboard,
    'initials', upper(left(coalesce(pr.display_name, '?'), 1)),
    'byMonth', (
      SELECT coalesce(jsonb_object_agg(period_month, jsonb_build_object(
        'referrals', (SELECT count(*) FROM public.affiliate_referrals ar2 JOIN public.affiliates af2 ON af2.id = ar2.affiliate_id WHERE af2.user_id = pr.id AND to_char(ar2.created_at,'YYYY-MM') = mel.period_month),
        'approvedCents', mel.approved_cents, 'pendingCents', mel.pending_cents
      )), '{}'::jsonb)
      FROM (
        SELECT period_month,
          sum(amount_cents) FILTER (WHERE status = 'approved' OR status = 'paid') AS approved_cents,
          sum(amount_cents) FILTER (WHERE status = 'estimated') AS pending_cents
        FROM public.member_earnings_ledger WHERE user_id = pr.id AND kind IN ('referral','contribution') GROUP BY period_month
      ) mel
    )
  )), '[]'::jsonb) INTO v_earners
  FROM public.profiles pr
  WHERE EXISTS (SELECT 1 FROM public.member_earnings_ledger mel WHERE mel.user_id = pr.id);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', coalesce(ref::text, exp::text),
    'date', to_char(coalesce(p_date, e_date), 'YYYY-MM-DD'),
    'type', row_type, 'reference', ref, 'category', category,
    'grossCents', gross,
    'feeCents', coalesce(fee, 0),
    'netCents', gross - coalesce(fee, 0),
    'allocation', allocation, 'settlement', settlement, 'source', source
  ) ORDER BY coalesce(p_date, e_date) DESC), '[]'::jsonb) INTO v_ledger
  FROM (
    SELECT * FROM (
      SELECT p.id AS ref, NULL::uuid AS exp, p.created_at AS p_date, NULL::timestamptz AS e_date,
        'Membership receipt' AS row_type, p.purpose AS category, p.amount_cents AS gross,
        CASE WHEN (p.metadata->>'processing_fee_cents') ~ '^-?\d+$' THEN (p.metadata->>'processing_fee_cents')::int ELSE 0 END AS fee,
        'Eligible revenue' AS allocation, 'Recorded' AS settlement, 'Stripe' AS source
      FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true'
      UNION ALL
      SELECT NULL::uuid, ce.id, NULL::timestamptz, ce.created_at,
        'Expense', ce.category, -ce.amount_cents, 0, 'Operating cost', 'Recorded', 'Expense books'
      FROM public.company_expenses ce
    ) rows
    ORDER BY coalesce(p_date, e_date) DESC
    LIMIT 500
  ) capped;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'group', stakeholder_group, 'unitsCount', units_count, 'percentage', percentage, 'isVerified', is_verified
  )), '[]'::jsonb) INTO v_ownership
  FROM public.company_equity_cap_table;

  RETURN jsonb_build_object(
    'months', coalesce(v_months, '[]'::jsonb),
    'earners', v_earners,
    'ledger', v_ledger,
    'ownership', v_ownership,
    'today', v_today,
    'openingCashCents', v_opening
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_accounting_raw(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_accounting_raw(text) TO authenticated;
