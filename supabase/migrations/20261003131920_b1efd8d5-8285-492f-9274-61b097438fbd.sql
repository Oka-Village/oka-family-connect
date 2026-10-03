CREATE TABLE public.reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  question_text text NOT NULL CHECK (char_length(question_text) BETWEEN 1 AND 500),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflections TO authenticated;
GRANT ALL ON public.reflections TO service_role;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reflections select" ON public.reflections FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Own reflections insert" ON public.reflections FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid());
CREATE POLICY "Own reflections update" ON public.reflections FOR UPDATE TO authenticated USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
CREATE POLICY "Own reflections delete" ON public.reflections FOR DELETE TO authenticated USING (member_id = auth.uid());
CREATE INDEX reflections_member_created_idx ON public.reflections (member_id, created_at DESC);