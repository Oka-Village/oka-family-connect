/**
 * Browser-safe Stripe → payments reconciliation rules for Open Accounting.
 * Pure functions only, so the matching rules can be tested without Stripe.
 */

export type ReconcilePurpose = "founding_lifetime" | "pod";

/** One Stripe checkout payment, flattened from session + charge + balance txn. */
export type StripePaymentRow = {
  paymentIntentId: string;
  checkoutSessionId: string | null;
  clientReferenceId: string | null;
  email: string | null;
  amountCents: number;
  description: string | null;
  succeeded: boolean;
  refundedCents: number;
  feeCents: number | null;
  createdAt: string;
};

export type DbPaymentRow = {
  id: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  status: string;
  feeCents: number | null;
};

export type ReconcileAction =
  | { type: "insert"; row: StripePaymentRow; purpose: ReconcilePurpose; userId: string }
  | { type: "update"; id: string; status: "paid" | "refunded"; feeCents: number | null; paymentIntentId: string }
  | { type: "unmatched"; row: StripePaymentRow; reason: string };

export const FOUNDING_AMOUNT_CENTS = 25000;
/** Anything below this is a test charge (e.g. the $0.50 launch check). */
export const MIN_REAL_PAYMENT_CENTS = 100;

export function classifyPayment(row: Pick<StripePaymentRow, "amountCents" | "description">): ReconcilePurpose | null {
  if (row.amountCents < MIN_REAL_PAYMENT_CENTS) return null;
  if (row.description && /pod/i.test(row.description)) return "pod";
  if (row.amountCents === FOUNDING_AMOUNT_CENTS) return "founding_lifetime";
  return null;
}

export function targetStatus(row: Pick<StripePaymentRow, "amountCents" | "refundedCents">): "paid" | "refunded" {
  return row.refundedCents >= row.amountCents && row.amountCents > 0 ? "refunded" : "paid";
}

/**
 * Compares Stripe with recorded payments. Each Stripe payment maps to at most
 * one recorded row (by payment intent, then checkout session), so a payment is
 * never counted twice and re-running produces no new actions.
 */
export function planReconciliation(
  stripeRows: StripePaymentRow[],
  dbRows: DbPaymentRow[],
  resolveUser: (row: StripePaymentRow) => string | null,
): ReconcileAction[] {
  const byPi = new Map<string, DbPaymentRow>();
  const bySession = new Map<string, DbPaymentRow>();
  for (const row of dbRows) {
    if (row.stripePaymentIntentId) byPi.set(row.stripePaymentIntentId, row);
    if (row.stripeCheckoutSessionId) bySession.set(row.stripeCheckoutSessionId, row);
  }
  const seen = new Set<string>();
  const actions: ReconcileAction[] = [];
  for (const row of stripeRows) {
    if (!row.succeeded || seen.has(row.paymentIntentId)) continue;
    seen.add(row.paymentIntentId);
    const purpose = classifyPayment(row);
    if (!purpose) continue;
    const status = targetStatus(row);
    const existing = byPi.get(row.paymentIntentId) ?? (row.checkoutSessionId ? bySession.get(row.checkoutSessionId) : undefined);
    if (existing) {
      const feeChanged = row.feeCents != null && existing.feeCents !== row.feeCents;
      const piMissing = existing.stripePaymentIntentId !== row.paymentIntentId;
      if (existing.status !== status || feeChanged || piMissing) {
        actions.push({ type: "update", id: existing.id, status, feeCents: row.feeCents, paymentIntentId: row.paymentIntentId });
      }
      continue;
    }
    const userId = resolveUser(row);
    if (!userId) {
      actions.push({ type: "unmatched", row, reason: "No member account matches this payment." });
      continue;
    }
    actions.push({ type: "insert", row, purpose, userId });
  }
  return actions;
}
