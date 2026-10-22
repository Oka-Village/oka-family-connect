/**
 * Founding member checkout: one-time $250 lifetime membership via the owner's
 * Stripe account. Paid status is verified server-side against Stripe before
 * the payment row is marked paid and the member is upgraded.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FOUNDING_PRICE_CENTS, FOUNDING_TERMS_VERSION } from "@/lib/founding";

async function stripe(path: string, init?: { body?: URLSearchParams }) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not connected yet.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.body?.toString(),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? "Stripe request failed");
  return json as { id: string; url: string; payment_status: string; payment_intent: string | null; metadata?: Record<string, string> };
}

export const createFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ acceptedTerms: z.literal(true), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("user_id", context.userId)
      .eq("purpose", "founding_lifetime")
      .eq("status", "paid")
      .maybeSingle();
    if (existing) return { status: "already" as const };

    const origin = new URL(data.origin).origin;
    const email = (context.claims as { email?: string }).email;
    const body = new URLSearchParams({
      mode: "payment",
      success_url: `${origin}/founding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/founding`,
      client_reference_id: context.userId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(FOUNDING_PRICE_CENTS),
      "line_items[0][price_data][product_data][name]": "Oka Founding Member — lifetime",
      "metadata[user_id]": context.userId,
      "metadata[purpose]": "founding_lifetime",
      "metadata[terms_version]": FOUNDING_TERMS_VERSION,
    });
    if (email) body.set("customer_email", email);
    const session = await stripe("checkout/sessions", { body });

    await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      purpose: "founding_lifetime",
      amount_cents: FOUNDING_PRICE_CENTS,
      currency: "usd",
      status: "pending",
      stripe_checkout_session_id: session.id,
      metadata: {
        terms_version: FOUNDING_TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      },
    });
    return { status: "ready" as const, url: session.url as string };
  });

export const confirmFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().min(5).max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const session = await stripe(`checkout/sessions/${encodeURIComponent(data.sessionId)}`);
    if (session.metadata?.["user_id"] !== context.userId || session.metadata?.["purpose"] !== "founding_lifetime")
      throw new Error("This payment does not belong to your account.");
    if (session.payment_status !== "paid") return { paid: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("payments")
      .update({ status: "paid", stripe_payment_intent_id: session.payment_intent ?? null })
      .eq("stripe_checkout_session_id", session.id)
      .eq("user_id", context.userId);
    await supabaseAdmin.from("profiles").update({ membership_tier: "full" }).eq("id", context.userId);
    return { paid: true };
  });
