-- A member must be able to insert a proposal and read that row back.
-- INSERT ... RETURNING checks SELECT policies, and paid_member_content_read is restrictive.
-- Own rows stay visible without payment access. Everyone else's events stay payment-gated.

DROP POLICY IF EXISTS paid_member_content_read ON public.events;
CREATE POLICY paid_member_content_read ON public.events
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR created_by = auth.uid()
    OR host_id = auth.uid()
  );

DROP POLICY IF EXISTS paid_member_content_read ON public.event_locations;
CREATE POLICY paid_member_content_read ON public.event_locations
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR public.is_event_manager(event_id)
  );
