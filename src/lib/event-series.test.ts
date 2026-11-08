import { describe, expect, it } from "vitest";
import { groupEventSeries, type SeriesEvent } from "./event-series";
import { zonedInputToUtc } from "./events";

const TZ = "America/New_York";
const CREATED = "2026-11-08T05:42:47.083Z";
const NOW = Date.parse("2025-12-01T00:00:00Z");

function row(local: string, patch: Partial<SeriesEvent> = {}): SeriesEvent {
  const timezone = patch.timezone === undefined ? TZ : patch.timezone;
  return {
    id: local,
    title: "Daily Breathwork",
    description: "Sit together",
    event_type: "meditation",
    format: "virtual",
    capacity: null,
    created_by: "host-1",
    created_at: CREATED,
    photo_url: "host-1/events/photo.jpg",
    status: "published",
    ...patch,
    timezone,
    starts_at: patch.starts_at ?? zonedInputToUtc(local, timezone ?? TZ),
  };
}

describe("groupEventSeries", () => {
  it("leaves a one-time event as a single card", () => {
    const grouped = groupEventSeries([row("2026-11-10T17:00", { id: "once", title: "Workshop" })], "upcoming", NOW);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ cadence: null, count: 1, label: null, ids: ["once"], event: { id: "once" } });
  });

  it("collapses a daily run onto the next date and labels it Daily", () => {
    const grouped = groupEventSeries(
      [row("2026-11-10T17:00", { id: "d1" }), row("2026-11-11T17:00", { id: "d2" }), row("2026-11-12T17:00", { id: "d3" })],
      "upcoming",
      NOW,
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.event.id).toBe("d1");
    expect(grouped[0]?.cadence).toBe("daily");
    expect(grouped[0]?.count).toBe(3);
    expect(grouped[0]?.ids).toEqual(["d1", "d2", "d3"]);
    expect(grouped[0]?.label).toContain("Daily · Next:");
    expect(grouped[0]?.label).toContain("2 more dates");
    expect(grouped[0]?.label).not.toContain("Last:");
  });

  it("labels a past series with Last and the latest date", () => {
    const grouped = groupEventSeries(
      [row("2026-11-10T17:00", { id: "d1" }), row("2026-11-11T17:00", { id: "d2" })],
      "past",
    );
    expect(grouped[0]?.event.id).toBe("d2");
    expect(grouped[0]?.label).toContain("Daily · Last:");
    expect(grouped[0]?.label).toContain("1 more date");
  });

  it("collapses weekly and monthly series without calling them daily", () => {
    const weekly = groupEventSeries(
      [row("2026-11-02T18:00", { id: "w1" }), row("2026-11-09T18:00", { id: "w2" }), row("2026-11-16T18:00", { id: "w3" })],
      "upcoming",
      NOW,
    );
    expect(weekly[0]).toMatchObject({ cadence: "weekly", count: 3 });
    expect(weekly[0]?.label).toContain("Weekly · Next:");

    const monthly = groupEventSeries(
      [row("2026-01-31T10:00", { id: "m1" }), row("2026-02-28T10:00", { id: "m2" }), row("2026-03-31T10:00", { id: "m3" })],
      "upcoming",
      NOW,
    );
    expect(monthly[0]).toMatchObject({ cadence: "monthly", event: { id: "m1" }, count: 3 });
    expect(monthly[0]?.label).toContain("Monthly · Next:");
  });

  it("does not treat irregular month-end dates as monthly", () => {
    const grouped = groupEventSeries(
      [row("2026-01-31T10:00", { id: "a" }), row("2026-02-28T10:00", { id: "b" }), row("2026-03-28T10:00", { id: "c" })],
      "upcoming",
      NOW,
    );
    expect(grouped.map((item) => item.event.id)).toEqual(["a", "b", "c"]);
    expect(grouped.every((item) => item.cadence === null)).toBe(true);
  });

  it("recognizes a future slice of a month-end series and a leap-year clamp", () => {
    const slice = groupEventSeries(
      [row("2026-02-28T10:00", { id: "feb" }), row("2026-03-31T10:00", { id: "mar" }), row("2026-04-30T10:00", { id: "apr" })],
      "upcoming",
      NOW,
    );
    expect(slice[0]).toMatchObject({ cadence: "monthly", count: 3 });

    const leap = groupEventSeries(
      [row("2024-01-31T10:00", { id: "jan" }), row("2024-02-29T10:00", { id: "feb" }), row("2024-03-31T10:00", { id: "mar" })],
      "upcoming",
      Date.parse("2024-01-01T00:00:00Z"),
    );
    expect(leap[0]?.cadence).toBe("monthly");
  });

  it("keeps two events with the same title and different created_at separate", () => {
    const grouped = groupEventSeries(
      [
        row("2026-11-10T17:00", { id: "first" }),
        row("2026-11-11T17:00", { id: "second", created_at: "2026-12-01T00:00:00.000Z" }),
      ],
      "upcoming",
      NOW,
    );
    expect(grouped.map((item) => item.event.id)).toEqual(["first", "second"]);
  });

  it("follows local calendar dates across daylight saving and the UTC date boundary", () => {
    const dst = groupEventSeries(
      [row("2026-03-07T18:00", { id: "before" }), row("2026-03-08T18:00", { id: "change" }), row("2026-03-09T18:00", { id: "after" })],
      "upcoming",
      NOW,
    );
    expect(dst[0]).toMatchObject({ cadence: "daily", count: 3, event: { id: "before" } });

    const late = "America/Los_Angeles";
    const firstUtc = zonedInputToUtc("2026-06-15T23:30", late);
    const secondUtc = zonedInputToUtc("2026-06-16T23:30", late);
    expect(firstUtc.slice(0, 10)).not.toBe("2026-06-15");
    const boundary = groupEventSeries(
      [
        row("2026-06-15T23:30", { id: "night", timezone: late }),
        row("2026-06-16T23:30", { id: "next", timezone: late }),
      ],
      "upcoming",
      NOW,
    );
    expect(boundary[0]?.cadence).toBe("daily");
    expect(secondUtc > firstUtc).toBe(true);
  });

  it("keeps surrounding events in their original order", () => {
    const grouped = groupEventSeries(
      [
        row("2026-11-02T18:00", { id: "w1" }),
        row("2026-11-03T12:00", { id: "other", title: "One time", created_at: "2026-11-01T00:00:00.000Z" }),
        row("2026-11-09T18:00", { id: "w2" }),
      ],
      "upcoming",
      NOW,
    );
    expect(grouped.map((item) => item.event.id)).toEqual(["w1", "other"]);
    expect(grouped[0]?.cadence).toBe("weekly");
    expect(grouped[1]?.label).toBeNull();
  });

  it("points an in-progress series at the next upcoming date", () => {
    const now = Date.parse(zonedInputToUtc("2026-11-08T12:00", TZ));
    const grouped = groupEventSeries(
      [
        row("2026-11-02T18:00", { id: "w1" }),
        row("2026-11-03T12:00", { id: "other", title: "One time", created_at: "2026-11-01T00:00:00.000Z" }),
        row("2026-11-09T18:00", { id: "w2" }),
      ],
      "upcoming",
      now,
    );
    expect(grouped.map((item) => item.event.id)).toEqual(["other", "w2"]);
    expect(grouped[1]?.label).toContain("Weekly · Next:");
  });

  it("keeps a daily series when a 2-day hole and a 3-day hole were skipped", () => {
    const dates = [
      "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05",
      "2026-12-06", "2026-12-07", "2026-12-08", "2026-12-09", "2026-12-11",
      "2026-12-12", "2026-12-13", "2026-12-14", "2026-12-17", "2026-12-18",
    ];
    const grouped = groupEventSeries(
      dates.map((date, i) => row(`${date}T17:00`, { id: `d${i}` })),
      "upcoming",
      NOW,
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ cadence: "daily", count: dates.length, event: { id: "d0" } });
    expect(grouped[0]?.label).toContain("Daily · Next:");
    expect(grouped[0]?.label).toContain(`${dates.length - 1} more dates`);
  });

  it("keeps a weekly series when one week was skipped", () => {
    const grouped = groupEventSeries(
      [
        row("2026-11-02T18:00", { id: "w1" }),
        row("2026-11-09T18:00", { id: "w2" }),
        row("2026-11-16T18:00", { id: "w3" }),
        row("2026-11-23T18:00", { id: "w4" }),
        row("2026-12-07T18:00", { id: "w5" }),
        row("2026-12-14T18:00", { id: "w6" }),
      ],
      "upcoming",
      NOW,
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ cadence: "weekly", count: 6, event: { id: "w1" } });
    expect(grouped[0]?.label).toContain("Weekly · Next:");
  });

  it("keeps a monthly series when one month was skipped", () => {
    const grouped = groupEventSeries(
      [
        row("2026-01-15T10:00", { id: "jan" }),
        row("2026-02-15T10:00", { id: "feb" }),
        row("2026-03-15T10:00", { id: "mar" }),
        row("2026-04-15T10:00", { id: "apr" }),
        row("2026-06-15T10:00", { id: "jun" }),
        row("2026-07-15T10:00", { id: "jul" }),
      ],
      "upcoming",
      NOW,
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ cadence: "monthly", count: 6, event: { id: "jan" } });
    expect(grouped[0]?.label).toContain("Monthly · Next:");
  });

  it("leaves a same-batch set of irregular gaps as separate cards", () => {
    const grouped = groupEventSeries(
      [
        row("2026-11-02T18:00", { id: "a" }),
        row("2026-11-03T18:00", { id: "b" }),
        row("2026-11-04T18:00", { id: "c" }),
        row("2026-11-07T18:00", { id: "d" }),
      ],
      "upcoming",
      NOW,
    );
    expect(grouped.map((item) => item.event.id)).toEqual(["a", "b", "c", "d"]);
    expect(grouped.every((item) => item.cadence === null)).toBe(true);
  });
});
