import { describe, expect, it } from "vitest";
import { AFFILIATE_SHARE_PCT, affiliateCreditCents, inviteUrl, PRODUCTION_ORIGIN } from "./affiliate-share";

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

describe("invite links shared with other people", () => {
  it("always points a code at the production site", () => {
    expect(inviteUrl("95949302")).toBe("https://www.oneworldfamily.app/invite/95949302");
    expect(inviteUrl("TEST1234")).toBe("https://www.oneworldfamily.app/invite/TEST1234");
  });
  it("never carries the preview or a local host", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://www.oneworldfamily.app");
    expect(inviteUrl("ABC")).not.toContain("lovable");
    expect(inviteUrl("ABC")).not.toContain("localhost");
  });
  it("is a clean single path segment with no trailing slash", () => {
    expect(PRODUCTION_ORIGIN.endsWith("/")).toBe(false);
    expect(inviteUrl("ABC")).toBe(`${PRODUCTION_ORIGIN}/invite/ABC`);
  });
});
