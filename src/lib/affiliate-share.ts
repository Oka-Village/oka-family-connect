/**
 * Every referrer earns the same fixed share of what an invited member paid.
 * This is deliberately independent of any affiliate's stored commission_pct so the
 * page can promise the same number to everyone.
 */
export const AFFILIATE_SHARE_PCT = 50;

/** Affiliate credit for one paid amount, in cents, rounded down. */
export function affiliateCreditCents(paidCents: number, sharePct = AFFILIATE_SHARE_PCT): number {
  return Math.floor((paidCents * sharePct) / 100);
}
