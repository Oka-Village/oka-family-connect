import { supabase } from "@/integrations/supabase/client";

export const EVENT_TYPES = ["gathering", "workshop", "pod_session", "meditation", "retreat"] as const;
export const EVENT_FORMATS = ["virtual", "in_person"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EventFormat = (typeof EVENT_FORMATS)[number];

export const TYPE_LABELS: Record<EventType, string> = {
  gathering: "Gathering",
  workshop: "Workshop",
  pod_session: "Pod session",
  meditation: "Meditation",
  retreat: "Retreat",
};
export const FORMAT_LABELS: Record<EventFormat, string> = {
  virtual: "Virtual",
  in_person: "In person",
};

export type EventHost = { id: string; display_name: string | null; photo_url: string | null };
export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  format: EventFormat;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  capacity: number | null;
  going_count: number;
  waitlist_count: number;
  status: string;
  host_id: string | null;
  created_by: string | null;
  join_slug: string;
  host: EventHost | null;
};

export const EVENT_SELECT =
  "id,title,description,event_type,format,starts_at,ends_at,timezone,capacity,going_count,waitlist_count,status,host_id,created_by,join_slug,host:profiles!events_host_id_fkey(id,display_name,photo_url)";

export type EventFilters = {
  type?: EventType | undefined;
  format?: EventFormat | undefined;
  from?: string | undefined; // yyyy-mm-dd
  to?: string | undefined;
};

/**
 * Events on the schedule: published only, so a cancelled event drops off the
 * schedule for everyone. Pass includeCancelled (Home does) to also get the
 * cancelled ones a member signed up for, so they can still see it was called off.
 */
export async function fetchEvents(
  filters: EventFilters,
  opts: { past?: boolean; rangeStart?: string; rangeEnd?: string; limit?: number; includeCancelled?: boolean } = {},
): Promise<EventRow[]> {
  const nowIso = new Date().toISOString();
  let q = supabase
    .from("events")
    .select(EVENT_SELECT)
    .in("status", opts.includeCancelled ? ["published", "cancelled"] : ["published"]);
  if (filters.type) q = q.eq("event_type", filters.type);
  if (filters.format) q = q.eq("format", filters.format);

  if (opts.rangeStart && opts.rangeEnd) {
    q = q.gte("starts_at", opts.rangeStart).lt("starts_at", opts.rangeEnd).order("starts_at");
  } else if (opts.past) {
    q = q.lt("starts_at", nowIso).order("starts_at", { ascending: false });
    if (filters.from) q = q.gte("starts_at", new Date(filters.from).toISOString());
  } else {
    const from = filters.from ? new Date(`${filters.from}T00:00`).toISOString() : nowIso;
    q = q.gte("starts_at", from < nowIso ? nowIso : from).order("starts_at");
    if (filters.to) q = q.lt("starts_at", new Date(`${filters.to}T23:59:59`).toISOString());
  }
  const { data, error } = await q.limit(opts.limit ?? 100);
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

export async function fetchMyRsvps(eventIds: string[]): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {};
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("event_id,status")
    .eq("user_id", auth.user.id)
    .in("event_id", eventIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.event_id, r.status]));
}

export function spotsLeft(e: Pick<EventRow, "capacity" | "going_count">): number | null {
  return e.capacity == null ? null : Math.max(0, e.capacity - e.going_count);
}

export function hostName(h: EventHost | null) {
  return h?.display_name?.trim() || "A family member";
}

const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function formatEventDate(iso: string, tz?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatEventTime(iso: string, tz?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz || undefined,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatDuration(start: string, end: string | null) {
  if (!end) return null;
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const days = Math.floor(mins / 1440);
  if (days >= 1) return `${days} day${days > 1 ? "s" : ""}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---- Timezone conversion for the event form (wall time in an IANA zone <-> UTC) ----
function tzOffsetMs(ts: number, tz: string) {
  const parts: Record<string, string> = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  );
  const n = (k: string) => Number(parts[k] ?? 0);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - ts;
}

/** "2026-10-04T18:00" in Europe/Berlin -> ISO UTC string. */
export function zonedInputToUtc(local: string, tz: string): string {
  const [d = "", t = "00:00"] = local.split("T");
  const [y = 0, mo = 1, da = 1] = d.split("-").map(Number);
  const [h = 0, mi = 0] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  let ts = guess - tzOffsetMs(guess, tz);
  ts = guess - tzOffsetMs(ts, tz);
  return new Date(ts).toISOString();
}

export function utcToZonedInput(iso: string, tz: string): string {
  const ts = new Date(iso).getTime();
  return new Date(ts + tzOffsetMs(ts, tz)).toISOString().slice(0, 16);
}

export function defaultTimezone() {
  return browserTz();
}

export function listTimezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return [browserTz()];
  }
}
