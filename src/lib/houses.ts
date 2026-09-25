import { supabase } from "@/integrations/supabase/client";
import { signPaths } from "@/lib/skills";

export const PROPERTY_TYPES = ["entire_home", "private_room"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_LABELS: Record<PropertyType, string> = { entire_home: "Entire home", private_room: "Private room" };

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting host", approved: "Approved", declined: "Declined", cancelled: "Cancelled", completed: "Completed",
};

export type HouseRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  property_type: PropertyType;
  location_text: string | null;
  photos: string[];
  house_rules: string | null;
  status: string;
  created_at: string;
  owner?: { id: string; display_name: string | null; photo_url: string | null } | null;
};

export const HOUSE_SELECT =
  "id,owner_id,title,description,property_type,location_text,photos,house_rules,status,created_at,owner:profiles!houses_owner_id_fkey(id,display_name,photo_url)";

export const HOUSES_PAGE_SIZE = 24;
export type HouseCursor = { created_at: string; id: string } | null;
const safe = (s: string) => s.replace(/[%_\\,()*]/g, " ").trim().slice(0, 80);

export async function withSignedHousePhotos(rows: HouseRow[], allPhotos = false) {
  const sign = await signPaths(rows.flatMap((h) => [...(allPhotos ? h.photos : h.photos.slice(0, 1)), h.owner?.photo_url]));
  return rows.map((h) => ({
    ...h,
    photoUrls: (allPhotos ? h.photos : h.photos.slice(0, 1)).map((p) => sign(p)).filter((u): u is string => !!u),
    hostPhoto: sign(h.owner?.photo_url),
  }));
}
export type SignedHouse = Awaited<ReturnType<typeof withSignedHousePhotos>>[number];

export async function fetchHousesPage(f: { location: string; type: string }, cursor: HouseCursor) {
  let q = supabase.from("houses").select(HOUSE_SELECT).eq("status", "published")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(HOUSES_PAGE_SIZE + 1);
  const loc = safe(f.location);
  if (loc) q = q.ilike("location_text", `%${loc}%`);
  if (f.type === "entire_home" || f.type === "private_room") q = q.eq("property_type", f.type);
  if (cursor) q = q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as HouseRow[];
  const page = rows.slice(0, HOUSES_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    houses: await withSignedHousePhotos(page),
    next: rows.length > HOUSES_PAGE_SIZE && last ? { created_at: last.created_at, id: last.id } : null,
  };
}

/** Local YYYY-MM-DD for a date offset by N days from today. */
export function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function formatDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
