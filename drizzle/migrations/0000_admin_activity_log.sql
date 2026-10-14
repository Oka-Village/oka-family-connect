CREATE OR REPLACE FUNCTION public.admin_activity_log(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE(occurred_at timestamptz, actor_id uuid, actor_name text, action text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Admin-only cross-member feed; SECURITY DEFINER so it can union tables admins can't read directly. Private reflections and letter bodies are never included.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  WITH a AS (
    SELECT p.created_at AS t, p.id AS uid, 'Joined Oka'::text AS act, NULL::text AS det FROM profiles p
    UNION ALL SELECT p.onboarded_at, p.id, 'Completed onboarding', NULL FROM profiles p WHERE p.onboarded_at IS NOT NULL
    UNION ALL SELECT e.created_at, e.created_by, 'Created event', e.title || ' (' || e.status || ')' FROM events e WHERE e.created_by IS NOT NULL
    UNION ALL SELECT r.created_at, r.user_id, 'RSVP: ' || r.status, e.title FROM event_rsvps r JOIN events e ON e.id = r.event_id
    UNION ALL SELECT h.created_at, h.owner_id, 'Listed a house', h.title FROM houses h
    UNION ALL SELECT s.created_at, s.owner_id, 'Offered a skill', s.title FROM skills s
    UNION ALL SELECT b.created_at, b.guest_id, 'Requested a stay', h.title || ' · ' || b.check_in || ' → ' || b.check_out || ' (' || b.status || ')' FROM bookings b JOIN houses h ON h.id = b.house_id
    UNION ALL SELECT q.created_at, q.requester_id, 'Requested a skill session', s.title || ' (' || q.status || ')' FROM skill_session_requests q JOIN skills s ON s.id = q.skill_id
    UNION ALL SELECT l.created_at, l.sender_id, 'Sent appreciation', 'to ' || coalesce(rp.display_name, 'a member') FROM appreciation_letters l LEFT JOIN profiles rp ON rp.id = l.recipient_id
    UNION ALL SELECT c.created_at, c.user_id, CASE WHEN c.delta > 0 THEN 'Credits +' || c.delta ELSE 'Credits ' || c.delta END, c.reason || coalesce(' · ' || c.note, '') FROM credit_ledger c
    UNION ALL SELECT f.created_at, f.user_id, 'Saved to collection', f.item_type FROM favorites f
    UNION ALL SELECT ar.created_at, ar.referred_user_id, 'Joined via affiliate', coalesce(af.display_name, af.invite_code) FROM affiliate_referrals ar JOIN affiliates af ON af.id = ar.affiliate_id
    UNION ALL SELECT pm.created_at, pm.user_id, 'Payment: ' || pm.purpose, pm.status || coalesce(' · ' || (pm.amount_cents / 100.0)::text || ' ' || upper(pm.currency), '') FROM payments pm
  )
  SELECT a.t, a.uid, pr.display_name, a.act, a.det
  FROM a LEFT JOIN profiles pr ON pr.id = a.uid
  WHERE a.t IS NOT NULL AND (_before IS NULL OR a.t < _before)
  ORDER BY a.t DESC
  LIMIT least(greatest(coalesce(_limit, 100), 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_activity_log(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activity_log(timestamptz, integer) TO authenticated;