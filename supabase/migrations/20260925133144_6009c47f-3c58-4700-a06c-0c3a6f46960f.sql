-- =====================================================================
-- Oka foundation schema
-- Social infrastructure for a global chosen family.
-- One clean migration: types, tables, grants, RLS, policies, indexes,
-- triggers and views.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared helper: updated_at maintenance
-- Not SECURITY DEFINER (runs with the caller's rights, which is enough).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- profiles
-- One row per auth user. Created automatically on signup.
-- =====================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  photo_url text,
  location text,
  age_range text,
  profession text,
  relationship_status text,
  intentions text[] NOT NULL DEFAULT '{}',
  gift_excited_to_give text,
  gift_loved_gestures text,
  skill_tags text[] NOT NULL DEFAULT '{}',
  travel_frequent text[] NOT NULL DEFAULT '{}',
  travel_desired text[] NOT NULL DEFAULT '{}',
  membership_tier text NOT NULL DEFAULT 'free'
    CHECK (membership_tier IN ('free','full')),
  profile_completed boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_profiles_membership_tier ON public.profiles (membership_tier);
CREATE INDEX idx_profiles_created_at ON public.profiles (created_at DESC);

-- =====================================================================
-- user_roles  (authorization lives here, never on the profile row)
-- =====================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','facilitator','affiliate','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_roles_user_id ON public.user_roles (user_id);

-- SECURITY DEFINER is required here: policies must read user_roles while
-- evaluating access for a caller who cannot read other users' role rows.
-- Without it, RLS on user_roles would recurse into itself.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- Signup trigger: create the profile row and grant the default role.
-- SECURITY DEFINER is required: the trigger runs as the auth service on
-- rows in auth.users and must insert into RLS-protected public tables.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- events
-- =====================================================================
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL
    CHECK (event_type IN ('gathering','workshop','pod_session','meditation','retreat')),
  format text NOT NULL CHECK (format IN ('virtual','in_person')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text,
  venue_address text,
  video_link text,
  capacity int CHECK (capacity > 0),
  host_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('draft','pending_approval','published','cancelled','completed')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_published" ON public.events
  FOR SELECT TO authenticated USING (status = 'published');
CREATE POLICY "events_select_own" ON public.events
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = host_id);
CREATE POLICY "events_insert_own" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "events_update_own" ON public.events
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = host_id)
  WITH CHECK (auth.uid() = created_by OR auth.uid() = host_id);
CREATE POLICY "events_delete_own" ON public.events
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "events_admin_all" ON public.events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_events_status_starts_at ON public.events (status, starts_at);
CREATE INDEX idx_events_host_id ON public.events (host_id);
CREATE INDEX idx_events_created_by ON public.events (created_by);

-- =====================================================================
-- event_rsvps
-- =====================================================================
CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going'
    CHECK (status IN ('going','waitlist','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_rsvps_select_own" ON public.event_rsvps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "event_rsvps_select_host" ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND (e.host_id = auth.uid() OR e.created_by = auth.uid())
  ));
CREATE POLICY "event_rsvps_insert_own" ON public.event_rsvps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_rsvps_update_own" ON public.event_rsvps
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_rsvps_delete_own" ON public.event_rsvps
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "event_rsvps_admin_all" ON public.event_rsvps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_event_rsvps_event_id ON public.event_rsvps (event_id);
CREATE INDEX idx_event_rsvps_user_id ON public.event_rsvps (user_id);

-- =====================================================================
-- credit_ledger  (append-only source of truth for credit balances)
-- 1 credit = 1 night stay or 1 hour of service.
-- No UPDATE or DELETE policy exists for anyone: rows are immutable.
-- =====================================================================
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta int NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'hosting_night','pod_completion','profile_completion','workshop_hosting',
    'skill_session_earn','skill_session_spend','booking_lock','booking_spend',
    'booking_refund','manual_adjustment'
  )),
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deliberately no UPDATE/DELETE grant: the ledger is append-only.
GRANT SELECT, INSERT ON public.credit_ledger TO authenticated;
GRANT SELECT, INSERT ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_ledger_select_own" ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "credit_ledger_select_admin" ON public.credit_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Only admins may write entries directly, and only manual adjustments.
-- All other entries are written server-side by trusted code.
CREATE POLICY "credit_ledger_insert_admin_manual" ON public.credit_ledger
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND reason = 'manual_adjustment');

