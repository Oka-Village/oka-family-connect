import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { stripeRequest } from "./membership.server";
import { planReconciliation, type StripePaymentRow } from "./reconcile";

type Admin = SupabaseClient<Database>;
type List<T> = { data: T[]; has_more: boolean };
type Session = {
  id: string; payment_intent: string | null; client_reference_id: string | null; amount_total: number | null;
  mode: string; payment_status: string; created: number;
  customer_details?: { email?: string | null } | null; customer_email?: string | null;
  line_items?: { data: { description?: string | null }[] };
};
type Charge = {
  id: string; payment_intent: string | null; paid: boolean; status: string; amount: number; amount_refunded: number;
  balance_transaction: { fee: number } | string | null;
};

async function listAll<T extends { id: string }>(path: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res: List<T> = await stripeRequest<List<T>>(`${path}${sep}limit=100${after ? `&starting_after=${after}` : ""}`);
    out.push(...res.data);
    if (!res.has_more || res.data.length === 0) break;
    after = res.data[res.data.length - 1]!.id;
  }
  return out;
}

export async function fetchStripePayments(): Promise<StripePaymentRow[]> {
  const [sessions, charges] = await Promise.all([
    listAll<Session>("checkout/sessions?status=complete&expand%5B%5D=data.line_items"),
    listAll<Charge>("charges?expand%5B%5D=data.balance_transaction"),
  ]);
  const chargeByPi = new Map<string, Charge>();
  for (const c of charges) if (c.payment_intent && c.paid && c.status === "succeeded") chargeByPi.set(c.payment_intent, c);
  return sessions
    .filter((s) => s.mode === "payment" && s.payment_status === "paid" && s.payment_intent)
    .map((s) => {
      const charge = chargeByPi.get(s.payment_intent!);
      const bt = charge?.balance_transaction;
      return {
        paymentIntentId: s.payment_intent!,
        checkoutSessionId: s.id,
        clientReferenceId: s.client_reference_id,
        email: (s.customer_details?.email ?? s.customer_email ?? null)?.toLowerCase() ?? null,
        amountCents: s.amount_total ?? 0,
        description: s.line_items?.data[0]?.description ?? null,
        succeeded: Boolean(charge),
        refundedCents: charge?.amount_refunded ?? 0,
        feeCents: bt && typeof bt === "object" ? bt.fee : null,
        createdAt: new Date(s.created * 1000).toISOString(),
      };
    });
}

export type ReconcileSummary = { checkedAt: string; inserted: number; updated: number; unmatched: number; ok: boolean };

export async function reconcileWithStripe(admin: Admin): Promise<ReconcileSummary> {
  const stripeRows = await fetchStripePayments();
  const { data: dbPayments, error } = await admin
    .from("payments")
    .select("id, stripe_payment_intent_id, stripe_checkout_session_id, status, metadata");
  if (error) throw error;
  const metaById = new Map<string, Record<string, unknown>>();
  const dbRows = (dbPayments ?? []).map((p) => {
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    metaById.set(p.id, meta);
    const fee = Number(meta["processing_fee_cents"]);
    return { id: p.id, stripePaymentIntentId: p.stripe_payment_intent_id, stripeCheckoutSessionId: p.stripe_checkout_session_id, status: p.status, feeCents: Number.isFinite(fee) && meta["processing_fee_cents"] != null ? fee : null };
  });

  const { data: profiles } = await admin.from("profiles").select("id");
  const profileIds = new Set((profiles ?? []).map((p) => p.id));
  const emailToId = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emailToId.set(u.email.toLowerCase(), u.id);
    if (!data || data.users.length < 1000) break;
  }
  const resolveUser = (row: StripePaymentRow) => {
    if (row.clientReferenceId && profileIds.has(row.clientReferenceId)) return row.clientReferenceId;
    const byEmail = row.email ? emailToId.get(row.email) : undefined;
    return byEmail && profileIds.has(byEmail) ? byEmail : null;
  };

  const actions = planReconciliation(stripeRows, dbRows, resolveUser);
  let inserted = 0, updated = 0, unmatched = 0;
  for (const action of actions) {
    if (action.type === "unmatched") { unmatched++; continue; }
    if (action.type === "update") {
      const meta = { ...metaById.get(action.id), ...(action.feeCents != null ? { processing_fee_cents: action.feeCents } : {}) };
      const { error: e } = await admin.from("payments")
        .update({ status: action.status, stripe_payment_intent_id: action.paymentIntentId, metadata: meta as Json })
        .eq("id", action.id);
      if (!e) updated++;
      continue;
    }
    const { row, purpose, userId } = action;
    const { error: e } = await admin.from("payments").insert({
      user_id: userId, stripe_checkout_session_id: row.checkoutSessionId, stripe_payment_intent_id: row.paymentIntentId,
      amount_cents: row.amountCents, currency: "usd", purpose, status: row.refundedCents >= row.amountCents ? "refunded" : "paid",
      metadata: { source: "stripe_reconciliation", ...(row.feeCents != null ? { processing_fee_cents: row.feeCents } : {}) },
      created_at: row.createdAt,
    });
    if (e) continue;
    inserted++;
    if (purpose === "founding_lifetime") {
      await admin.from("memberships").upsert({
        user_id: userId, kind: "founding", active: true,
        stripe_checkout_session_id: row.checkoutSessionId ?? `rc_${row.paymentIntentId}`,
        current_period_end: "infinity", created_at: row.createdAt, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id", ignoreDuplicates: true });
    }
  }
  if (inserted || updated) {
    await admin.rpc("sync_member_earnings");
  }
  return { checkedAt: new Date().toISOString(), inserted, updated, unmatched, ok: true };
}
