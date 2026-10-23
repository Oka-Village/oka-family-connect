export const MONTHLY_PRICE_CENTS = 2900;
export const MONTHLY_PRICE_ID = "price_1UThk4AKS7i2pY48URb0JBTk";
export type MembershipKind = "founding" | "monthly";

/** Only staff are exempt; stored full status and launch day never waive payment. */
export function isPaymentExempt(_profile: { member_status: string } | null | undefined, isStaff = false): boolean {
  return isStaff;
}

export function isPublicEntryRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return ["/", "/membership", "/founding", "/privacy", "/terms", "/facilitators", "/onboarding-chat"].includes(path)
    || /^\/(invite|join)\/[^/]+$/.test(path);
}

export function hasPaidMembership(membership: { active: boolean; kind: string; current_period_end?: string | null } | null | undefined, now = new Date()): boolean {
  if (!membership?.active) return false;
  if (membership.kind === "founding") return true;
  return membership.kind === "monthly" && Boolean(membership.current_period_end && Date.parse(membership.current_period_end) > now.getTime());
}

/** Payment detour precedes contribution-only access, without changing launch rules. */
export function paymentRedirect(pathname: string, fullAccess: boolean, paid: boolean): "/membership" | "/home" | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (fullAccess) return path === "/membership" ? "/home" : null;
  if (paid) return null;
  if (path === "/membership" || path === "/privacy" || path === "/terms") return null;
  return "/membership";
}

export function afterMembershipPayment(fullAccess: boolean): "/home" | "/onboarding" {
  return fullAccess ? "/home" : "/onboarding";
}

export type VerifiedSession = {
  id: string; mode: string; status: string; payment_status: string;
  client_reference_id: string | null; amount_total: number | null; currency: string | null;
  customer: string | null; subscription: string | null; payment_intent: string | null;
  line_items?: { data: { price: { id: string } | null; quantity: number | null }[] };
};

export function validateMembershipSession(session: VerifiedSession, userId: string, kind: MembershipKind): boolean {
  if (session.client_reference_id !== userId) throw new Error("This payment does not belong to your account.");
  const expectedAmount = kind === "founding" ? 25000 : MONTHLY_PRICE_CENTS;
  if (session.mode !== (kind === "founding" ? "payment" : "subscription") || session.currency !== "usd" || session.amount_total !== expectedAmount) {
    throw new Error("This payment does not match your membership.");
  }
  if (kind === "monthly") {
    const items = session.line_items?.data;
    if (!session.customer || !session.subscription || items?.length !== 1 || items[0]?.price?.id !== MONTHLY_PRICE_ID || items[0]?.quantity !== 1) throw new Error("This payment does not match your membership.");
  }
  return session.status === "complete" && session.payment_status === "paid";
}