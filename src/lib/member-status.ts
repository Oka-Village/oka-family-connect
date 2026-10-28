import { hasPaidMembership, type TrialState, trialState } from "./membership";

export type MemberStatusIndicators = { paid: boolean; trial: TrialState };

/**
 * The three admin Members tab facts are independent: payment, trial and roles.
 * Roles come from user_roles in the page; this derives payment and trial exactly
 * like the app's access logic does (hasPaidMembership + trialState).
 */
export function memberStatusIndicators(
  membership: { active: boolean; kind: string; current_period_end?: string | null } | null | undefined,
  trialStartedAt: string | null | undefined,
  now = new Date(),
): MemberStatusIndicators {
  return { paid: hasPaidMembership(membership, now), trial: trialState(trialStartedAt, now) };
}
