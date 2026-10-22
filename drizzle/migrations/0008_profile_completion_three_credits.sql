CREATE OR REPLACE FUNCTION public.award_profile_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.profile_completed AND (TG_OP = 'INSERT' OR NOT OLD.profile_completed) THEN
    INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, note)
    VALUES (NEW.id, 3, 'profile_completion', 'profile', 'Welcome gift for completing your profile')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.award_profile_completion() FROM PUBLIC, anon, authenticated;

-- Top up members who already received the earlier +2 gift.
INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, note)
SELECT user_id, 1, 'manual_adjustment', 'profile', 'Profile completion gift raised to 3'
FROM public.credit_ledger WHERE reason = 'profile_completion' AND delta = 2;