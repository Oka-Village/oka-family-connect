-- Matches drizzle 0021_event_rsvp_owner_and_host_read.
DROP POLICY IF EXISTS paid_member_content_read ON public.event_rsvps;
CREATE POLICY paid_member_content_read ON public.event_rsvps
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR user_id = auth.uid()
    OR public.is_event_manager(event_id)
  );
