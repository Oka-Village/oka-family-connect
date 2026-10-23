CREATE TABLE public.memberships (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('founding','monthly')),
 active boolean NOT NULL DEFAULT true,
 stripe_customer_id text,
 stripe_subscription_id text,
 stripe_checkout_session_id text NOT NULL UNIQUE,
 current_period_end timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_read_own ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.memberships(user_id,kind,stripe_checkout_session_id)
SELECT user_id,'founding',stripe_checkout_session_id FROM (SELECT DISTINCT ON (user_id) * FROM public.payments WHERE purpose='founding_lifetime' AND status='paid' AND stripe_checkout_session_id IS NOT NULL ORDER BY user_id,created_at DESC) p;
CREATE FUNCTION public.record_verified_membership(_user_id uuid, _kind text, _session_id text, _customer_id text, _subscription_id text, _period_end timestamptz, _payment_intent text, _amount integer, _metadata jsonb) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF _kind NOT IN ('founding','monthly') THEN RAISE EXCEPTION 'Invalid membership'; END IF;
 INSERT INTO public.payments(user_id,purpose,amount_cents,currency,status,stripe_checkout_session_id,stripe_payment_intent_id,metadata)
 VALUES (_user_id, CASE WHEN _kind='founding' THEN 'founding_lifetime' ELSE 'membership_monthly' END,_amount,'usd','paid',_session_id,_payment_intent,_metadata)
 ON CONFLICT (stripe_checkout_session_id) DO NOTHING;
 INSERT INTO public.memberships(user_id,kind,active,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,current_period_end)
 VALUES (_user_id,_kind,true,_customer_id,_subscription_id,_session_id,_period_end)
 ON CONFLICT (user_id) DO UPDATE SET kind=EXCLUDED.kind,active=true,stripe_customer_id=EXCLUDED.stripe_customer_id,stripe_subscription_id=EXCLUDED.stripe_subscription_id,stripe_checkout_session_id=EXCLUDED.stripe_checkout_session_id,current_period_end=EXCLUDED.current_period_end,updated_at=now()
 WHERE memberships.kind <> 'founding';
END;
$$;
REVOKE ALL ON FUNCTION public.record_verified_membership(uuid,text,text,text,text,timestamptz,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_membership(uuid,text,text,text,text,timestamptz,text,integer,jsonb) TO service_role;
COMMENT ON FUNCTION public.record_verified_membership(uuid,text,text,text,text,timestamptz,text,integer,jsonb) IS 'Service-only atomic persistence after authenticated Stripe session verification. Does not change member_status.';