ALTER TABLE public.events ADD COLUMN join_slug text;

CREATE OR REPLACE FUNCTION public.events_set_join_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text;
BEGIN
  IF NEW.join_slug IS NULL THEN
    base := trim(both '-' from regexp_replace(lower(coalesce(NEW.title, '')), '[^a-z0-9]+', '-', 'g'));
    base := left(base, 48);
    NEW.join_slug := CASE WHEN base = '' THEN '' ELSE base || '-' END || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER events_join_slug BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.events_set_join_slug();

UPDATE public.events SET join_slug =
  CASE WHEN trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) = '' THEN ''
  ELSE left(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), 48) || '-' END
  || substr(replace(id::text, '-', ''), 1, 6);

ALTER TABLE public.events ALTER COLUMN join_slug SET NOT NULL;
CREATE UNIQUE INDEX events_join_slug_key ON public.events (join_slug);