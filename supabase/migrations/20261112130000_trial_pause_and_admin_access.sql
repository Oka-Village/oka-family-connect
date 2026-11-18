-- Matches drizzle 0022_trial_pause_and_admin_access.
-- Trials pause until the December 1 launch; admins may grant member-specific access.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS complimentary_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.trial_ends_at IS 'Optional admin override for the standard launch-aware seven-day trial.';
COMMENT ON COLUMN public.profiles.complimentary_access IS 'Admin-granted free member access; independent of stored status and payments.';

-- New access fields are never writable through an ordinary member profile update.
CREATE OR REPLACE FUNCTION public.profiles_trial_access_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.trial_ends_at IS NOT NULL OR NEW.complimentary_access THEN
      RAISE EXCEPTION 'Only admins can grant trial or complimentary access';
    END IF;
  ELSIF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.complimentary_access IS DISTINCT FROM OLD.complimentary_access THEN
    RAISE EXCEPTION 'Only admins can change trial or complimentary access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_trial_access_guard ON public.profiles;
CREATE TRIGGER profiles_trial_access_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_trial_access_guard();

-- A custom admin end overrides the standard rule. Otherwise counting starts at
-- the later of the actual trial start and December 1, 2026 at midnight UTC.
CREATE OR REPLACE FUNCTION public.has_trial_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND (
      (p.trial_ends_at IS NOT NULL AND now() < p.trial_ends_at)
      OR (
        p.trial_ends_at IS NULL
        AND p.trial_started_at IS NOT NULL
        AND now() < greatest(p.trial_started_at, timestamptz '2026-12-01 00:00:00+00') + interval '7 days'
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.has_trial_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_trial_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_member_payment_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
 SELECT auth.uid() IS NOT NULL AND (
  public.is_staff(auth.uid())
  OR public.has_trial_access(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND (p.member_status = 'full' OR p.complimentary_access)
  )
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid() AND m.active
      AND (m.kind = 'founding' OR (m.kind = 'monthly' AND m.current_period_end > now()))
  )
 );
$$;

CREATE OR REPLACE FUNCTION public.is_full_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
 SELECT auth.uid() IS NOT NULL AND (
  public.has_trial_access(auth.uid())
  OR EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id = auth.uid() AND (
    p.complimentary_access
    OR p.member_status = 'full'
    OR (p.member_status = 'limited' AND now() >= timestamptz '2026-12-01 00:00:00+00' AND public.has_member_payment_access())
   )
  )
 );
$$;
