import { formatEventDate, formatEventTime, utcToZonedInput } from "@/lib/events";
import { REPEAT_LABELS, type Repeat } from "@/lib/recurrence";

/** Cadence of a materialized series. "none" is never stored here; a single event has a null cadence. */
export type SeriesCadence = Exclude<Repeat, "none">;
export type SeriesWhen = "upcoming" | "past";

/**
 * Fields that identify copies from one submit. A multi-row insert on this database
 * shares one `created_at` (`now()` is the transaction timestamp; verified with a
 * rolled-back insert). `status` is included so a later cancellation stays visible
 * instead of disappearing into the published series.
 */
export type SeriesEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  format: string;
  starts_at: string;
  timezone: string | null;
  capacity: number | null;
  created_by: string | null;
  created_at: string;
  photo_url: string | null;
  status: string;
};

export type GroupedEvent<T> = {
  event: T;
  cadence: SeriesCadence | null;
  count: number;
  label: string | null;
  /** Every date in the group. A one-time event has only its own id. */
  ids: string[];
};

type LocalDate = { y: number; m: number; d: number; time: string; ordinal: number };

const DAY_MS = 86_400_000;

function identityKey(event: SeriesEvent): string {
  if (!event.created_at) return `solo:${event.id}`;
  return JSON.stringify([
    event.created_at,
    event.created_by,
    event.title,
    event.event_type,
    event.format,
    event.timezone,
    event.photo_url,
    event.description,
    event.capacity,
    event.status,
  ]);
}

/** Local calendar parts, using the same wall-clock conversion as the event form. */
function localParts(iso: string, tz: string | null): LocalDate | null {
  if (Number.isNaN(Date.parse(iso))) return null;
  try {
    const input = utcToZonedInput(iso, tz || "UTC");
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(input);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return { y, m, d, time: match[4] ?? "", ordinal: Math.round(Date.UTC(y, m - 1, d) / DAY_MS) };
  } catch {
    return null;
  }
}

function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthIndex(date: LocalDate): number {
  return date.y * 12 + (date.m - 1);
}

function isStep(dates: LocalDate[], step: number): boolean {
  for (let i = 1; i < dates.length; i++) {
    if (dates[i]!.ordinal - dates[i - 1]!.ordinal !== step) return false;
  }
  return true;
}

/**
 * Monthly matches the generator: consecutive months, same local time, and one anchor
 * day-of-month clamped with min(anchor, last day of that month). The anchor is inferred
 * so a future-only slice of a month-end series still matches, while Jan 31 / Feb 28 / Mar 28 does not.
 */
function isMonthly(dates: LocalDate[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    if (monthIndex(dates[i]!) - monthIndex(dates[i - 1]!) !== 1) return false;
  }
  for (let anchor = 1; anchor <= 31; anchor++) {
    if (dates.every((date) => date.d === Math.min(anchor, lastDay(date.y, date.m)))) return true;
  }
  return false;
}

function detectCadence(members: SeriesEvent[]): SeriesCadence | null {
  if (members.length < 2) return null;
  const tz = members[0]?.timezone ?? null;
  const dates: LocalDate[] = [];
  for (const member of members) {
    const local = localParts(member.starts_at, tz);
    if (!local) return null;
    dates.push(local);
  }
  dates.sort((a, b) => a.ordinal - b.ordinal || a.time.localeCompare(b.time));
  if (dates.some((date) => date.time !== dates[0]?.time)) return null;
  if (new Set(dates.map((date) => date.ordinal)).size !== dates.length) return null;
  if (isStep(dates, 1)) return "daily";
  if (isStep(dates, 7)) return "weekly";
  if (isStep(dates, 14)) return "biweekly";
  if (isMonthly(dates)) return "monthly";
  return null;
}

function byStart(a: SeriesEvent, b: SeriesEvent): number {
  const delta = Date.parse(a.starts_at) - Date.parse(b.starts_at);
  return delta || a.id.localeCompare(b.id);
}

function chooseRepresentative<T extends SeriesEvent>(members: T[], mode: SeriesWhen, now: number): { event: T; when: SeriesWhen } {
  const sorted = [...members].sort(byStart);
  if (mode === "past") return { event: sorted[sorted.length - 1]!, when: "past" };
  const next = sorted.find((event) => Date.parse(event.starts_at) >= now);
  if (next) return { event: next, when: "upcoming" };
  return { event: sorted[sorted.length - 1]!, when: "past" };
}

export function seriesBadge(event: Pick<SeriesEvent, "starts_at" | "timezone">, cadence: SeriesCadence, count: number, when: SeriesWhen): string {
  const word = when === "past" ? "Last" : "Next";
  const extra = count - 1;
  const more = extra === 1 ? "1 more date" : `${extra} more dates`;
  return `${REPEAT_LABELS[cadence]} · ${word}: ${formatEventDate(event.starts_at, event.timezone)}, ${formatEventTime(event.starts_at, event.timezone)} · ${more}`;
}

/**
 * Collapse copies from one repeating submit into a single list entry.
 * The result keeps the original order, with the series placed where its displayed date already sits.
 */
export function groupEventSeries<T extends SeriesEvent>(events: T[], mode: SeriesWhen, now = Date.now()): GroupedEvent<T>[] {
  const buckets = new Map<string, T[]>();
  for (const event of events) {
    const key = identityKey(event);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }

  const seriesOf = new Map<string, { cadence: SeriesCadence; members: T[]; event: T; when: SeriesWhen }>();
  for (const members of buckets.values()) {
    const cadence = detectCadence(members);
    if (!cadence) continue;
    const chosen = chooseRepresentative(members, mode, now);
    const series = { cadence, members, event: chosen.event, when: chosen.when };
    for (const member of members) seriesOf.set(member.id, series);
  }

  const emitted = new Set<string>();
  const grouped: GroupedEvent<T>[] = [];
  for (const event of events) {
    const series = seriesOf.get(event.id);
    if (!series) {
      grouped.push({ event, cadence: null, count: 1, label: null, ids: [event.id] });
      continue;
    }
    if (event.id !== series.event.id || emitted.has(series.event.id)) continue;
    emitted.add(series.event.id);
    grouped.push({
      event: series.event,
      cadence: series.cadence,
      count: series.members.length,
      label: seriesBadge(series.event, series.cadence, series.members.length, series.when),
      ids: series.members.map((member) => member.id),
    });
  }
  return grouped;
}
