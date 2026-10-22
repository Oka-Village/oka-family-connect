/**
 * Founding member checkout: one-time $250 lifetime membership through the
 * owner's Stripe Payment Link. The member's user id travels as
 * client_reference_id; paid status is verified server-side against Stripe
 * before the payment is recorded and the member is upgraded.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FOUNDING_PAYMENT_LINK, FOUNDING_PRICE_CENTS, FOUNDING_TERMS_VERSION } from "@/lib/founding";

type Session = {
  id: string;
  payment_status: string;
  payment_intent: string | null;
  client_reference_id: string | null;
  amount_total: number | null;
  currency: string | null;
};

async function getSession(id: string) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not connected yet.");
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? "Stripe request failed");
  return json as Session;
}

export const createFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ acceptedTerms: z.literal(true), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("user_id", context.userId)
      .eq("purpose", "founding_lifetime")
      .eq("status", "paid")
      .maybeSingle();
    if (existing) return { status: "already" as const };

    const url = new URL(FOUNDING_PAYMENT_LINK);
    url.searchParams.set("client_reference_id", context.userId);
    const email = (context.claims as { email?: string }).email;
    if (email) url.searchParams.set("prefilled_email", email);
    return { status: "ready" as const, url: url.toString() };
  });

export const confirmFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().min(5).max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const session = await getSession(data.sessionId);
    if (session.client_reference_id !== context.userId)
      throw new Error("This payment does not belong to your account.");
    if (session.amount_total !== FOUNDING_PRICE_CENTS || session.currency !== "usd")
      throw new Error("This payment is not a founding membership.");
    if (session.payment_status !== "paid") return { paid: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (!row) {
      await supabaseAdmin.from("payments").insert({
        user_id: context.userId,
        purpose: "founding_lifetime",
        amount_cents: FOUNDING_PRICE_CENTS,
        currency: "usd",
        status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
        metadata: { terms_version: FOUNDING_TERMS_VERSION, source: "payment_link" },
      });
    }
    await supabaseAdmin.from("profiles").update({ membership_tier: "full" }).eq("id", context.userId);
    return { paid: true };
  });
