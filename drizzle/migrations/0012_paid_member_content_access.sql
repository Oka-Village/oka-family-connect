CREATE OR REPLACE FUNCTION public.has_member_payment_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND (
  public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND member_status='full')
  OR EXISTS (SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND active AND (kind='founding' OR (kind='monthly' AND current_period_end > now())))
 );
$$;
REVOKE ALL ON FUNCTION public.has_member_payment_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_member_payment_access() TO authenticated, service_role;
COMMENT ON FUNCTION public.has_member_payment_access() IS 'SECURITY DEFINER resolves caller-only verified payment and grandfathering without recursive RLS. No arbitrary user input.';
CREATE OR REPLACE FUNCTION public.is_full_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.profiles WHERE id=auth.uid() AND (member_status='full' OR (member_status='limited' AND now() >= timestamptz '2026-12-01 00:00:00+00' AND public.has_member_payment_access()))
 );
$$;
REVOKE ALL ON FUNCTION public.is_full_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_full_member() TO authenticated, service_role;
CREATE POLICY paid_member_content_read ON public.events AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.houses AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.skills AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.event_locations AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.event_rsvps AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.bookings AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.skill_session_requests AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.appreciation_letters AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.favorites AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.reflections AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());
CREATE POLICY paid_member_content_read ON public.credit_ledger AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_member_payment_access());