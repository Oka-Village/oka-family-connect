CREATE TABLE public.facilitator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  public_name text,
  email text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  acceptance_name text NOT NULL,
  news_opt_in boolean NOT NULL DEFAULT false,
  submitted_by uuid,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.facilitator_applications TO authenticated;
GRANT ALL ON public.facilitator_applications TO service_role;
ALTER TABLE public.facilitator_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY facilitator_applications_admin_all ON public.facilitator_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX facilitator_applications_created_idx ON public.facilitator_applications (created_at DESC);