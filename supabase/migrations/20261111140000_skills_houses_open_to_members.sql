-- Every member can save and browse skills/houses without payment.
-- INSERT ... RETURNING checks SELECT policies, and paid_member_content_read is restrictive.
-- Owner rows and published listings stay visible; matches drizzle 0018.

DROP POLICY IF EXISTS paid_member_content_read ON public.skills;
CREATE POLICY paid_member_content_read ON public.skills
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR owner_id = auth.uid()
    OR status = 'published'
  );

DROP POLICY IF EXISTS paid_member_content_read ON public.houses;
CREATE POLICY paid_member_content_read ON public.houses
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR owner_id = auth.uid()
    OR status = 'published'
  );
