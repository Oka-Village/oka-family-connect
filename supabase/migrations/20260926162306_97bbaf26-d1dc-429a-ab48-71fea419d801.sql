CREATE OR REPLACE FUNCTION public.events_set_join_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text;
BEGIN
  IF NEW.join_slug IS NULL OR NEW.join_slug = '' THEN
    base := left(trim(both '-' from regexp_replace(lower(coalesce(NEW.title, '')), '[^a-z0-9]+', '-', 'g')), 48);
    NEW.join_slug := CASE WHEN base = '' THEN '' ELSE base || '-' END || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE public.events ALTER COLUMN join_slug SET DEFAULT '';