CREATE INDEX idx_credit_ledger_user_created ON public.credit_ledger (user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_reference ON public.credit_ledger (reference_type, reference_id);

-- Balances are always derived, never stored.
CREATE VIEW public.credit_balances
WITH (security_invoker = true) AS
  SELECT user_id, COALESCE(SUM(delta), 0)::bigint AS balance
  FROM public.credit_ledger
  GROUP BY user_id;

GRANT SELECT ON public.credit_balances TO authenticated;
GRANT SELECT ON public.credit_balances TO service_role;

-- =====================================================================
-- skills
-- =====================================================================
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  format text NOT NULL CHECK (format IN ('virtual','in_person')),
  duration_minutes int CHECK (duration_minutes > 0),
  description text,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills_select_published" ON public.skills
  FOR SELECT TO authenticated USING (status = 'published');
CREATE POLICY "skills_select_own" ON public.skills
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "skills_insert_own" ON public.skills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "skills_update_own" ON public.skills
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "skills_delete_own" ON public.skills
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "skills_admin_all" ON public.skills
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER skills_set_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_skills_status ON public.skills (status);
CREATE INDEX idx_skills_owner_id ON public.skills (owner_id);
CREATE INDEX idx_skills_category ON public.skills (category);

-- =====================================================================
-- houses
-- =====================================================================
CREATE TABLE public.houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  property_type text NOT NULL CHECK (property_type IN ('entire_home','private_room')),
  location_text text,
  lat numeric(9,6) CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng numeric(9,6) CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  photos text[] NOT NULL DEFAULT '{}',
  house_rules text,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('draft','pending_approval','published','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.houses TO authenticated;
GRANT ALL ON public.houses TO service_role;
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "houses_select_published" ON public.houses
  FOR SELECT TO authenticated USING (status = 'published');
CREATE POLICY "houses_select_own" ON public.houses
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "houses_insert_own" ON public.houses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "houses_update_own" ON public.houses
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "houses_delete_own" ON public.houses
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "houses_admin_all" ON public.houses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER houses_set_updated_at
  BEFORE UPDATE ON public.houses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_houses_status ON public.houses (status);
CREATE INDEX idx_houses_owner_id ON public.houses (owner_id);

-- =====================================================================
-- affiliates
-- =====================================================================
-- Short, human-shareable invite code. Not SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE DEFAULT public.generate_invite_code(),
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  commission_pct numeric(5,2) NOT NULL DEFAULT 10
    CHECK (commission_pct >= 0 AND commission_pct <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliates_select_own" ON public.affiliates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "affiliates_update_own" ON public.affiliates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "affiliates_admin_all" ON public.affiliates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER affiliates_set_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_affiliates_user_id ON public.affiliates (user_id);
CREATE INDEX idx_affiliates_status ON public.affiliates (status);

-- =====================================================================
-- affiliate_referrals
-- =====================================================================
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_referrals_select_own" ON public.affiliate_referrals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_referrals.affiliate_id AND a.user_id = auth.uid()
  ));
CREATE POLICY "affiliate_referrals_admin_all" ON public.affiliate_referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals (affiliate_id);
CREATE INDEX idx_affiliate_referrals_referred_user_id ON public.affiliate_referrals (referred_user_id);

-- =====================================================================
-- payments  (Stripe structure; keys wired later)
-- =====================================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_cents int CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  purpose text NOT NULL CHECK (purpose IN ('pod','membership_annual','membership_monthly')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payment rows are written by trusted server code only.
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_payments_user_id ON public.payments (user_id);
CREATE UNIQUE INDEX idx_payments_stripe_checkout_session_id
  ON public.payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX idx_payments_status ON public.payments (status);
