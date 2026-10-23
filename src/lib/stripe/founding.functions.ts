/**
 * Founding member checkout: one-time $250 lifetime membership through the
 * owner's Stripe Payment Link. The member's user id travels as
 * client_reference_id; paid status is verified server-side against Stripe
 * before the payment is recorded; limited status is preserved until launch.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FOUNDING_PAYMENT_LINK, FOUNDING_PRICE_CENTS, FOUNDING_TERMS_VERSION } from "@/lib/founding";
import { hasPaidMembership } from "@/lib/membership";
import { verifyAndRecordMembership } from "./membership.server";

export const createFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ acceptedTerms: z.literal(true), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ context }) => {
    const { data: existing, error } = await context.supabase.from("memberships").select("kind,active,current_period_end").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("We couldn’t check your membership. Please try again.");
    if (hasPaidMembership(existing)) return { status: "already" as const };

    const url = new URL(FOUNDING_PAYMENT_LINK);
    url.searchParams.set("client_reference_id", context.userId);
    const email = (context.claims as { email?: string }).email;
    if (email) url.searchParams.set("prefilled_email", email);
    return { status: "ready" as const, url: url.toString() };
  });

export const confirmFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
    .inputValidator((d: unknown) => z.object({ sessionId: z.string().regex(/^cs_[a-zA-Z0-9_]+$/).max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return verifyAndRecordMembership(data.sessionId, context.userId, "founding", supabaseAdmin);
  });
