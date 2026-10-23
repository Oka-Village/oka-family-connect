import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FOUNDING_TERMS_VERSION } from "@/lib/founding";
import { MONTHLY_PRICE_ID, validateMembershipSession, type MembershipKind, type VerifiedSession } from "@/lib/membership";

export async function stripeRequest<T>(path: string, body?: URLSearchParams): Promise<T> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not connected yet.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2025-08-27.basil", ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body,
  });
  const result = await response.json() as T;
  if (!response.ok) {
    console.error("Membership Stripe request failed", { status: response.status, path: path.split("?")[0] });
    throw new Error("We couldn’t check your payment with Stripe. Please try again.");
  }
  return result;
}

type Subscription = { status: string; customer: string; items: { data: { price: { id: string }; current_period_end: number }[] } };

export async function verifyAndRecordMembership(sessionId: string, userId: string, kind: MembershipKind, admin: SupabaseClient<Database>) {
  const session = await stripeRequest<VerifiedSession>(`checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=line_items`);
  if (!validateMembershipSession(session, userId, kind)) return { paid: false };
  let periodEnd: string | null = null;
  if (kind === "monthly") {
    if (!session.subscription) throw new Error("Subscription details are missing.");
    const subscription = await stripeRequest<Subscription>(`subscriptions/${encodeURIComponent(session.subscription)}`);
    const item = subscription.items.data[0];
    if (subscription.status !== "active" || subscription.customer !== session.customer || subscription.items.data.length !== 1 || item?.price.id !== MONTHLY_PRICE_ID || !item.current_period_end || item.current_period_end * 1000 <= Date.now()) return { paid: false };
    periodEnd = new Date(item.current_period_end * 1000).toISOString();
  }
  const { error } = await admin.rpc("record_verified_membership", {
    _user_id: userId, _kind: kind, _session_id: session.id,
    _customer_id: session.customer ?? "", _subscription_id: session.subscription ?? "",
    _period_end: periodEnd ?? undefined, _payment_intent: session.payment_intent ?? "",
    _amount: session.amount_total ?? 0,
    _metadata: { terms_version: FOUNDING_TERMS_VERSION, source: kind === "founding" ? "payment_link" : "checkout" },
  });
  if (error) { console.error("Membership persistence failed", { code: error.code }); throw new Error("Your payment could not be recorded. Please try confirming again."); }
  return { paid: true };
}