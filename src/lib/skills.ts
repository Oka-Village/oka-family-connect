import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const SKILL_CATEGORIES = [
  "Wellbeing", "Creative", "Language", "Cooking", "Tech", "Business",
  "Music", "Movement", "Nature", "Crafts", "Coaching", "Other",
] as const;

export const SKILL_FORMATS = ["virtual", "in_person"] as const;
export type SkillFormat = (typeof SKILL_FORMATS)[number];
export const SKILL_FORMAT_LABELS: Record<SkillFormat, string> = { virtual: "Virtual", in_person: "In person" };

export const SESSION_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting reply", accepted: "Accepted", completed: "Completed", declined: "Declined", cancelled: "Cancelled",
};

export type SkillHost = { id: string; display_name: string | null; photo_url: string | null };
export type SkillRow = {
  id: string;
  owner_id: string;
  title: string;
  category: string | null;
  format: SkillFormat;
  duration_minutes: number | null;
  description: string | null;
  status: "draft" | "published" | "archived";
  photo_url: string | null;
  created_at: string;
  owner?: SkillHost | null;
};

export const SKILL_SELECT =
  "id,owner_id,title,category,format,duration_minutes,description,status,photo_url,created_at,owner:profiles!skills_owner_id_fkey(id,display_name,photo_url)";

export const SKILLS_PAGE_SIZE = 24;
export type SkillCursor = { created_at: string; id: string } | null;
export type SkillFilters = { q: string; category: string; format: string };

const safe = (s: string) => s.replace(/[%_\\,()*]/g, " ").trim().slice(0, 80);

export function formatDuration(min: number | null) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Sign many stored paths (avatars bucket) in one request; http URLs pass through. */
export async function signPaths(paths: Array<string | null | undefined>) {
  const out = new Map<string, string>();
  const stored = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("http")))];
  if (stored.length) {
    const { data } = await supabase.storage.from("avatars").createSignedUrls(stored, 60 * 60);
    data?.forEach((u) => { if (u.path && u.signedUrl) out.set(u.path, u.signedUrl); });
  }
  return (p: string | null | undefined) => (!p ? null : p.startsWith("http") ? p : out.get(p) ?? null);
}

export async function fetchSkillsPage(f: SkillFilters, cursor: SkillCursor) {
  let q = supabase
    .from("skills")
    .select(SKILL_SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SKILLS_PAGE_SIZE + 1);
  const term = safe(f.q);
  if (term) q = q.ilike("title", `%${term}%`);
  if (f.category) q = q.eq("category", f.category);
  if (f.format === "virtual" || f.format === "in_person") q = q.eq("format", f.format);
  if (cursor) q = q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as SkillRow[];
  const page = rows.slice(0, SKILLS_PAGE_SIZE);
  const sign = await signPaths(page.flatMap((s) => [s.photo_url, s.owner?.photo_url]));
  const last = page[page.length - 1];
  return {
    skills: page.map((s) => ({ ...s, photo: sign(s.photo_url), hostPhoto: sign(s.owner?.photo_url) })),
    next: rows.length > SKILLS_PAGE_SIZE && last ? { created_at: last.created_at, id: last.id } : null,
  };
}

export type CreditSummary = { balance: number; reserved: number; available: number };

/** The signed-in member's derived credit balance. Invalidate ["credits"] after any credit change. */
export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    queryFn: async (): Promise<CreditSummary> => {
      const { data, error } = await supabase.rpc("my_credit_summary");
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as CreditSummary | undefined;
      return row ?? { balance: 0, reserved: 0, available: 0 };
    },
  });
}

/** Friendly copy for errors raised by the session functions. */
export function sessionErrorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (msg.includes("INSUFFICIENT_CREDITS")) {
    return "You don't have a free credit just yet. Host a night or share an hour of your own gifts, and your credits will grow.";
  }
  return msg || "Something went wrong. Please try again.";
}
