import { describe, expect, it } from "vitest";
import { occurrenceStarts } from "./recurrence";

describe("occurrenceStarts", () => {
  it("non-repeating gives one", () => expect(occurrenceStarts("2026-11-02T18:00", "none", "2026-12-31")).toEqual(["2026-11-02T18:00"]));
  it("daily includes until date", () => expect(occurrenceStarts("2026-11-02T18:00", "daily", "2026-11-04")).toHaveLength(3));
  it("weekly", () => expect(occurrenceStarts("2026-11-02T18:00", "weekly", "2026-11-16")).toEqual(["2026-11-02T18:00", "2026-11-09T18:00", "2026-11-16T18:00"]));
  it("bi-weekly", () => expect(occurrenceStarts("2026-11-02T18:00", "biweekly", "2026-11-30")).toEqual(["2026-11-02T18:00", "2026-11-16T18:00", "2026-11-30T18:00"]));
  it("monthly clamps to month end", () => expect(occurrenceStarts("2026-01-31T10:00", "monthly", "2026-03-31")).toEqual(["2026-01-31T10:00", "2026-02-28T10:00", "2026-03-31T10:00"]));
  it("caps at 52", () => expect(occurrenceStarts("2026-01-01T10:00", "daily", "2027-12-31")).toHaveLength(52));
});
