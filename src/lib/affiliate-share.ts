/**
 * Invite links must always land invited people on the real site, so they are built
 * from the production origin in every environment — the preview host would be a dead
 * link to a member.
 *
 * The credit rate itself is never computed here: the affiliate_referral_stats RPC
 * returns earned_cents calculated from each affiliate's stored commission_pct, and
 * the page renders that server value directly.
 */
export const PRODUCTION_ORIGIN = "https://www.oneworldfamily.app";

/** The shareable invite link for a code. */
export function inviteUrl(code: string) {
  return `${PRODUCTION_ORIGIN}/invite/${code}`;
}
