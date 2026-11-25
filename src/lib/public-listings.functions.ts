import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SkillRow } from "./skills";
import type { HouseRow } from "./houses";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Listings are unavailable. Please try again.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

/** Signs only paths that belong to published listings returned by the public catalog RPC. */
async function signer(paths: Array<string | null | undefined>) {
  const out = new Map<string, string>();
  const stored = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("http")))];
  if (stored.length) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from("avatars").createSignedUrls(stored, 60 * 60);
    data?.forEach((u) => { if (u.path && u.signedUrl) out.set(u.path, u.signedUrl); });
  }
  return (p: string | null | undefined) => (!p ? null : p.startsWith("http") ? p : out.get(p) ?? null);
}

export type PublicSkill = SkillRow & { photo: string | null; hostPhoto: string | null };
export type PublicHouse = HouseRow & { photoUrls: string[]; hostPhoto: string | null };

export const getPublicSkills = createServerFn({ method: "GET" }).handler(async (): Promise<PublicSkill[]> => {
  const { data, error } = await publicClient().rpc("public_skills_catalog");
  if (error) throw error;
  const rows = (data ?? []) as unknown as SkillRow[];
  const sign = await signer(rows.flatMap((s) => [s.photo_url, s.owner?.photo_url]));
  return rows.map((s) => ({ ...s, photo: sign(s.photo_url), hostPhoto: sign(s.owner?.photo_url) }));
});

export const getPublicHouses = createServerFn({ method: "GET" }).handler(async (): Promise<PublicHouse[]> => {
  const { data, error } = await publicClient().rpc("public_houses_catalog");
  if (error) throw error;
  const rows = (data ?? []) as unknown as HouseRow[];
  const sign = await signer(rows.flatMap((h) => [...h.photos, h.owner?.photo_url]));
  return rows.map((h) => ({
    ...h,
    photoUrls: h.photos.map((p) => sign(p)).filter((u): u is string => !!u),
    hostPhoto: sign(h.owner?.photo_url),
  }));
});

export function filterPublicSkills(rows: PublicSkill[], f: { q: string; category: string; format: string }) {
  const term = f.q.trim().toLowerCase();
  return rows.filter((s) => (!term || s.title.toLowerCase().includes(term)) && (!f.category || s.category === f.category) && (!f.format || s.format === f.format));
}

export function filterPublicHouses(rows: PublicHouse[], f: { location: string; type: string }) {
  const loc = f.location.trim().toLowerCase();
  return rows.filter((h) => (!loc || (h.location_text ?? "").toLowerCase().includes(loc)) && (!f.type || h.property_type === f.type));
}
