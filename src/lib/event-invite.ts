import { supabase } from "@/integrations/supabase/client";

/** Carries the join slug through Google sign-in and onboarding, beside oka_invite_code. */
const SLUG_KEY = "oka_event_join_slug";

const pending = new Map<string, Promise<string | null>>();

export function saveEventJoinSlug(slug: string) {
  const clean = slug.trim().slice(0, 200);
  if (!clean) return;
  try { localStorage.setItem(SLUG_KEY, clean); } catch { /* storage blocked */ }
}

export function peekEventJoinSlug(): string | null {
  try {
    const slug = localStorage.getItem(SLUG_KEY)?.trim();
    return slug ? slug : null;
  } catch {
    return null;
  }
}

export function clearEventJoinSlug() {
  try { localStorage.removeItem(SLUG_KEY); } catch { /* ignore */ }
}

/** Same rule the join page used before the invite was recorded server-side. */
export function shouldReserveSpot(isHost: boolean, past: boolean, status: string | null | undefined) {
  return !isHost && !past && status !== "going" && status !== "waitlist";
}

/** True when the live database has not installed remember_event_invite yet. */
export function isMissingInviteFunction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  if (code === "PGRST202" || code === "42883") return true;
  const message = typeof record.message === "string" ? record.message : "";
  return /remember_event_invite/i.test(message) && /could not find|does not exist|schema cache/i.test(message);
}

export type InviteCardEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  status: string;
};

/** Latest visit that is still a published gathering the member can open. */
export function pickInviteCard(
  visits: { event_id: string; created_at: string }[],
  events: InviteCardEvent[],
  now = Date.now(),
): InviteCardEvent | null {
  const ordered = [...visits].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  const byId = new Map(events.map((event) => [event.id, event]));
  for (const visit of ordered) {
    const event = byId.get(visit.event_id);
    if (!event || event.status !== "published") continue;
    if (new Date(event.ends_at ?? event.starts_at).getTime() < now) continue;
    return event;
  }
  return null;
}

type ReadableEvent = {
  id: string;
  host_id: string | null;
  created_by: string | null;
  starts_at: string;
  ends_at: string | null;
};

/** The join page's old read: a published virtual event this caller can already select. */
async function readPublishedVirtual(slug: string): Promise<ReadableEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id,status,format,host_id,created_by,starts_at,ends_at")
    .eq("join_slug", slug.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "published" || data.format !== "virtual") return null;
  return data;
}

async function reserveSpot(eventId: string, ev: ReadableEvent | null, userId: string): Promise<boolean> {
  const isHost = Boolean(ev && (ev.host_id === userId || ev.created_by === userId));
  const past = ev ? new Date(ev.ends_at ?? ev.starts_at).getTime() < Date.now() : false;
  let status: string | null | undefined;
  if (ev && !isHost) {
    const { data: mine, error: rsvpReadError } = await supabase
      .from("event_rsvps")
      .select("status")
      .eq("event_id", ev.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (rsvpReadError) throw rsvpReadError;
    status = mine?.status;
  }
  // An empty event read still reserves: rsvp_event rejects unpublished or finished events.
  if (shouldReserveSpot(isHost, past, status)) {
    const { error: rsvpError } = await supabase.rpc("rsvp_event", { _event_id: eventId });
    if (rsvpError) throw rsvpError;
  }
  return isHost;
}

async function claimEventInviteOnce(slug: string, userId: string): Promise<string | null> {
  const remembered = await supabase.rpc("remember_event_invite", { _slug: slug });
  if (remembered.error && !isMissingInviteFunction(remembered.error)) throw remembered.error;

  const eventId = remembered.error ? null : remembered.data;
  if (!eventId) {
    const legacy = await readPublishedVirtual(slug);
    if (!legacy) {
      clearEventJoinSlug();
      return null;
    }
    await reserveSpot(legacy.id, legacy, userId);
    clearEventJoinSlug();
    return legacy.id;
  }

  const { data: ev, error: readError } = await supabase
    .from("events")
    .select("id,host_id,created_by,starts_at,ends_at")
    .eq("id", eventId)
    .maybeSingle();
  if (readError) throw readError;

  const isHost = await reserveSpot(eventId, ev, userId);

  const { data: visit, error: visitError } = await supabase
    .from("event_link_visits")
    .select("event_id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  // A failed visit read must not hide an event the caller can already open.
  if (!visitError && ((visit && ev) || isHost)) clearEventJoinSlug();
  return eventId;
}

/** Records the slug, then reserves a spot with the existing rsvp_event rules. */
export function claimEventInvite(slug: string, userId: string): Promise<string | null> {
  const key = `${userId}:${slug.trim()}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const run = claimEventInviteOnce(slug, userId).finally(() => pending.delete(key));
  pending.set(key, run);
  return run;
}
