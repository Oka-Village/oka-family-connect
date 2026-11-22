import { describe, expect, it } from "vitest";

import { bucketUpcomingEvents } from "./event-schedule";

describe("bucketUpcomingEvents", () => {
  it("splits this week from later and labels the ranges", () => {
    // Wednesday 19 Nov 2026 local assumption via fixed Date
    const now = new Date("2026-11-19T12:00:00");
    const events = [
      { id: "a", starts_at: "2026-11-20T15:00:00.000Z" },
      { id: "b", starts_at: "2026-11-25T15:00:00.000Z" },
      { id: "c", starts_at: "2026-12-02T15:00:00.000Z" },
    ];
    const result = bucketUpcomingEvents(events, now);
    expect(result.thisWeek.map((e) => e.id)).toEqual(["a"]);
    expect(result.later.map((e) => e.id)).toEqual(["b", "c"]);
    expect(result.laterTitle).toMatch(/^Later in /);
    expect(result.thisWeekHint.length).toBeGreaterThan(0);
  });
});
