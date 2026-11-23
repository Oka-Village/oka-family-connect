import type { EventFilters, EventRow } from "./events";

export function isPublicEventRoute(path: string): boolean {
  return path === "/events" || /^\/events\/day\/\d{4}-\d{2}-\d{2}$/.test(path) || /^\/events\/(?!new$|edit$|day$)[^/]+$/.test(path);
}

export type EventFetchOptions = { past?: boolean; rangeStart?: string; rangeEnd?: string; limit?: number; includeCancelled?: boolean };

export function filterPublicEvents(events: EventRow[], filters: EventFilters, opts: EventFetchOptions = {}, now = new Date()): EventRow[] {
  const nowIso = now.toISOString();
  const from = filters.from ? new Date(`${filters.from}T00:00`).toISOString() : nowIso;
  const to = filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : null;
  return events.filter((e) => {
    if (e.status !== "published" || (filters.type && e.event_type !== filters.type) || (filters.format && e.format !== filters.format)) return false;
    if (opts.rangeStart && opts.rangeEnd) return e.starts_at >= opts.rangeStart && e.starts_at < opts.rangeEnd;
    if (opts.past) return e.starts_at < nowIso && (!filters.from || e.starts_at >= from);
    return e.starts_at >= (from < nowIso ? nowIso : from) && (!to || e.starts_at < to);
  }).sort((a, b) => opts.past && !opts.rangeStart ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at)).slice(0, opts.limit ?? 100);
}