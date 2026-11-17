export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  url: string;
  location?: string | null;
};

function dates(event: CalendarEvent) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end < start))) {
    throw new Error("This event's calendar dates aren't available.");
  }
  return { start, end };
}

const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const details = (event: CalendarEvent) => [event.description, event.url].filter(Boolean).join("\n\n");

export function googleCalendarUrl(event: CalendarEvent): string {
  const { start, end } = dates(event);
  const params = new URLSearchParams({
    action: "TEMPLATE", text: event.title,
    dates: `${utc(start)}/${utc(end ?? start)}`,
    details: details(event),
  });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const { start, end } = dates(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose", rru: "addevent", subject: event.title,
    startdt: start.toISOString(), enddt: (end ?? start).toISOString(),
    body: details(event),
  });
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

/** RFC 5545 folds at 75 UTF-8 octets without splitting a character. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { result += "\r\n "; length = 1; }
    result += char;
    length += bytes;
  }
  return result;
}

export function calendarIcs(event: CalendarEvent, now = new Date()): string {
  const { start, end } = dates(event);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Oka//Event Calendar//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:event-${escapeText(event.id)}@oneworldfamily.app`,
    `DTSTAMP:${utc(now)}`, `DTSTART:${utc(start)}`,
    ...(end ? [`DTEND:${utc(end)}`] : []),
    `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(details(event))}`,
    `URL:${event.url.replace(/[\r\n]/g, "")}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** Only called by an explicit browser download action. */
export function downloadCalendarIcs(event: CalendarEvent) {
  const blob = new Blob([calendarIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `oka-event-${event.id}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}