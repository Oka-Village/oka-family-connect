-- Re-derive profile_completed for existing rows (the earlier recompute was blocked by the
-- "stays true" rule, leaving skipped-onboarding profiles marked complete).
ALTER TABLE public.profiles DISABLE TRIGGER profiles_set_completed;
ALTER TABLE public.profiles DISABLE TRIGGER profiles_award_completion;
UPDATE public.profiles p SET profile_completed = public.profile_is_complete(p);
ALTER TABLE public.profiles ENABLE TRIGGER profiles_set_completed;
ALTER TABLE public.profiles ENABLE TRIGGER profiles_award_completion;
-- Award anyone who is genuinely complete right now (idempotent).
INSERT INTO public.credit_ledger (user_id, delta, reason, reference_type, note)
SELECT id, 2, 'profile_completion', 'profile', 'Welcome gift for completing your profile'
FROM public.profiles WHERE profile_completed
ON CONFLICT DO NOTHING;