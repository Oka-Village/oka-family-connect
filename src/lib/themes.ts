import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ThemeKind = "month" | "week";
export type ThemeRow = { id: string; kind: ThemeKind; period_key: string; title: string; body: string | null; image_path: string | null; imageUrl: string | null };

export const THEME_BUCKET = "theme-images";
const pad = (n: number) => String(n).padStart(2, "0");

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** ISO-8601 week key, e.g. 2026-42 (year is the ISO week-year). */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-${pad(week)}`;
}

export const currentKey = (kind: ThemeKind) => (kind === "month" ? monthKey() : weekKey());

export function periodLabel(kind: ThemeKind, key: string) {
  const [y, n] = key.split("-").map(Number);
  if (kind === "month") return new Date(y!, n! - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `Week ${n}, ${y}`;
}

export async function fetchTheme(kind: ThemeKind, key: string): Promise<ThemeRow | null> {
  const { data, error } = await supabase.from("themes").select("id, kind, period_key, title, body, image_path").eq("kind", kind).eq("period_key", key).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let imageUrl: string | null = null;
  if (data.image_path) {
    const { data: signed } = await supabase.storage.from(THEME_BUCKET).createSignedUrl(data.image_path, 60 * 60);
    imageUrl = signed?.signedUrl ?? null;
  }
  return { ...(data as Omit<ThemeRow, "imageUrl">), imageUrl };
}

export function useTheme(kind: ThemeKind, key = currentKey(kind)) {
  return useQuery({ queryKey: ["theme", kind, key], queryFn: () => fetchTheme(kind, key), staleTime: 30 * 60_000 });
}
