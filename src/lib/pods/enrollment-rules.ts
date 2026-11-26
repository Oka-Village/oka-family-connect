/**
 * Browser-safe mirrors of hold/confirm seat accounting.
 * SQL RPCs remain the authority; these guard the same rules in unit tests.
 */

export type EnrollmentStatus = "held" | "paid" | "cancelled" | "expired" | "needs_refund";

/** Whether a new (or renewed) hold may take a seat right now. */
export function canHoldSeat(input: {
  paidCount: number;
  activeHeldCount: number;
  capacity: number;
  renewingOwnHoldOrPaid: boolean;
}): boolean {
  if (input.paidCount >= input.capacity) return false;
  if (input.renewingOwnHoldOrPaid) return true;
  return input.paidCount + input.activeHeldCount < input.capacity;
}

/**
 * Decide the outcome of confirm_pod_enrollment given current counts.
 * Idempotent when already paid; 4th paid seat becomes needs_refund.
 */
export function decideConfirmEnrollment(input: {
  status: EnrollmentStatus;
  paidCount: number;
  capacity: number;
}):
  | { ok: true; idempotent: true }
  | { ok: true; idempotent: false; paidCountAfter: number; full: boolean }
  | { ok: false; reason: "full"; needs_refund: true } {
  if (input.status === "paid") {
    return { ok: true, idempotent: true };
  }
  if (input.paidCount >= input.capacity) {
    return { ok: false, reason: "full", needs_refund: true };
  }
  const paidCountAfter = input.paidCount + 1;
  return {
    ok: true,
    idempotent: false,
    paidCountAfter,
    full: paidCountAfter >= input.capacity,
  };
}

/** Stripe Payment Link metadata.kind → payments.purpose */
export function purposeFromPodCheckoutMeta(kind: string | null | undefined): "pod" | null {
  return kind === "pod" ? "pod" : null;
}
