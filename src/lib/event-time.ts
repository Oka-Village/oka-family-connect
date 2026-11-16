/** Pure, browser-safe formatting; viewer timezone is supplied only after hydration. */
function validZone(zone?: string | null): string | null {
  if (!zone) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function dateKey(iso: string, zone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function time(iso: string, zone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}

function datedTime(iso: string, zone: string) {
  const date = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
  return `${date}, ${time(iso, zone)}`;
}

export function formatEventTimeDual(start: string, end: string | null | undefined, hostTimezone: string | null | undefined, viewerTimezone?: string | null) {
  const hostZone = validZone(hostTimezone) ?? "UTC";
  const viewerZone = validZone(viewerTimezone);
  const range = (zone: string, includeDate: boolean) => {
    const first = includeDate ? datedTime(start, zone) : time(start, zone);
    if (!end) return first;
    const last = dateKey(start, zone) !== dateKey(end, zone) ? datedTime(end, zone) : time(end, zone);
    return `${first} – ${last}`;
  };
  return {
    primary: range(hostZone, false),
    local: viewerZone && viewerZone !== hostZone
      ? `${range(viewerZone, dateKey(start, hostZone) !== dateKey(start, viewerZone))} · your time`
      : null,
  };
}