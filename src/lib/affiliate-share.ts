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

/**
 * Invited people must always land on the real site, so invite links are built from the
 * production origin in every environment — the preview host would be a dead link to a member.
 */
export const PRODUCTION_ORIGIN = "https://www.oneworldfamily.app";

/** The shareable invite link for a code. */
export function inviteUrl(code: string) {
  return `${PRODUCTION_ORIGIN}/invite/${code}`;
}
