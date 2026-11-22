CREATE TABLE public.stripe_reconciliation_runs (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.stripe_reconciliation_runs TO service_role;
ALTER TABLE public.stripe_reconciliation_runs ENABLE ROW LEVEL SECURITY;