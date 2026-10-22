ALTER TABLE public.houses ADD COLUMN featured boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.houses_featured_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin')
     AND NEW.featured IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN false ELSE OLD.featured END) THEN
    RAISE EXCEPTION 'Only admins can feature homes';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER houses_featured_guard BEFORE INSERT OR UPDATE ON public.houses FOR EACH ROW EXECUTE FUNCTION public.houses_featured_guard();