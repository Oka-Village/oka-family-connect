CREATE TABLE public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('month','week')),
  period_key text NOT NULL CHECK (period_key ~ '^\d{4}-\d{2}$'),
  title text NOT NULL,
  body text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, period_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in members read themes" ON public.themes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert themes" ON public.themes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update themes" ON public.themes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete themes" ON public.themes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER themes_set_updated_at BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Admins upload theme images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'theme-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update theme images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'theme-images' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'theme-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete theme images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'theme-images' AND public.has_role(auth.uid(), 'admin'));