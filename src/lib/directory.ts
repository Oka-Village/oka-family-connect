import { supabase } from "@/integrations/supabase/client";

export const DIRECTORY_PAGE_SIZE = 24;

export type DirectoryMember = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  location: string | null;
  intentions: string[];
  created_at: string;
  photo?: string | null;
};

export type DirectoryCursor = { created_at: string; id: string } | null;
export type DirectoryFilters = { q: string; intention: string; location: string };

/** Escape characters that carry meaning in PostgREST ilike / or() filters. */
const safe = (s: string) => s.replace(/[%_\\,()*]/g, " ").trim().slice(0, 80);

/** One keyset-paginated page of members (newest first). Uses indexed filters only. */
export async function fetchDirectoryPage(filters: DirectoryFilters, cursor: DirectoryCursor) {
  let query = supabase
    .from("profiles")
    .select("id,display_name,photo_url,location,intentions,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(DIRECTORY_PAGE_SIZE + 1);

  const q = safe(filters.q);
  const loc = safe(filters.location);
  if (q) query = query.ilike("display_name", `%${q}%`);
  if (loc) query = query.ilike("location", `%${loc}%`);
  if (filters.intention) query = query.contains("intentions", [filters.intention]);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as DirectoryMember[];
  const page = rows.slice(0, DIRECTORY_PAGE_SIZE);

  // Batch-sign stored avatar paths in one request.
  const paths = page.map((m) => m.photo_url).filter((p): p is string => !!p && !p.startsWith("http"));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("avatars").createSignedUrls(paths, 60 * 60);
    urls?.forEach((u) => { if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl); });
  }
  const members = page.map((m) => ({ ...m, photo: m.photo_url?.startsWith("http") ? m.photo_url : m.photo_url ? signed.get(m.photo_url) ?? null : null }));
  const last = page[page.length - 1];
  return { members, next: rows.length > DIRECTORY_PAGE_SIZE && last ? { created_at: last.created_at, id: last.id } : null };
}
