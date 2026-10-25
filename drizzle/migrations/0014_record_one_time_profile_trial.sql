ALTER TABLE public.profiles ADD COLUMN trial_started_at timestamptz;

CREATE FUNCTION public.profiles_trial_started_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.trial_started_at IS NOT NULL AND current_user <> 'service_role' THEN
      RAISE EXCEPTION 'Trials must be started through Oka';
    END IF;
  ELSIF NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
    IF current_user <> 'service_role' OR OLD.trial_started_at IS NOT NULL OR NEW.trial_started_at IS NULL THEN
      RAISE EXCEPTION 'An account trial can only be started once';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_trial_started_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_trial_started_guard();