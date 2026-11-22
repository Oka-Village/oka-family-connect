import { isEventProposalRoute, ownEditTarget, ownListingViewTarget } from "./member-access";
import { trialState, type TrialState } from "./trial-access";

export { trialState } from "./trial-access";
export type { TrialState } from "./trial-access";

export const MONTHLY_PRICE_CENTS = 2900;
export const MONTHLY_PRICE_ID = "price_1UThk4AKS7i2pY48URb0JBTk";
export type MembershipKind = "founding" | "monthly";

/** Staff and explicitly complimentary members are exempt; stored full status alone is not. */
export function isPaymentExempt(profile: { member_status: string; complimentary_access?: boolean | null } | null | undefined, isStaff = false): boolean {
  return isStaff || profile?.complimentary_access === true;
}

export function isPublicEntryRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    ["/", "/membership", "/founding", "/privacy", "/terms", "/facilitators", "/onboarding-chat", "/open-accounting"].includes(path) ||
    /^\/(invite|join|gift)\/[^/]+$/.test(path)
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

/** Pre-choice unpaid members manage only their profile and the payment/legal pages. */
const PROFILE_ONLY_ROUTES = new Set(["/onboarding", "/profile", "/home", "/welcome"]);
/** An active trial adds skill and house creation on top of profile-only routes. Event proposals stay open for every member. */
const CONTENT_ADDING_ROUTES = new Set(["/skills/new", "/houses/new", "/skills", "/houses", "/open-accounting"]);
/** The invite space is open in every state, including before a member has chosen to pay or trial. */
const ALWAYS_ALLOWED_ROUTES = new Set(["/membership", "/privacy", "/terms", "/founding", "/affiliate", "/earnings", "/events", "/skills/new", "/houses/new", "/skills", "/houses", "/open-accounting"]);

export function paymentRedirect(pathname: string, fullAccess: boolean, paid: boolean, trial: TrialState): "/membership" | "/home" | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (fullAccess) return path === "/membership" ? "/home" : null;
  if (paid || trial === "active") return null;
  if (ALWAYS_ALLOWED_ROUTES.has(path) || isEventProposalRoute(path)) return null;
  // Own skill/home pages and edits: the member-access gate verifies ownership before rendering.
  if (ownListingViewTarget(path) || ownEditTarget(path)) return null;
  if (trial === "expired") return "/membership";
  if (PROFILE_ONLY_ROUTES.has(path)) return null;
  return "/home";
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
