import { describe, expect, it } from "vitest";
import { needsOnboardingPhoto, showSupportOffer, TRIAL_DAYS } from "./onboarding-rules";
import { recordTrialOnce } from "./trial-recording";

describe("free signup requirements", () => {
  it("requires a photo regardless of member status", () => {
    expect(needsOnboardingPhoto(null)).toBe(true);
    expect(needsOnboardingPhoto(" ")).toBe(true);
    expect(needsOnboardingPhoto("member/photo.jpg")).toBe(false);
  });
  it("does not offer payment to paid members", () => {
    expect(showSupportOffer(true, false)).toBe(false);
    expect(showSupportOffer(false, false)).toBe(true);
  });
  it("does not offer payment to exempt members", () => {
    expect(showSupportOffer(false, true)).toBe(false);
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