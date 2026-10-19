CREATE TABLE public.blocked_emails (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.blocked_emails TO authenticated;
GRANT ALL ON public.blocked_emails TO service_role;
ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocked_emails_admin_all ON public.blocked_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.member_suspensions (
  user_id uuid PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.member_suspensions TO authenticated;
GRANT ALL ON public.member_suspensions TO service_role;
ALTER TABLE public.member_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY suspensions_read_own_or_admin ON public.member_suspensions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY suspensions_admin_insert ON public.member_suspensions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());
CREATE POLICY suspensions_admin_delete ON public.member_suspensions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SECURITY DEFINER: runs during sign-up as the auth service, which cannot read the RLS-protected list.
CREATE OR REPLACE FUNCTION public.block_deleted_emails()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (SELECT 1 FROM public.blocked_emails WHERE email = lower(NEW.email)) THEN
    RAISE EXCEPTION 'This email can no longer be used to join Oka.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER block_deleted_emails BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_deleted_emails();