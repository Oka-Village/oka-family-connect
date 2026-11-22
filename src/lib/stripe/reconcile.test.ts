import { describe, expect, it } from "vitest";
import { classifyPayment, planReconciliation, type StripePaymentRow, type DbPaymentRow } from "./reconcile";

const base: StripePaymentRow = {
  paymentIntentId: "pi_1", checkoutSessionId: "cs_1", clientReferenceId: "user-1", email: "a@x.com",
  amountCents: 25000, description: "Founding membership", succeeded: true, refundedCents: 0, feeCents: 755,
  createdAt: "2026-10-22T00:00:00Z",
};
const resolve = (r: StripePaymentRow) => r.clientReferenceId;

describe("classifyPayment", () => {
  it("$250 is founding", () => expect(classifyPayment(base)).toBe("founding_lifetime"));
  it("Oka Pod is pod, not membership", () => expect(classifyPayment({ amountCents: 17500, description: "Oka Pod (one-time)" })).toBe("pod"));
  it("$0.50 test charge is ignored", () => expect(classifyPayment({ amountCents: 50, description: null })).toBeNull());
});

describe("planReconciliation", () => {
  it("inserts a Stripe payment missing from records", () => {
    expect(planReconciliation([base], [], resolve)).toEqual([{ type: "insert", row: base, purpose: "founding_lifetime", userId: "user-1" }]);
  });
  it("marks a fully refunded payment as refunded", () => {
    const db: DbPaymentRow[] = [{ id: "p1", stripePaymentIntentId: "pi_1", stripeCheckoutSessionId: "cs_1", status: "paid", feeCents: 755 }];
    const [action] = planReconciliation([{ ...base, refundedCents: 25000 }], db, resolve);
    expect(action).toMatchObject({ type: "update", status: "refunded" });
  });
  it("produces nothing on a second run once records match", () => {
    const db: DbPaymentRow[] = [{ id: "p1", stripePaymentIntentId: "pi_1", stripeCheckoutSessionId: "cs_1", status: "paid", feeCents: 755 }];
    expect(planReconciliation([base, base], db, resolve)).toEqual([]);
  });
  it("never guesses an owner for an unmatched payment", () => {
    const [action] = planReconciliation([{ ...base, clientReferenceId: null }], [], resolve);
    expect(action?.type).toBe("unmatched");
  });
  it("skips failed payments", () => {
    expect(planReconciliation([{ ...base, succeeded: false }], [], resolve)).toEqual([]);
  });
});
