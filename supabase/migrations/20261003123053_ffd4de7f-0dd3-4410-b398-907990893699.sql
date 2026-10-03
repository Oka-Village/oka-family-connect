REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.favorites FROM authenticated, anon;
REVOKE ALL ON public.favorites FROM anon;