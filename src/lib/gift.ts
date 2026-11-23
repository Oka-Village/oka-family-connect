// Browser-safe rules for member gift links: two free months, once per member.
import { PRODUCTION_ORIGIN } from "./affiliate-share";

export const GIFT_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function giftUrl(code: string) {
  return `${PRODUCTION_ORIGIN}/gift/${code}`;
}

export type GiftEligibility = "ok" | "already_member" | "already_granted" | "self";

/** A gift opens only for unpaid members who never received an admin access end date. */
export function giftEligibility(input: { paid: boolean; trialEndsAt: string | null; isGiver: boolean }): GiftEligibility {
  if (input.isGiver) return "self";
  if (input.paid) return "already_member";
  if (input.trialEndsAt != null) return "already_granted";
  return "ok";
}

export function giftEndsAt(now = new Date()): string {
  return new Date(now.getTime() + GIFT_DAYS * DAY_MS).toISOString();
}
