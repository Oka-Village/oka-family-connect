DO $mig$
DECLARE
  d text;
  done text := '(e.status = ''completed'' OR (e.status = ''published'' AND coalesce(e.ends_at, e.starts_at) < now()))';
BEGIN
  SELECT pg_get_functiondef('public.open_accounting_raw(text)'::regprocedure) INTO d;
  IF position('coalesce(e.ends_at, e.starts_at) < now()' IN d) > 0 THEN
    RETURN;
  END IF;
  d := replace(d, 'e.status = ''completed'' AND e.starts_at >= date_trunc(''day'', now())', done || ' AND e.starts_at >= date_trunc(''day'', now())');
  d := replace(d, 'e.status = ''completed'' AND e.starts_at >= ms.month_start', done || ' AND e.starts_at >= ms.month_start');
  EXECUTE d;
END
$mig$;