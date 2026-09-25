-- The award trigger must fire even when profile_completed is set by the BEFORE trigger
-- (UPDATE OF <col> only fires when the client's SET list names the column).
DROP TRIGGER profiles_award_completion ON public.profiles;
CREATE TRIGGER profiles_award_completion AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.award_profile_completion();