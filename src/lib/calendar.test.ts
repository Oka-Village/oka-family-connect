import { describe, expect, it } from "vitest";
import { calendarIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "./calendar";

const event: CalendarEvent = {
  id: "test-event", title: "Stories & connection, together",
  startsAt: "2026-11-29T16:00:00+07:00", endsAt: "2026-11-29T16:30:00+07:00",
  description: "Meet; share\nBring a friend", url: "https://www.oneworldfamily.app/join/stories",
  location: "https://example.org/meeting?a=1&b=2",
};

describe("event calendar exports", () => {
  it("sends Google the exact UTC instants, encoded title, event link and authorized location", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("dates")).toBe("20261129T090000Z/20261129T093000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("details")).toBe(`${event.description}\n\n${event.url}`);
    expect(url.searchParams.get("location")).toBe(event.location);
  });
  it("sends Outlook UTC dates without applying the viewer's offset", () => {
    const url = new URL(outlookCalendarUrl(event));
    expect(url.searchParams.get("startdt")).toBe("2026-11-29T09:00:00.000Z");
    expect(url.searchParams.get("enddt")).toBe("2026-11-29T09:30:00.000Z");
    expect(url.searchParams.get("subject")).toBe(event.title);
    expect(url.searchParams.get("body")).toContain(event.url);
  });
  it("creates a stable UID and UTC calendar dates with escaped text", () => {
    const ics = calendarIcs(event, new Date("2026-11-15T06:26:00Z"));
    expect(ics).toContain("UID:event-test-event@oneworldfamily.app\r\n");
    expect(ics).toContain("DTSTAMP:20261115T062600Z\r\n");
    expect(ics).toContain("DTSTART:20261129T090000Z\r\nDTEND:20261129T093000Z");
    expect(ics).toContain("SUMMARY:Stories & connection\\, together");
    expect(ics).toContain("Meet\\; share\\nBring a friend");
    expect(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
  });
  it("folds long Unicode lines at 75 bytes without damaging characters", () => {
    const title = "পরিবারের গল্প ".repeat(30);
    const ics = calendarIcs({ ...event, title });
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${title}`);
  });
  it("does not invent a duration or private location when none is supplied", () => {
    const single = { ...event, endsAt: null, location: null };
    expect(calendarIcs(single)).not.toContain("DTEND:");
    expect(calendarIcs(single)).not.toContain("LOCATION:");
    expect(new URL(googleCalendarUrl(single)).searchParams.get("dates")).toBe("20261129T090000Z/20261129T090000Z");
  });
  it("rejects invalid dates and an end before the start", () => {
    expect(() => calendarIcs({ ...event, startsAt: "invalid" })).toThrow();
    expect(() => googleCalendarUrl({ ...event, endsAt: "2026-11-28T09:00:00Z" })).toThrow();
  });
});