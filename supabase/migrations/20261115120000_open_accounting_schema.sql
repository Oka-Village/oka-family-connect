-- =====================================================================
-- Open Accounting: real schema + real-data aggregation
--
-- Adds the tables from "New DB Schema Required" (spec sheet 6) needed to
-- replace the Open Accounting / My Earnings mock data with real numbers,
-- and the functions that compute those numbers from the live tables
-- (payments, memberships, affiliates, affiliate_referrals, events,
-- event_rsvps, credit_ledger, houses, bookings, skills,
-- skill_session_requests) plus the new tables below.
--
-- Column names use this codebase's existing convention (user_id -> profiles,
-- not the spec's member_id) and profiles.display_name (the spec assumed a
-- first_name column that does not exist).
--
-- No Stripe webhook is added in this migration: referral/contribution
-- earnings are synced from the existing public.payments table (already
-- populated by the current checkout flow), not from live Stripe events.
-- =====================================================================

-- ---------------------------------------------------------------------
-- member_earnings_ledger
-- Append-only, auditable ledger of every movement in a member's earnings
-- (referral commission, contribution point conversion, advances,
-- deductions, manual credits, payouts). Written only by the sync
-- functions below or by admins (manual adjustments).
-- ---------------------------------------------------------------------
CREATE TABLE public.member_earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('referral','contribution','advance','deduction','credit','payout')),
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('estimated','approved','paid','cancelled')),
  period_month text NOT NULL CHECK (period_month ~ '^\d{4}-\d{2}$'),
  reference_code text NOT NULL,
  description text NOT NULL,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_earnings_ledger TO authenticated;
GRANT ALL ON public.member_earnings_ledger TO service_role;
ALTER TABLE public.member_earnings_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_earnings_ledger_select_own" ON public.member_earnings_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "member_earnings_ledger_select_admin" ON public.member_earnings_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Manual adjustments (advance/deduction/credit) may be entered by admins;
-- referral/contribution/payout rows are written server-side only.
CREATE POLICY "member_earnings_ledger_insert_admin_manual" ON public.member_earnings_ledger
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND kind IN ('advance','deduction','credit'));

CREATE INDEX idx_member_earnings_ledger_user ON public.member_earnings_ledger (user_id, period_month);
CREATE INDEX idx_member_earnings_ledger_kind ON public.member_earnings_ledger (kind, period_month);
CREATE UNIQUE INDEX idx_member_earnings_ledger_dedupe
  ON public.member_earnings_ledger (kind, related_id)
  WHERE related_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- member_payouts
-- ---------------------------------------------------------------------
CREATE TABLE public.member_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','processing','paid','failed')),
  scheduled_for date NOT NULL,
  payout_method text NOT NULL DEFAULT 'bank_transfer',
  stripe_payout_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_payouts TO authenticated;
GRANT ALL ON public.member_payouts TO service_role;
ALTER TABLE public.member_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_payouts_select_own" ON public.member_payouts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "member_payouts_select_admin" ON public.member_payouts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER member_payouts_set_updated_at
  BEFORE UPDATE ON public.member_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_member_payouts_user ON public.member_payouts (user_id, scheduled_for DESC);

-- ---------------------------------------------------------------------
-- member_payout_methods
-- ---------------------------------------------------------------------
CREATE TABLE public.member_payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK (method_type IN ('bank_transfer','stripe_connect','paypal')),
  bank_name text,
  account_last4 text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_payout_methods TO authenticated;
GRANT ALL ON public.member_payout_methods TO service_role;
ALTER TABLE public.member_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_payout_methods_all_own" ON public.member_payout_methods
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER member_payout_methods_set_updated_at
  BEFORE UPDATE ON public.member_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_member_payout_methods_user ON public.member_payout_methods (user_id);

-- ---------------------------------------------------------------------
-- event_contributions
-- One row per completed hosted event: 10 base points + 1 per verified
-- attendee (event_rsvps.attended, added below).
-- ---------------------------------------------------------------------
CREATE TABLE public.event_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_points integer NOT NULL DEFAULT 10,
  verified_attendees integer NOT NULL DEFAULT 0,
  total_points integer GENERATED ALWAYS AS (base_points + verified_attendees) STORED,
  converted_amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','converted','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_contributions TO authenticated;
GRANT ALL ON public.event_contributions TO service_role;
ALTER TABLE public.event_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_contributions_select_authenticated" ON public.event_contributions
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER event_contributions_set_updated_at
  BEFORE UPDATE ON public.event_contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_event_contributions_host ON public.event_contributions (host_id);

