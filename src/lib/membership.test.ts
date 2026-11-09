import { describe, expect, it } from "vitest";
import {
  afterMembershipPayment,
  hasPaidMembership,
  isPaymentExempt,
  isPublicEntryRoute,
  MONTHLY_PRICE_CENTS,
  MONTHLY_PRICE_ID,
  paymentRedirect,
  trialState,
  validateMembershipSession,
  type VerifiedSession,
} from "./membership";
import { isFullMember } from "./member-access";

const monthly: VerifiedSession = {
  id: "cs_example",
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  client_reference_id: "member-a",
  amount_total: 2900,
  currency: "usd",
  customer: "cus_example",
  subscription: "sub_example",
  payment_intent: null,
  line_items: { data: [{ price: { id: MONTHLY_PRICE_ID }, quantity: 1 }] },
};
describe("membership payment rules", () => {
  it("requires payment from new members even after the December launch", () => {
    const profile = { member_status: "limited" as const };
    expect(isFullMember(profile, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(isPaymentExempt(profile)).toBe(false);
    expect(paymentRedirect("/home", isPaymentExempt(profile), false, "none")).toBe("/welcome");
  });
  it("no longer exempts unpaid full-status members from payment", () => {
    expect(isPaymentExempt({ member_status: "full" })).toBe(false);
    expect(paymentRedirect("/home", isPaymentExempt({ member_status: "full" }), false, "none")).toBe("/welcome");
  });
  it("exempts staff regardless of member status", () => {
    expect(isPaymentExempt({ member_status: "full" }, true)).toBe(true);
    expect(isPaymentExempt({ member_status: "limited" }, true)).toBe(true);
    expect(isPaymentExempt(null)).toBe(false);
  });
  it.each(["/home", "/directory", "/profile", "/events", "/skills", "/houses", "/welcome", "/collections", "/credits"])(
    "does not expose signed-out member content at %s",
    (path) => {
      expect(isPublicEntryRoute(path)).toBe(false);
    },
  );
  it.each(["/", "/membership", "/privacy", "/terms", "/invite/FRIEND", "/join/gathering", "/facilitators"])(
    "preserves public entry at %s",
    (path) => {
      expect(isPublicEntryRoute(path)).toBe(true);
    },
  );
  it("charges 29 USD monthly and verifies the configured price", () => {
    expect(MONTHLY_PRICE_CENTS).toBe(2900);
    expect(MONTHLY_PRICE_ID).toBe("price_1UThk4AKS7i2pY48URb0JBTk");
    expect(validateMembershipSession(monthly, "member-a", "monthly")).toBe(true);
    expect(() => validateMembershipSession({ ...monthly, amount_total: 9900 }, "member-a", "monthly")).toThrow();
    expect(() =>
      validateMembershipSession(
        { ...monthly, line_items: { data: [{ price: { id: "price_other" }, quantity: 1 }] } },
        "member-a",
        "monthly",
      ),
    ).toThrow();
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
  it.each(["/", "/home", "/directory", "/skills", "/houses", "/collections", "/credits", "/facilitators", "/invite/FRIEND"])(
    "sends unpaid members from browsing route %s to /welcome",
    (path) => {
      expect(paymentRedirect(path, false, false, "none")).toBe("/welcome");
      expect(paymentRedirect(path, false, false, "active")).toBe("/welcome");
    },
  );
  it.each(["/onboarding", "/profile", "/welcome"])("keeps pre-choice and trial-active members on profile-only route %s", (path) => {
    expect(paymentRedirect(path, false, false, "active")).toBeNull();
    expect(paymentRedirect(path, false, false, "none")).toBeNull();
  });
  it.each(["/skills/new", "/houses/new"])("lets every member add content at %s", (path) => {
    expect(paymentRedirect(path, false, false, "active")).toBeNull();
    expect(paymentRedirect(path, false, false, "none")).toBeNull();
    expect(paymentRedirect(path, false, false, "expired")).toBeNull();
  });
  it.each(["/skills/edit/own", "/houses/edit/own", "/skills/own", "/houses/own"])("leaves own listing pages at %s to the ownership gate", (path) => {
    expect(paymentRedirect(path, false, false, "active")).toBeNull();
    expect(paymentRedirect(path, false, false, "none")).toBeNull();
  });
  it.each(["/events/new", "/events/edit/own", "/events/own-gathering"] as const)(
    "lets every unpaid member propose or open their event at %s",
    (path) => {
      expect(paymentRedirect(path, false, false, "none")).toBeNull();
      expect(paymentRedirect(path, false, false, "active")).toBeNull();
      expect(paymentRedirect(path, false, false, "expired")).toBeNull();
    },
  );
  it.each(["/membership", "/privacy", "/terms", "/founding", "/affiliate", "/events"])("always allows %s", (path) => {
    expect(paymentRedirect(path, false, false, "none")).toBeNull();
    expect(paymentRedirect(path, false, false, "active")).toBeNull();
    expect(paymentRedirect(path, false, false, "expired")).toBeNull();
  });
  it.each(["none", "active", "expired"] as const)("keeps the invite space open for every unpaid state: %s", (trial) => {
    expect(paymentRedirect("/affiliate", false, false, trial)).toBeNull();
  });
  it("sends paid members away from the payment page but keeps the invite space open", () => {
    expect(paymentRedirect("/affiliate", false, true, "expired")).toBeNull();
    expect(paymentRedirect("/affiliate", true, false, "none")).toBeNull();
  });
  it.each(["/home", "/profile", "/welcome", "/onboarding", "/"])(
    "sends expired-trial members from %s to /membership",
    (path) => {
      expect(paymentRedirect(path, false, false, "expired")).toBe("/membership");
    },
  );
  it("staff bypass the payment page", () => {
    expect(paymentRedirect("/membership", true, false, "none")).toBe("/home");
    expect(paymentRedirect("/home", true, false, "expired")).toBeNull();
  });
  it("paid limited members continue to the step-one gate", () => {
    expect(paymentRedirect("/onboarding", false, true, "expired")).toBeNull();
    expect(paymentRedirect("/home", false, true, "none")).toBeNull();
  });
  it("runs a trial for exactly seven days", () => {
    const started = "2026-10-25T10:00:00.000Z";
    expect(trialState(null)).toBe("none");
    expect(trialState("not-a-date")).toBe("none");
    expect(trialState(started, new Date("2026-10-25T10:00:00.000Z"))).toBe("active");
    expect(trialState(started, new Date("2026-11-01T09:59:59.999Z"))).toBe("active");
    expect(trialState(started, new Date("2026-11-01T10:00:00.000Z"))).toBe("expired");
  });
  it("sends paid limited members to onboarding and full members home", () => {
    expect(afterMembershipPayment(false)).toBe("/onboarding");
    expect(afterMembershipPayment(true)).toBe("/home");
  });
  it("keeps founding active without an expiry and monthly active only through its paid period", () => {
    const now = new Date("2026-10-23T08:00:00Z");
    expect(hasPaidMembership({ kind: "founding", active: true }, now)).toBe(true);
    expect(hasPaidMembership({ kind: "founding", active: false }, now)).toBe(false);
    expect(hasPaidMembership({ kind: "monthly", active: true, current_period_end: "2026-11-23T08:00:00Z" }, now)).toBe(
      true,
    );
    expect(hasPaidMembership({ kind: "monthly", active: true, current_period_end: "2026-10-23T08:00:00Z" }, now)).toBe(
      false,
    );
    expect(hasPaidMembership(null, now)).toBe(false);
  });
});
