CREATE TABLE public.appreciation_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  CONSTRAINT appreciation_letters_not_self CHECK (sender_id <> recipient_id)
);

GRANT SELECT, INSERT ON public.appreciation_letters TO authenticated;
GRANT ALL ON public.appreciation_letters TO service_role;

ALTER TABLE public.appreciation_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appreciation_letters_insert_own"
ON public.appreciation_letters FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND recipient_id <> auth.uid());

CREATE POLICY "appreciation_letters_select_parties"
ON public.appreciation_letters FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "appreciation_letters_select_admin"
ON public.appreciation_letters FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX appreciation_letters_recipient_created_idx
ON public.appreciation_letters (recipient_id, created_at DESC);

CREATE INDEX appreciation_letters_sender_created_idx
ON public.appreciation_letters (sender_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.appreciation_letters_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.appreciation_letters
    WHERE sender_id = NEW.sender_id
      AND created_at >= date_trunc('day', now())
      AND created_at < date_trunc('day', now()) + interval '1 day'
  ) >= 10 THEN
    RAISE EXCEPTION 'APPRECIATION_DAILY_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appreciation_letters_rate_limit
BEFORE INSERT ON public.appreciation_letters
FOR EACH ROW EXECUTE FUNCTION public.appreciation_letters_rate_limit();

CREATE OR REPLACE FUNCTION public.mark_letter_read(_letter_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  marked_at timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  UPDATE public.appreciation_letters
  SET read_at = coalesce(read_at, now())
  WHERE id = _letter_id AND recipient_id = uid
  RETURNING read_at INTO marked_at;

  IF marked_at IS NULL THEN RAISE EXCEPTION 'Letter not found'; END IF;
  RETURN marked_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_letter_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_letter_read(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appreciation_letters;