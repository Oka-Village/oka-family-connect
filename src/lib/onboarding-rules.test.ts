import { describe, expect, it } from "vitest";
import { needsOnboardingPhoto, showSupportOffer, TRIAL_DAYS } from "./onboarding-rules";
import { recordTrialOnce } from "./trial-recording";

describe("free signup requirements", () => {
  it("treats only a stored path as an uploaded photo", () => {
    expect(needsOnboardingPhoto(null)).toBe(true);
    expect(needsOnboardingPhoto(" ")).toBe(true);
    expect(needsOnboardingPhoto("https://lh3.googleusercontent.com/a/photo")).toBe(true);
    expect(needsOnboardingPhoto("http://example.com/a.jpg")).toBe(true);
    expect(needsOnboardingPhoto("member/photo.jpg")).toBe(false);
  });
  it("does not offer payment to paid members", () => {
    expect(showSupportOffer(true, false)).toBe(false);
    expect(showSupportOffer(false, false)).toBe(true);
  });
  it("does not offer payment to exempt members", () => {
    expect(showSupportOffer(false, true)).toBe(false);
  });
  it("offers payment to existing unpaid full-status members", () => {
    expect(showSupportOffer(false, false, null)).toBe(true);
  });
  it("never offers payment to staff or to members who already started a trial", () => {
    expect(showSupportOffer(false, true, null)).toBe(false);
    expect(showSupportOffer(false, false, "2026-10-25T10:00:00.000Z")).toBe(false);
  });
  it("offers a seven-day trial", () => {
    expect(TRIAL_DAYS).toBe(7);
  });
  it("records the first trial only, including concurrent attempts", async () => {
    let stored: string | null = null;
    const store = {
      startIfUnset: async (timestamp: string) => {
        if (stored !== null) return null;
        stored = timestamp;
        return stored;
      },
      readStartedAt: async () => stored,
    };
    const first = new Date("2026-10-25T10:09:00Z");
    const later = new Date("2026-11-01T10:09:00Z");
    expect(await Promise.all([recordTrialOnce(store, first), recordTrialOnce(store, later)]))
      .toEqual([first.toISOString(), first.toISOString()]);
    expect(await recordTrialOnce(store, later)).toBe(first.toISOString());
  });
});