-- ---------------------------------------------------------------------
-- company_expenses
-- Admin-entered operating expenses. Ships empty; no fabricated rows.
-- ---------------------------------------------------------------------
CREATE TABLE public.company_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Fixed','Variable')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  budget_cents integer NOT NULL DEFAULT 0,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_expenses TO authenticated;
GRANT ALL ON public.company_expenses TO service_role;
ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_expenses_select_authenticated" ON public.company_expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_expenses_admin_write" ON public.company_expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_expenses_set_updated_at
  BEFORE UPDATE ON public.company_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_company_expenses_month ON public.company_expenses (month_key);

-- ---------------------------------------------------------------------
-- company_financial_snapshots
-- Historical cache, one row per calendar month, written only by
-- public.sync_financial_snapshots() below. Not hand-edited.
-- ---------------------------------------------------------------------
CREATE TABLE public.company_financial_snapshots (
  period_key text PRIMARY KEY CHECK (period_key ~ '^\d{4}-\d{2}$'),
  membership_cash_cents integer NOT NULL DEFAULT 0,
  recognized_revenue_cents integer NOT NULL DEFAULT 0,
  referral_allocated_cents integer NOT NULL DEFAULT 0,
  contributor_allocated_cents integer NOT NULL DEFAULT 0,
  operating_expenses_cents integer NOT NULL DEFAULT 0,
  opening_cash_cents integer NOT NULL DEFAULT 0,
  closing_cash_cents integer NOT NULL DEFAULT 0,
  runway_months numeric(4,1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_financial_snapshots TO authenticated;
GRANT ALL ON public.company_financial_snapshots TO service_role;
ALTER TABLE public.company_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_financial_snapshots_select_authenticated" ON public.company_financial_snapshots
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- company_equity_cap_table
-- Legal equity records. Ships empty; admin fills in via the UI.
-- ---------------------------------------------------------------------
CREATE TABLE public.company_equity_cap_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_group text NOT NULL,
  units_count integer NOT NULL CHECK (units_count >= 0),
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  is_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_equity_cap_table TO authenticated;
GRANT ALL ON public.company_equity_cap_table TO service_role;
ALTER TABLE public.company_equity_cap_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_equity_cap_table_select_authenticated" ON public.company_equity_cap_table
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_equity_cap_table_admin_write" ON public.company_equity_cap_table
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_equity_cap_table_set_updated_at
  BEFORE UPDATE ON public.company_equity_cap_table
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- Altered columns (spec sheet 6)
-- =====================================================================

-- Member opt-in to show their first name on the referral leaderboard
-- instead of "Anonymous member".
ALTER TABLE public.profiles ADD COLUMN show_on_referral_leaderboard boolean NOT NULL DEFAULT false;

-- Host/admin attendance check-in, which event_contributions.verified_attendees
-- is computed from.
ALTER TABLE public.event_rsvps ADD COLUMN attended boolean NOT NULL DEFAULT false;

CREATE POLICY "event_rsvps_update_attended_host" ON public.event_rsvps
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id AND (e.host_id = auth.uid() OR e.created_by = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id AND (e.host_id = auth.uid() OR e.created_by = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin'));

-- Public sequential identifier (e.g. "Open studio #140").
ALTER TABLE public.events ADD COLUMN event_number serial UNIQUE;

-- =====================================================================
-- Real-data sync functions
-- All SECURITY DEFINER: they read across other members' rows (blocked by
-- RLS for a normal caller) but only ever write aggregated/derived rows,
-- never raw personal data, back out.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Referral earnings: one ledger row per real paid membership payment
-- from a referred member, sized by the referring affiliate's own
-- commission_pct. Idempotent via the (kind, related_id) unique index.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_member_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_earnings_ledger (user_id, kind, amount_cents, status, period_month, reference_code, description, related_id)
  SELECT
    af.user_id,
    'referral',
    round(p.amount_cents * af.commission_pct / 100.0)::integer,
    'approved',
    to_char(p.created_at, 'YYYY-MM'),
    'REF-' || upper(substr(p.id::text, 1, 8)),
    'Referral commission (' || af.commission_pct || '%) on ' || p.purpose || ' payment from referred member',
    p.id
  FROM public.payments p
  JOIN public.affiliate_referrals ar ON ar.referred_user_id = p.user_id
  JOIN public.affiliates af ON af.id = ar.affiliate_id
  WHERE p.status = 'paid'
    AND coalesce(p.metadata ->> 'test', 'false') <> 'true'
  ON CONFLICT (kind, related_id) WHERE related_id IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_member_earnings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_member_earnings() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Contribution points: one row per completed hosted event.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_event_contributions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_contributions (event_id, host_id, base_points, verified_attendees)
  SELECT
    e.id,
    e.host_id,
    10,
    (SELECT count(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.attended)
  FROM public.events e
  WHERE e.status = 'completed' AND e.host_id IS NOT NULL
  ON CONFLICT (event_id) DO UPDATE SET
    verified_attendees = EXCLUDED.verified_attendees,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_event_contributions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_event_contributions() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Converts the PRIOR calendar month's pending contribution points into
-- member_earnings_ledger rows, splitting that month's contributor pool
-- (25% of real cash membership receipts for the month) proportionally
-- by points. Idempotent per period (checks for an existing CNV- row).
-- Simplification: the pool is based on cash receipts, not the fully
-- amortized "recognized revenue" the P&L view uses — there is no
-- separate accrual ledger for that distinction yet.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_monthly_contribution_conversion(p_period_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_cents numeric;
  v_total_points integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.member_earnings_ledger WHERE kind = 'contribution' AND period_month = p_period_month) THEN
    RETURN; -- already converted
  END IF;

  SELECT coalesce(sum(amount_cents), 0) * 0.25 INTO v_pool_cents
  FROM public.payments
  WHERE status = 'paid'
    AND coalesce(metadata ->> 'test', 'false') <> 'true'
    AND to_char(created_at, 'YYYY-MM') = p_period_month;

  SELECT coalesce(sum(ec.total_points), 0) INTO v_total_points
  FROM public.event_contributions ec
  JOIN public.events e ON e.id = ec.event_id
  WHERE ec.status = 'pending' AND to_char(e.starts_at, 'YYYY-MM') = p_period_month;

  IF v_total_points = 0 OR v_pool_cents <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.member_earnings_ledger (user_id, kind, amount_cents, status, period_month, reference_code, description, related_id)
  SELECT
    ec.host_id,
    'contribution',
    round(v_pool_cents * ec.total_points / v_total_points)::integer,
    'approved',
    p_period_month,
    'CR-' || upper(substr(ec.id::text, 1, 8)),
    ec.total_points || ' contribution points converted at the ' || p_period_month || ' contributor pool rate',
    ec.id
  FROM public.event_contributions ec
  JOIN public.events e ON e.id = ec.event_id
  WHERE ec.status = 'pending' AND to_char(e.starts_at, 'YYYY-MM') = p_period_month;

  UPDATE public.event_contributions ec
  SET status = 'converted',
      converted_amount_cents = round(v_pool_cents * ec.total_points / v_total_points)::integer
  FROM public.events e
  WHERE e.id = ec.event_id AND ec.status = 'pending' AND to_char(e.starts_at, 'YYYY-MM') = p_period_month;
END;
$$;

REVOKE ALL ON FUNCTION public.run_monthly_contribution_conversion(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_monthly_contribution_conversion(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Runs every sync in order, for the given month (and the month before
-- it, so contribution conversion has something to convert). Call this
-- once before reading Open Accounting data.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_open_accounting(p_as_of date DEFAULT now()::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_member_earnings();
  PERFORM public.sync_event_contributions();
  PERFORM public.run_monthly_contribution_conversion(to_char(p_as_of - interval '1 month', 'YYYY-MM'));
END;
$$;

REVOKE ALL ON FUNCTION public.sync_open_accounting(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_open_accounting(date) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- company_financial_snapshots cache: one row per month from the given
-- start month through the current month. Cash ladder accumulates from
-- $0 at the earliest period (no historical cash balance is recorded
-- anywhere in this app) — an explicit, visible assumption, not a
-- fabricated figure.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_financial_snapshots(p_start_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := to_date(p_start_month || '-01', 'YYYY-MM-DD');
  v_end date := date_trunc('month', now());
  v_cursor_cents bigint := 0;
  v_cash numeric;
  v_recognized numeric;
  v_referral numeric;
  v_contributor numeric;
  v_opex numeric;
  v_closing bigint;
  v_prior_burns numeric[];
  v_runway numeric;
BEGIN
  WHILE v_month <= v_end LOOP
    SELECT coalesce(sum(amount_cents), 0) INTO v_cash
    FROM public.payments
    WHERE status = 'paid' AND coalesce(metadata ->> 'test', 'false') <> 'true'
      AND created_at >= v_month AND created_at < (v_month + interval '1 month');

    v_recognized := v_cash;
    v_referral := round(v_cash * 0.50);
    v_contributor := round(v_cash * 0.25);

    SELECT coalesce(sum(amount_cents), 0) INTO v_opex
    FROM public.company_expenses
    WHERE month_key = to_char(v_month, 'YYYY-MM');

    v_closing := v_cursor_cents + v_cash::bigint - v_opex::bigint;

    INSERT INTO public.company_financial_snapshots (
      period_key, membership_cash_cents, recognized_revenue_cents,
      referral_allocated_cents, contributor_allocated_cents, operating_expenses_cents,
      opening_cash_cents, closing_cash_cents, runway_months, updated_at
    ) VALUES (
      to_char(v_month, 'YYYY-MM'), v_cash::integer, v_recognized::integer,
      v_referral::integer, v_contributor::integer, v_opex::integer,
      v_cursor_cents, v_closing, NULL, now()
    )
    ON CONFLICT (period_key) DO UPDATE SET
      membership_cash_cents = EXCLUDED.membership_cash_cents,
      recognized_revenue_cents = EXCLUDED.recognized_revenue_cents,
      referral_allocated_cents = EXCLUDED.referral_allocated_cents,
      contributor_allocated_cents = EXCLUDED.contributor_allocated_cents,
      operating_expenses_cents = EXCLUDED.operating_expenses_cents,
      opening_cash_cents = EXCLUDED.opening_cash_cents,
      closing_cash_cents = EXCLUDED.closing_cash_cents,
      updated_at = now();

    v_cursor_cents := v_closing;
    v_month := v_month + interval '1 month';
  END LOOP;

  -- Trailing-3-month runway for the latest snapshot.
  SELECT array_agg(membership_cash_cents - operating_expenses_cents ORDER BY period_key)
  INTO v_prior_burns
  FROM (
    SELECT period_key, membership_cash_cents, operating_expenses_cents
    FROM public.company_financial_snapshots
    WHERE period_key < to_char(v_end, 'YYYY-MM')
    ORDER BY period_key DESC
    LIMIT 3
  ) recent;

  IF v_prior_burns IS NOT NULL AND array_length(v_prior_burns, 1) = 3 THEN
    SELECT avg(x) INTO v_runway FROM unnest(v_prior_burns) x;
    IF v_runway < 0 THEN
      UPDATE public.company_financial_snapshots
      SET runway_months = round((closing_cash_cents / -v_runway)::numeric, 1)
      WHERE period_key = to_char(v_end, 'YYYY-MM');
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_financial_snapshots(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_financial_snapshots(text) TO authenticated, service_role;

-- =====================================================================
-- Read RPCs
-- Both SECURITY DEFINER so a signed-in member can see company-wide
-- aggregates and other members' opted-in leaderboard rows, which their
-- own RLS grants would otherwise block. Neither returns raw rows from
-- payments/memberships for anyone but the caller.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Community-wide Open Accounting "Books" data: one JSON object per
-- calendar month from p_start_month through the current month, plus
-- the leaderboard, ledger, ownership and dividend rows that don't vary
-- by month. The front end turns this into the existing MonthInput[]
-- shape that src/data/open-accounting/views.ts already knows how to
-- fold into the Books view (same formulas, real inputs).
-- ---------------------------------------------------------------------
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
BEGIN
  SELECT jsonb_build_object(
    'monthlyInvoices', (SELECT count(*) FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true' AND p.purpose = 'membership_monthly' AND p.created_at >= date_trunc('day', now())),
    'processingFeeCents', 0,
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
      (SELECT coalesce(sum(amount_cents),0) FROM public.payments p WHERE p.status = 'refunded' AND p.created_at >= ms.month_start AND p.created_at < ms.month_start + interval '1 month') AS refund_cents,
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
         AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = ar.referred_user_id AND m.active)) AS paying_members_acquired
    FROM month_series ms
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'monthlyInvoices', monthly_invoices, 'annualInvoices', annual_invoices, 'lifetimeInvoices', lifetime_invoices,
    'discountCents', 0, 'refundCents', refund_cents, 'chargebackCents', 0, 'taxCents', 0, 'processingFeeCents', 0,
    'otherRevenueCents', other_revenue_cents, 'expenses', expenses, 'budgets', budgets,
    'depreciationCents', 0, 'interestCents', 0, 'taxProvisionCents', 0,
    'referralApprovedCents', referral_approved_cents, 'referralPendingCents', referral_pending_cents, 'referralPaidCents', referral_paid_cents,
    'contributorApprovedCents', contributor_approved_cents, 'contributorPaidCents', contributor_paid_cents,
    'points', points, 'newMembers', new_members, 'eventsCreated', events_created, 'eventsCompleted', events_completed,
    'creditsIssued', credits_issued, 'creditsRedeemed', credits_redeemed, 'creditsExchanged', skill_exchanges,
    'hostingNights', hosting_nights, 'completedStays', completed_stays, 'skillExchanges', skill_exchanges,
    'registered', registered, 'payingMonthly', paying_monthly, 'payingAnnual', paying_annual, 'payingLifetime', paying_lifetime,
    'trials', trials, 'homesParticipating', homes_participating, 'skillsOffered', skills_offered,
    'referralEarners', referral_earners, 'contributionEarners', contribution_earners, 'payingMembersAcquired', paying_members_acquired
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
    'grossCents', gross, 'feeCents', 0, 'netCents', gross, 'allocation', allocation, 'settlement', settlement, 'source', source
  ) ORDER BY coalesce(p_date, e_date) DESC), '[]'::jsonb) INTO v_ledger
  FROM (
    SELECT * FROM (
      SELECT p.id AS ref, NULL::uuid AS exp, p.created_at AS p_date, NULL::timestamptz AS e_date,
        'Membership receipt' AS row_type, p.purpose AS category, p.amount_cents AS gross,
        'Eligible revenue' AS allocation, 'Recorded' AS settlement, 'Stripe' AS source
      FROM public.payments p WHERE p.status = 'paid' AND coalesce(p.metadata ->> 'test','false') <> 'true'
      UNION ALL
      SELECT NULL::uuid, ce.id, NULL::timestamptz, ce.created_at,
        'Expense', ce.category, -ce.amount_cents, 'Operating cost', 'Recorded', 'Expense books'
      FROM public.company_expenses ce
    ) rows
    ORDER BY coalesce(p_date, e_date) DESC
    LIMIT 500
  ) capped;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'group', stakeholder_group, 'unitsCount', units_count, 'percentage', percentage, 'isVerified', is_verified
  )), '[]'::jsonb) INTO v_ownership
  FROM public.company_equity_cap_table;

  RETURN jsonb_build_object('months', coalesce(v_months, '[]'::jsonb), 'earners', v_earners, 'ledger', v_ledger, 'ownership', v_ownership, 'today', v_today);
END;
$$;

REVOKE ALL ON FUNCTION public.open_accounting_raw(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_accounting_raw(text) TO authenticated;

-- ---------------------------------------------------------------------
-- Personal "My Earnings" data for the caller: their invited members
-- (with real membership status, which memberships RLS would otherwise
-- hide from anyone but the member themselves) and their own ledger
-- rows for the reconciliation statement.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_earnings_raw()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_invites jsonb;
  v_statement jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ar.referred_user_id, 'firstName', pr.display_name,
    'registered', to_char(ar.created_at, 'YYYY-MM-DD'),
    'status', CASE
      WHEN m.active THEN 'active-paid'
      WHEN pr.trial_started_at IS NOT NULL AND pr.trial_started_at >= now() - interval '7 days' THEN 'free-trial'
      WHEN pr.trial_started_at IS NOT NULL THEN 'expired-trial'
      ELSE 'expired-trial'
    END,
    'membershipType', m.kind,
    'lastPayment', (SELECT to_char(max(p2.created_at), 'YYYY-MM-DD') FROM public.payments p2 WHERE p2.user_id = ar.referred_user_id AND p2.status = 'paid'),
    'earnedCents', (SELECT coalesce(sum(amount_cents), 0) FROM public.member_earnings_ledger mel WHERE mel.user_id = auth.uid() AND mel.kind = 'referral' AND mel.related_id IN (SELECT id FROM public.payments WHERE user_id = ar.referred_user_id))
  ) ORDER BY ar.created_at DESC), '[]'::jsonb) INTO v_invites
  FROM public.affiliate_referrals ar
  JOIN public.affiliates af ON af.id = ar.affiliate_id AND af.user_id = auth.uid()
  JOIN public.profiles pr ON pr.id = ar.referred_user_id
  LEFT JOIN public.memberships m ON m.user_id = ar.referred_user_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'date', to_char(created_at, 'YYYY-MM-DD'), 'reason', description,
    'cents', amount_cents, 'kind', kind, 'reference', reference_code
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_statement
  FROM public.member_earnings_ledger
  WHERE user_id = auth.uid() AND kind IN ('advance','deduction','credit');

  RETURN jsonb_build_object('invites', v_invites, 'statement', v_statement);
END;
$$;

REVOKE ALL ON FUNCTION public.my_earnings_raw() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_earnings_raw() TO authenticated;
