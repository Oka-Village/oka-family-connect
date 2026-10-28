import { describe, expect, it } from "vitest";

import { memberStatusIndicators } from "./member-status";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("memberStatusIndicators", () => {
  it("shows a paid founding member as paid even with an expired trial", () => {
    const s = memberStatusIndicators({ active: true, kind: "founding" }, daysAgo(8), NOW);
    expect(s.paid).toBe(true);
    expect(s.trial).toBe("expired");
  });

  it("shows an unpaid member mid-trial as trialing and not paid", () => {
    const s = memberStatusIndicators(null, daysAgo(2), NOW);
    expect(s.paid).toBe(false);
    expect(s.trial).toBe("active");
  });

  it("shows an expired monthly period as unpaid", () => {
    const s = memberStatusIndicators({ active: true, kind: "monthly", current_period_end: daysAgo(1) }, null, NOW);
    expect(s.paid).toBe(false);
    expect(s.trial).toBe("none");
  });

  it("shows a monthly member inside their period as paid", () => {
    const s = memberStatusIndicators({ active: true, kind: "monthly", current_period_end: daysAgo(-3) }, null, NOW);
    expect(s.paid).toBe(true);
  });

  it("shows a member who never paid or trialed as neither", () => {
    const s = memberStatusIndicators(undefined, null, NOW);
    expect(s.paid).toBe(false);
    expect(s.trial).toBe("none");
  });

  it("treats an inactive membership as unpaid", () => {
    const s = memberStatusIndicators({ active: false, kind: "founding" }, null, NOW);
    expect(s.paid).toBe(false);
  });
});
