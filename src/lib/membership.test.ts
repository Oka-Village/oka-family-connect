import { describe, expect, it } from "vitest";
import { afterMembershipPayment, hasPaidMembership, isPaymentExempt, isPublicEntryRoute, MONTHLY_PRICE_CENTS, MONTHLY_PRICE_ID, paymentRedirect, validateMembershipSession, type VerifiedSession } from "./membership";
import { isFullMember } from "./member-access";

const monthly: VerifiedSession = { id: "cs_example", mode: "subscription", status: "complete", payment_status: "paid", client_reference_id: "member-a", amount_total: 2900, currency: "usd", customer: "cus_example", subscription: "sub_example", payment_intent: null, line_items: { data: [{ price: { id: MONTHLY_PRICE_ID }, quantity: 1 }] } };
describe("membership payment rules", () => {
  it("requires payment from new members even after the December launch", () => {
    const profile = { member_status: "limited" as const };
    expect(isFullMember(profile, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(isPaymentExempt(profile)).toBe(false);
    expect(paymentRedirect("/home", isPaymentExempt(profile), false)).toBe("/membership");
  });
  it("requires payment from existing full members too", () => {
    expect(isPaymentExempt({ member_status: "full" })).toBe(false);
    expect(paymentRedirect("/home", isPaymentExempt({ member_status: "full" }), false)).toBe("/membership");
  });
  it("preserves only staff exemptions", () => {
    expect(isPaymentExempt({ member_status: "full" }, true)).toBe(true);
    expect(isPaymentExempt({ member_status: "limited" }, true)).toBe(true);
    expect(isPaymentExempt(null)).toBe(false);
  });
  it.each(["/home", "/directory", "/profile", "/events", "/skills", "/houses", "/welcome", "/collections", "/credits"])("does not expose signed-out member content at %s", (path) => {
    expect(isPublicEntryRoute(path)).toBe(false);
  });
  it.each(["/", "/membership", "/privacy", "/terms", "/invite/FRIEND", "/join/gathering", "/facilitators"])("preserves public entry at %s", (path) => {
    expect(isPublicEntryRoute(path)).toBe(true);
  });
  it("charges 29 USD monthly and verifies the configured price", () => {
    expect(MONTHLY_PRICE_CENTS).toBe(2900);
    expect(MONTHLY_PRICE_ID).toBe("price_1UThk4AKS7i2pY48URb0JBTk");
    expect(validateMembershipSession(monthly, "member-a", "monthly")).toBe(true);
    expect(() => validateMembershipSession({ ...monthly, amount_total: 9900 }, "member-a", "monthly")).toThrow();
    expect(() => validateMembershipSession({ ...monthly, line_items: { data: [{ price: { id: "price_other" }, quantity: 1 }] } }, "member-a", "monthly")).toThrow();
  });
  it("verifies the 250 USD founding payment", () => {
    const founding = { ...monthly, mode: "payment", amount_total: 25000, subscription: null };
    expect(validateMembershipSession(founding, "member-a", "founding")).toBe(true);
    expect(() => validateMembershipSession({ ...founding, amount_total: 24900 }, "member-a", "founding")).toThrow();
  });
  it("never accepts another member's payment", () => {
    expect(() => validateMembershipSession(monthly, "member-b", "monthly")).toThrow();
  });
  it("does not activate incomplete or unpaid sessions", () => {
    expect(validateMembershipSession({ ...monthly, payment_status: "unpaid" }, "member-a", "monthly")).toBe(false);
    expect(validateMembershipSession({ ...monthly, status: "open" }, "member-a", "monthly")).toBe(false);
  });
  it.each(["/", "/home", "/profile", "/onboarding", "/events", "/events/new", "/skills/new", "/houses/new", "/affiliate", "/founding", "/facilitators", "/invite/FRIEND"])("redirects unpaid limited members from %s", (path) => {
    expect(paymentRedirect(path, false, false)).toBe("/membership");
  });
  it.each(["/membership", "/privacy", "/terms"])("allows unpaid limited members at %s", (path) => {
    expect(paymentRedirect(path, false, false)).toBeNull();
  });
  it("staff bypass the payment page", () => {
    expect(paymentRedirect("/membership", true, false)).toBe("/home");
    expect(paymentRedirect("/home", true, false)).toBeNull();
  });
  it("paid limited members continue to the step-one gate", () => {
    expect(paymentRedirect("/onboarding", false, true)).toBeNull();
    expect(paymentRedirect("/home", false, true)).toBeNull();
  });
  it("sends paid limited members to onboarding and full members home", () => {
    expect(afterMembershipPayment(false)).toBe("/onboarding");
    expect(afterMembershipPayment(true)).toBe("/home");
  });
  it("keeps founding active without an expiry and monthly active only through its paid period", () => {
    const now = new Date("2026-10-23T08:00:00Z");
    expect(hasPaidMembership({ kind: "founding", active: true }, now)).toBe(true);
    expect(hasPaidMembership({ kind: "founding", active: false }, now)).toBe(false);
    expect(hasPaidMembership({ kind: "monthly", active: true, current_period_end: "2026-11-23T08:00:00Z" }, now)).toBe(true);
    expect(hasPaidMembership({ kind: "monthly", active: true, current_period_end: "2026-10-23T08:00:00Z" }, now)).toBe(false);
    expect(hasPaidMembership(null, now)).toBe(false);
  });
});