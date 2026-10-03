REVOKE ALL ON FUNCTION public.mark_letter_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_letter_read(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mark_letter_read(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_letter_read(uuid) TO service_role;