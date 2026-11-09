DROP POLICY IF EXISTS paid_member_content_read ON public.skills;
CREATE POLICY paid_member_content_read ON public.skills AS RESTRICTIVE FOR SELECT TO authenticated
USING (has_member_payment_access() OR owner_id = auth.uid() OR status = 'published');
DROP POLICY IF EXISTS paid_member_content_read ON public.houses;
CREATE POLICY paid_member_content_read ON public.houses AS RESTRICTIVE FOR SELECT TO authenticated
USING (has_member_payment_access() OR owner_id = auth.uid() OR status = 'published');