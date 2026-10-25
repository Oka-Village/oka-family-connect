import { describe, expect, it } from "vitest";
import { AFFILIATE_SHARE_PCT, affiliateCreditCents } from "./affiliate-share";

describe("affiliate credit shown to referrers", () => {
  it("credits every referrer a fixed 50% of what the invited member paid", () => {
    expect(AFFILIATE_SHARE_PCT).toBe(50);
    expect(affiliateCreditCents(25000)).toBe(12500);
    expect(affiliateCreditCents(2900)).toBe(1450);
  });
  it("ignores each affiliate's own stored commission rate", () => {
    expect(affiliateCreditCents(25000, AFFILIATE_SHARE_PCT)).toBe(affiliateCreditCents(25000));
    expect(affiliateCreditCents(25000, AFFILIATE_SHARE_PCT)).not.toBe(affiliateCreditCents(25000, 10));
    expect(affiliateCreditCents(25000, AFFILIATE_SHARE_PCT)).not.toBe(affiliateCreditCents(25000, 75));
  });
  it("never credits more than the invited member paid", () => {
    expect(affiliateCreditCents(0)).toBe(0);
    expect(affiliateCreditCents(99)).toBe(49);
    expect(affiliateCreditCents(25000)).toBeLessThanOrEqual(25000);
  });
});
