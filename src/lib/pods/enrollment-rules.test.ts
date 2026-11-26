import { describe, expect, it } from "vitest";

import { canCreatePods } from "@/lib/pods/access";
import { POD_PRICE_CENTS } from "@/lib/pods/config";
import {
  canHoldSeat,
  decideConfirmEnrollment,
  purposeFromPodCheckoutMeta,
} from "@/lib/pods/enrollment-rules";
import { POD_MEMBER_SEATS } from "@/lib/pods/constants";
import { isPublicEntryRoute } from "@/lib/membership";
import { classifyPayment } from "@/lib/stripe/reconcile";
import { STRIPE_PRODUCTS } from "@/lib/stripe/config";

describe("pod create authz", () => {
  it("allows staff and facilitators only", () => {
    expect(canCreatePods({ isStaff: true, isFacilitator: false })).toBe(true);
    expect(canCreatePods({ isStaff: false, isFacilitator: true })).toBe(true);
    expect(canCreatePods({ isStaff: true, isFacilitator: true })).toBe(true);
    expect(canCreatePods({ isStaff: false, isFacilitator: false })).toBe(false);
    expect(canCreatePods({})).toBe(false);
  });
});

describe("pods login-only (not a public entry)", () => {
  it.each(["/pods", "/pods/", "/pods/new", "/pods/abc/join", "/pods/abc"])(
    "does not treat %s as a public entry route",
    (path) => {
      expect(isPublicEntryRoute(path)).toBe(false);
    },
  );
});

describe("$175 pod classify", () => {
  it("matches Stripe product amount and reconcile classifier", () => {
    expect(POD_PRICE_CENTS).toBe(17500);
    expect(STRIPE_PRODUCTS.pod.amountCents).toBe(17500);
    expect(classifyPayment({ amountCents: 17500, description: "Oka Pod (one-time)" })).toBe("pod");
    expect(purposeFromPodCheckoutMeta("pod")).toBe("pod");
    expect(purposeFromPodCheckoutMeta("founding")).toBeNull();
  });
});

describe("seat hold race", () => {
  const cap = POD_MEMBER_SEATS;

  it("blocks a 4th hold when 3 are paid", () => {
    expect(
      canHoldSeat({ paidCount: 3, activeHeldCount: 0, capacity: cap, renewingOwnHoldOrPaid: false }),
    ).toBe(false);
  });

  it("blocks a new hold when paid+held fill capacity", () => {
    expect(
      canHoldSeat({ paidCount: 2, activeHeldCount: 1, capacity: cap, renewingOwnHoldOrPaid: false }),
    ).toBe(false);
  });

  it("allows renewing an existing hold even when others fill capacity", () => {
    expect(
      canHoldSeat({ paidCount: 2, activeHeldCount: 1, capacity: cap, renewingOwnHoldOrPaid: true }),
    ).toBe(true);
  });

  it("allows a seat when one remains", () => {
    expect(
      canHoldSeat({ paidCount: 2, activeHeldCount: 0, capacity: cap, renewingOwnHoldOrPaid: false }),
    ).toBe(true);
  });
});

describe("confirm webhook idempotency + overflow", () => {
  it("returns idempotent when already paid", () => {
    expect(decideConfirmEnrollment({ status: "paid", paidCount: 2, capacity: 3 })).toEqual({
      ok: true,
      idempotent: true,
    });
  });

  it("confirms a held seat and marks full at capacity", () => {
    expect(decideConfirmEnrollment({ status: "held", paidCount: 2, capacity: 3 })).toEqual({
      ok: true,
      idempotent: false,
      paidCountAfter: 3,
      full: true,
    });
  });

  it("flags needs_refund when a 4th payment arrives after seats are full", () => {
    expect(decideConfirmEnrollment({ status: "held", paidCount: 3, capacity: 3 })).toEqual({
      ok: false,
      reason: "full",
      needs_refund: true,
    });
  });

  it("second confirm of the same paid enrollment stays idempotent (no double RSVP)", () => {
    const first = decideConfirmEnrollment({ status: "held", paidCount: 0, capacity: 3 });
    expect(first).toMatchObject({ ok: true, idempotent: false });
    const second = decideConfirmEnrollment({ status: "paid", paidCount: 1, capacity: 3 });
    expect(second).toEqual({ ok: true, idempotent: true });
  });
});
