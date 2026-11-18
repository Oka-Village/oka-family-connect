/**
 * Stripe webhook processing for My Earnings / Open Accounting.
 * Verifies STRIPE_WEBHOOK_SECRET, then writes payments, memberships,
 * ledger deductions, and payout status via the service-role client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { STRIPE_SECRET_NAMES } from "./config";

type AdminClient = SupabaseClient<Database>;

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify Stripe-Signature header (t=…,v1=…). Rejects timestamps older than 5 minutes. */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((piece) => {
      const [k, ...rest] = piece.split("=");
      return [k?.trim() ?? "", rest.join("=")];
    }),
  );
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return timingSafeEqual(expected, v1);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function purposeFromInvoice(obj: Record<string, unknown>): "membership_monthly" | "membership_annual" | "founding_lifetime" | "pod" {
  const meta = (obj["metadata"] ?? {}) as Record<string, unknown>;
  const kind = asString(meta["kind"]) ?? asString(meta["membership_kind"]);
  if (kind === "founding") return "founding_lifetime";
  if (kind === "annual" || kind === "membership_annual") return "membership_annual";
  if (kind === "pod") return "pod";
  return "membership_monthly";
}

async function resolveUserId(admin: AdminClient, obj: Record<string, unknown>): Promise<string | null> {
  const meta = (obj["metadata"] ?? {}) as Record<string, unknown>;
  const fromMeta = asString(meta["member_id"]) ?? asString(meta["user_id"]) ?? asString(obj["client_reference_id"]);
  if (fromMeta) return fromMeta;

  const customerId = asString(obj["customer"]);
  if (!customerId) return null;
  const { data } = await admin.from("memberships").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}

async function upsertPaidPayment(
  admin: AdminClient,
  userId: string,
  obj: Record<string, unknown>,
  purpose: "membership_monthly" | "membership_annual" | "founding_lifetime" | "pod",
) {
  const sessionId = asString(obj["id"])?.startsWith("cs_") ? asString(obj["id"]) : asString(obj["checkout_session"]);
  const paymentIntent = asString(obj["payment_intent"]);
  const amount = asNumber(obj["amount_total"]) ?? asNumber(obj["amount_paid"]) ?? 0;
  const customerId = asString(obj["customer"]);
  const subscriptionId = asString(obj["subscription"]);

  if (sessionId) {
    const { data: existing } = await admin.from("payments").select("id").eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (existing) {
      await admin.from("payments").update({ status: "paid", amount_cents: amount, stripe_payment_intent_id: paymentIntent }).eq("id", existing.id);
    } else {
      await admin.from("payments").insert({
        user_id: userId,
        stripe_checkout_session_id: sessionId,
        stripe_payment_intent_id: paymentIntent,
        amount_cents: amount,
        currency: "usd",
        purpose,
        status: "paid",
        metadata: { source: "stripe_webhook", stripe_customer_id: customerId, stripe_subscription_id: subscriptionId },
      });
    }
  } else if (paymentIntent) {
    const { data: existing } = await admin.from("payments").select("id").eq("stripe_payment_intent_id", paymentIntent).maybeSingle();
    if (existing) {
      await admin.from("payments").update({ status: "paid", amount_cents: amount }).eq("id", existing.id);
    } else {
      await admin.from("payments").insert({
        user_id: userId,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: paymentIntent,
        amount_cents: amount,
        currency: "usd",
        purpose,
        status: "paid",
        metadata: { source: "stripe_webhook", stripe_customer_id: customerId, stripe_subscription_id: subscriptionId },
      });
    }
  }

  if (purpose === "membership_monthly" || purpose === "membership_annual" || purpose === "founding_lifetime") {
    const kind = purpose === "founding_lifetime" ? "founding" : "monthly";
    const periodEnd =
      purpose === "founding_lifetime"
        ? "infinity"
        : new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("memberships").upsert(
      {
        user_id: userId,
        kind,
        active: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_checkout_session_id: sessionId ?? `wh_${paymentIntent ?? userId}`,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  await admin.rpc("sync_member_earnings");
  await admin.rpc("schedule_member_payouts", {});
}

async function handleRefund(admin: AdminClient, obj: Record<string, unknown>) {
  const paymentIntent = asString(obj["payment_intent"]) ?? asString((obj["charge"] as Record<string, unknown> | undefined)?.["payment_intent"]);
  if (!paymentIntent) return;

  const { data: payment } = await admin.from("payments").select("id").eq("stripe_payment_intent_id", paymentIntent).maybeSingle();
  if (!payment) return;

  // Null amount lets SQL compute commission from the original payment.
  await admin.rpc("apply_referral_refund_deduction", {
    p_payment_id: payment.id,
  });
}

async function handleSubscriptionDeleted(admin: AdminClient, obj: Record<string, unknown>) {
  const subscriptionId = asString(obj["id"]);
  if (!subscriptionId) return;
  await admin
    .from("memberships")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}

async function handlePayoutPaid(admin: AdminClient, obj: Record<string, unknown>) {
  const payoutId = asString(obj["id"]);
  if (!payoutId) return;
  const amount = asNumber(obj["amount"]);
  const arrival = asString(obj["arrival_date"]);
  const meta = (obj["metadata"] ?? {}) as Record<string, unknown>;
  const userId = asString(meta["member_id"]) ?? asString(meta["user_id"]);

  if (userId && amount != null) {
    const { data: existing } = await admin
      .from("member_payouts")
      .select("id")
      .eq("user_id", userId)
      .eq("stripe_payout_id", payoutId)
      .maybeSingle();
    if (existing) {
      await admin.from("member_payouts").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", existing.id);
      return;
    }
    const scheduledFor = arrival
      ? new Date(Number(arrival) * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    await admin.from("member_payouts").insert({
      user_id: userId,
      amount_cents: amount,
      status: "paid",
      scheduled_for: scheduledFor,
      payout_method: "stripe_connect",
      stripe_payout_id: payoutId,
    });
    return;
  }

  await admin
    .from("member_payouts")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("stripe_payout_id", payoutId);
}

export async function processStripeWebhookEvent(admin: AdminClient, event: StripeEvent): Promise<void> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      if (asString(obj["payment_status"]) !== "paid" && asString(obj["status"]) !== "complete") break;
      const userId = await resolveUserId(admin, obj);
      if (!userId) break;
      await upsertPaidPayment(admin, userId, obj, purposeFromInvoice(obj));
      break;
    }
    case "invoice.paid": {
      const userId = await resolveUserId(admin, obj);
      if (!userId) break;
      // Normalize invoice fields to the payment writer.
      const normalized = {
        ...obj,
        amount_total: obj["amount_paid"],
        payment_intent: obj["payment_intent"],
        customer: obj["customer"],
        subscription: obj["subscription"],
        metadata: obj["metadata"],
      };
      await upsertPaidPayment(admin, userId, normalized, purposeFromInvoice(obj));
      break;
    }
    case "charge.refunded":
    case "charge.dispute.funds_withdrawn":
      await handleRefund(admin, obj);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(admin, obj);
      break;
    case "payout.paid":
    case "transfer.paid":
      await handlePayoutPaid(admin, obj);
      break;
    default:
      break;
  }
}

/** HTTP entry for POST /api/stripe/webhook. */
export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = process.env[STRIPE_SECRET_NAMES.webhookSecret];
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const ok = await verifyStripeWebhookSignature(rawBody, signature, secret);
  if (!ok) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await processStripeWebhookEvent(supabaseAdmin, event);
  } catch (error) {
    console.error("[stripe-webhook] processing failed", { type: event.type, id: event.id, error });
    return new Response("Processing failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
