import { describe, expect, it } from "vitest";
import { filterPublicEvents, isPublicEventRoute } from "./public-events";
import type { EventRow } from "./events";

const event = (id: string, status: string, starts_at: string): EventRow => ({
  id, status, starts_at, title: id, description: null, event_type: "gathering", format: "virtual", ends_at: null,
  timezone: "UTC", capacity: 10, going_count: 2, waitlist_count: 0, host_id: null, created_by: null,
  created_at: starts_at, join_slug: id, photo_url: null, host: null,
});
describe("public event browsing", () => {
  it.each(["/events", "/events/abc", "/events/day/2026-11-23"])("allows guests at %s", (path) => expect(isPublicEventRoute(path)).toBe(true));
  it.each(["/events/new", "/events/edit", "/events/edit/abc", "/profile", "/events/day"])("keeps creation, editing and member pages private at %s", (path) => expect(isPublicEventRoute(path)).toBe(false));
  it("shows only published events, never proposals or unpublished events", () => {
    const rows = ["published", "pending_approval", "unpublished", "cancelled"].map((status) => event(status, status, "2026-11-24T12:00:00.000Z"));
    expect(filterPublicEvents(rows, {}, {}, new Date("2026-11-23T00:00:00Z")).map((e) => e.id)).toEqual(["published"]);
  });
  it("keeps upcoming, past and calendar day filters", () => {
    const rows = [event("past", "published", "2026-11-22T12:00:00.000Z"), event("next", "published", "2026-11-24T12:00:00.000Z")];
    const now = new Date("2026-11-23T00:00:00Z");
    expect(filterPublicEvents(rows, {}, {}, now).map((e) => e.id)).toEqual(["next"]);
    expect(filterPublicEvents(rows, {}, { past: true }, now).map((e) => e.id)).toEqual(["past"]);
    expect(filterPublicEvents(rows, {}, { rangeStart: "2026-11-24T00:00:00.000Z", rangeEnd: "2026-11-25T00:00:00.000Z" }, now).map((e) => e.id)).toEqual(["next"]);
  });
});