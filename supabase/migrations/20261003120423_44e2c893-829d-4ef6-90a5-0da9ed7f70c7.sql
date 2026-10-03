CREATE OR REPLACE FUNCTION public.mark_letter_read(_letter_id uuid, _recipient_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE marked_at timestamptz;
BEGIN
  UPDATE public.appreciation_letters
  SET read_at = coalesce(read_at, now())
  WHERE id = _letter_id AND recipient_id = _recipient_id
  RETURNING read_at INTO marked_at;
  IF marked_at IS NULL THEN RAISE EXCEPTION 'Letter not found'; END IF;
  RETURN marked_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_letter_read(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_letter_read(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mark_letter_read(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_letter_read(uuid, uuid) TO service_role;