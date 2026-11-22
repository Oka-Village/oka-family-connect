import { describe, expect, it } from "vitest";
import { giftEligibility, giftEndsAt, giftUrl } from "./gift";

describe("admin gift links", () => {
  it("grants exactly 60 days from the claim", () => {
    expect(giftEndsAt(new Date("2026-12-01T00:00:00.000Z"))).toBe("2027-01-30T00:00:00.000Z");
  });
  it("lets a new unpaid member claim", () => {
    expect(giftEligibility({ paid: false, trialEndsAt: null, isGiver: false })).toBe("ok");
  });
  it("can be claimed only once", () => {
    expect(giftEligibility({ paid: false, trialEndsAt: "2027-01-30T00:00:00.000Z", isGiver: false })).toBe("already_granted");
  });
  it("skips paid members and the giver", () => {
    expect(giftEligibility({ paid: true, trialEndsAt: null, isGiver: false })).toBe("already_member");
    expect(giftEligibility({ paid: false, trialEndsAt: null, isGiver: true })).toBe("self");
  });
  it("always shares the production link", () => {
    expect(giftUrl("ABC")).toBe("https://www.oneworldfamily.app/gift/ABC");
  });
});

import { paymentRedirect } from "./membership";
describe("gift page after sign-in", () => {
  it("keeps a new unpaid member on the gift page", () => {
    expect(paymentRedirect("/gift/ABC123", false, false, "none")).toBeNull();
  });
});
