import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("shows an hour as 60 minutes", () => {
    expect(formatDuration(60)).toBe("60 minutes");
  });

  it("shows every length in minutes, never hours", () => {
    expect(formatDuration(30)).toBe("30 minutes");
    expect(formatDuration(90)).toBe("90 minutes");
    expect(formatDuration(120)).toBe("120 minutes");
  });

  it("uses the singular for one minute", () => {
    expect(formatDuration(1)).toBe("1 minute");
  });

  it("returns null when no length is set", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });
});
