import { ownEditTarget } from "./member-access";
import { TRIAL_DAYS } from "./onboarding-rules";

export const MONTHLY_PRICE_CENTS = 2900;
export const MONTHLY_PRICE_ID = "price_1UThk4AKS7i2pY48URb0JBTk";
export type MembershipKind = "founding" | "monthly";

/** Only staff are exempt; unpaid members get the same payment/trial choice regardless of member_status. */
export function isPaymentExempt(_profile: { member_status: string } | null | undefined, isStaff = false): boolean {
  return isStaff;
}

export function isPublicEntryRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    ["/", "/membership", "/founding", "/privacy", "/terms", "/facilitators", "/onboarding-chat"].includes(path) ||
    /^\/(invite|join)\/[^/]+$/.test(path)
  );
}

export function hasPaidMembership(
  membership: { active: boolean; kind: string; current_period_end?: string | null } | null | undefined,
  now = new Date(),
): boolean {
  if (!membership?.active) return false;
  if (membership.kind === "founding") return true;
  return (
    membership.kind === "monthly" &&
    Boolean(membership.current_period_end && Date.parse(membership.current_period_end) > now.getTime())
  );
}

/** Payment detour precedes contribution-only access, without changing launch rules. */
export type TrialState = "none" | "active" | "expired";

/** A trial is active for exactly TRIAL_DAYS from profiles.trial_started_at. */
export function trialState(trialStartedAt: string | null | undefined, now = new Date()): TrialState {
  if (!trialStartedAt) return "none";
  const started = Date.parse(trialStartedAt);
  if (Number.isNaN(started)) return "none";
  return now.getTime() - started < TRIAL_DAYS * 24 * 60 * 60 * 1000 ? "active" : "expired";
}

/** Pre-choice unpaid members manage only their profile and the payment/legal pages. */
const PROFILE_ONLY_ROUTES = new Set(["/onboarding", "/profile", "/welcome"]);
/** An active trial adds content creation and own-content editing on top of profile-only routes. */
const CONTENT_ADDING_ROUTES = new Set(["/skills/new", "/houses/new", "/events/new"]);
const ALWAYS_ALLOWED_ROUTES = new Set(["/membership", "/privacy", "/terms", "/founding"]);

export function paymentRedirect(pathname: string, fullAccess: boolean, paid: boolean, trial: TrialState): "/membership" | "/home" | "/welcome" | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (fullAccess) return path === "/membership" ? "/home" : null;
  if (paid) return null;
  if (ALWAYS_ALLOWED_ROUTES.has(path)) return null;
  if (trial === "expired") return "/membership";
  if (trial === "active" && (CONTENT_ADDING_ROUTES.has(path) || ownEditTarget(path))) return null;
  if (PROFILE_ONLY_ROUTES.has(path)) return null;
  return "/welcome";
}

export function afterMembershipPayment(fullAccess: boolean): "/home" | "/onboarding" {
  return fullAccess ? "/home" : "/onboarding";
}

export type VerifiedSession = {
  id: string;
  mode: string;
  status: string;
  payment_status: string;
  client_reference_id: string | null;
  amount_total: number | null;
  currency: string | null;
  customer: string | null;
  subscription: string | null;
  payment_intent: string | null;
  line_items?: { data: { price: { id: string } | null; quantity: number | null }[] };
};

export function validateMembershipSession(session: VerifiedSession, userId: string, kind: MembershipKind): boolean {
  if (session.client_reference_id !== userId) throw new Error("This payment does not belong to your account.");
  const expectedAmount = kind === "founding" ? 25000 : MONTHLY_PRICE_CENTS;
  if (
    session.mode !== (kind === "founding" ? "payment" : "subscription") ||
    session.currency !== "usd" ||
    session.amount_total !== expectedAmount
  ) {
    throw new Error("This payment does not match your membership.");
  }
  if (kind === "monthly") {
    const items = session.line_items?.data;
    if (
      !session.customer ||
      !session.subscription ||
      items?.length !== 1 ||
      items[0]?.price?.id !== MONTHLY_PRICE_ID ||
      items[0]?.quantity !== 1
    )
      throw new Error("This payment does not match your membership.");
  }
  return session.status === "complete" && session.payment_status === "paid";
}
