-- Directory search/filter/pagination indexes (fast at 100k+ members).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm ON public.profiles USING gin (display_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_location_trgm ON public.profiles USING gin (location extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_intentions ON public.profiles USING gin (intentions);
-- Keyset pagination: newest members first, id as tiebreaker.
CREATE INDEX IF NOT EXISTS idx_profiles_directory_cursor ON public.profiles (created_at DESC, id DESC);