-- Published events are browsable by every signed-in member; event locations stay gated separately.
DROP POLICY IF EXISTS paid_member_content_read ON public.events;
CREATE POLICY paid_member_content_read ON public.events
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.has_member_payment_access()
    OR created_by = auth.uid()
    OR host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.event_link_visits v
      WHERE v.event_id = events.id AND v.user_id = auth.uid()
    )
  );