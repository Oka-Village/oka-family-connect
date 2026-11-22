import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasPaidMembership } from "./membership";
import { giftEligibility, giftEndsAt } from "./gift";

/** Claims an admin's two-month gift for the signed-in caller only. */
export const claimGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ code: z.string().trim().min(3).max(32) }).parse(value))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();
    const aff = await supabaseAdmin.from("affiliates").select("user_id,status").eq("invite_code", code).maybeSingle();
    if (aff.error || !aff.data || aff.data.status !== "active") throw new Error("This gift link isn't active.");
    const role = await supabaseAdmin.from("user_roles").select("id").eq("user_id", aff.data.user_id).eq("role", "admin").maybeSingle();
    if (role.error || !role.data) throw new Error("This gift link isn't active.");

    const [profile, membership] = await Promise.all([
      supabaseAdmin.from("profiles").select("trial_ends_at").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("memberships").select("kind,active,current_period_end").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (profile.error || !profile.data || membership.error) throw new Error("We couldn't check your account. Please try again.");

    const status = giftEligibility({
      paid: hasPaidMembership(membership.data),
      trialEndsAt: profile.data.trial_ends_at,
      isGiver: aff.data.user_id === context.userId,
    });
    if (status !== "ok") return { status, endsAt: profile.data.trial_ends_at };

    const endsAt = giftEndsAt();
    const saved = await supabaseAdmin.from("profiles").update({ trial_ends_at: endsAt } as never)
      .eq("id", context.userId).is("trial_ends_at", null).select("trial_ends_at").maybeSingle();
    if (saved.error) throw new Error("We couldn't open your gift. Please try again.");
    if (!saved.data) return { status: "already_granted" as const, endsAt: null };
    await context.supabase.rpc("claim_referral", { _code: code });
    return { status: "ok" as const, endsAt };
  });
