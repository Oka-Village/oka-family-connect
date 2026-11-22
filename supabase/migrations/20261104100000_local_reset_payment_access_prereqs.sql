-- Local `db:reset` applies supabase/migrations before drizzle/migrations.
-- Later supabase files reference payment-access objects that only exist in drizzle
-- on production. Create the minimum prereqs here so a fresh local reset can finish;
-- drizzle migrations then CREATE OR REPLACE / IF NOT EXISTS on top.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_status text;

UPDATE public.profiles
SET member_status = 'full'
WHERE member_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN member_status SET DEFAULT 'limited',
  ALTER COLUMN member_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_member_status_valid'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_member_status_valid
      CHECK (member_status IN ('full', 'limited'));
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

CREATE TABLE IF NOT EXISTS public.memberships (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('founding', 'monthly')),
  active boolean NOT NULL DEFAULT true,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memberships'
      AND policyname = 'memberships_read_own'
  ) THEN
    CREATE POLICY memberships_read_own
      ON public.memberships
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_member_payment_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND member_status = 'full'
    )
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid()
        AND active
        AND (kind = 'founding' OR (kind = 'monthly' AND current_period_end > now()))
    )
  );
$$;

REVOKE ALL ON FUNCTION public.has_member_payment_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_member_payment_access() TO authenticated, service_role;

COMMENT ON FUNCTION public.has_member_payment_access() IS
  'SECURITY DEFINER resolves caller-only verified payment and grandfathering without recursive RLS. No arbitrary user input.';
