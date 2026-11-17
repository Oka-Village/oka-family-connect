import { describe, expect, it } from "vitest";
import { formatEventTimeDual } from "./event-time";

describe("host-primary and viewer-local event times", () => {
  const start = "2026-11-20T00:00:00Z";
  it("keeps New York host time primary and converts to Dhaka", () => {
    const result = formatEventTimeDual(start, null, "America/New_York", "Asia/Dhaka");
    expect(result.primary).toBe("7:00 PM EST");
    expect(result.local).toBe("Fri, Nov 20, 6:00 AM GMT+6 · your time");
  });
  it("omits matching timezone duplicates", () => {
    expect(formatEventTimeDual(start, null, "Asia/Dhaka", "Asia/Dhaka").local).toBeNull();
  });
  it("omits local time before the device timezone is known", () => {
    expect(formatEventTimeDual(start, null, "America/New_York").local).toBeNull();
  });
  it("shows the previous local date", () => {
    expect(formatEventTimeDual(start, null, "Asia/Dhaka", "America/New_York").local).toBe("Thu, Nov 19, 7:00 PM EST · your time");
  });
  it("converts both ends of a session", () => {
    expect(formatEventTimeDual(start, "2026-11-20T01:30:00Z", "America/New_York", "Asia/Dhaka").local).toBe("Fri, Nov 20, 6:00 AM GMT+6 – 7:30 AM GMT+6 · your time");
  });
  it("uses the daylight-saving offset at the event date", () => {
    expect(formatEventTimeDual("2026-07-20T23:00:00Z", null, "America/New_York", "Asia/Dhaka").primary).toBe("7:00 PM EDT");
  });
  it("labels end dates when the session crosses midnight locally", () => {
    expect(formatEventTimeDual("2026-11-20T17:00:00Z", "2026-11-20T19:00:00Z", "America/New_York", "Asia/Dhaka").local).toBe("11:00 PM GMT+6 – Sat, Nov 21, 1:00 AM GMT+6 · your time");
  });
  it("does not repeat the date for same-day conversions", () => {
    expect(formatEventTimeDual("2026-11-20T12:00:00Z", null, "America/New_York", "Asia/Dhaka").local).toBe("6:00 PM GMT+6 · your time");
  });
  it("uses UTC for missing host zones and ignores invalid viewer zones", () => {
    expect(formatEventTimeDual(start, null, null, "invalid")).toEqual({ primary: "12:00 AM UTC", local: null });
  });
});