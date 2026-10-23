import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MONTHLY_PRICE_ID, hasPaidMembership } from "@/lib/membership";
import { stripeRequest, verifyAndRecordMembership } from "./membership.server";

export const createMonthlyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ acceptedTerms: z.literal(true), origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const origin = new URL(data.origin).origin;
    const allowed = new Set(["http://localhost:8080", "https://oka-family-connect.lovable.app", "https://www.oneworldfamily.app", "https://oneworldfamily.app", "https://id-preview--a83c2bba-a8ee-42e5-93e1-18ab76f82c8a.lovable.app"]);
    if (!allowed.has(origin) || getRequest().headers.get("origin") !== origin) throw new Error("Please start checkout from Oka.");
    const { data: membership, error } = await context.supabase.from("memberships").select("kind,active,current_period_end").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("We couldn’t check your membership. Please try again.");
    if (hasPaidMembership(membership)) return { status: "already" as const };
    const body = new URLSearchParams({
      mode: "subscription", client_reference_id: context.userId,
      "line_items[0][price]": MONTHLY_PRICE_ID, "line_items[0][quantity]": "1",
      "subscription_data[metadata][member_id]": context.userId,
      "subscription_data[billing_mode][type]": "flexible",
      success_url: `${origin}/membership?kind=monthly&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/membership`,
    });
    const email = (context.claims as { email?: string }).email;
    if (email) body.set("customer_email", email);
    const session = await stripeRequest<{ url: string | null }>("checkout/sessions", body);
    if (!session.url) throw new Error("Checkout could not be opened. Please try again.");
    return { status: "ready" as const, url: session.url };
  });

export const confirmMembershipCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().regex(/^cs_[a-zA-Z0-9_]+$/).max(255), kind: z.enum(["founding", "monthly"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return verifyAndRecordMembership(data.sessionId, context.userId, data.kind, supabaseAdmin);
  });