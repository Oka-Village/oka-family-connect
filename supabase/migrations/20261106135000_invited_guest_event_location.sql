-- An invited guest who is going may read that one event's video link.
-- A member who RSVPs without an invite, and every other event, stay payment-gated.

DROP POLICY IF EXISTS paid_member_content_read ON public.event_locations;
CREATE POLICY paid_member_content_read ON public.event_locations
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_member_payment_access()
    OR public.is_event_manager(event_id)
    OR (
      public.has_event_rsvp(event_id, true)
      AND EXISTS (
        SELECT 1 FROM public.event_link_visits v
        WHERE v.event_id = event_locations.event_id
          AND v.user_id = auth.uid()
      )
    )
  );
