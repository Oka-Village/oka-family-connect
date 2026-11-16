import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extendTrialEnd } from "./trial-access";

const trialInput = z.object({
  userId: z.string().uuid(),
  action: z.enum(["extend", "set", "end", "reset"]),
  days: z.number().int().optional(),
  endsAt: z.string().datetime().optional(),
});

type TrialProfile = { trial_started_at: string | null; trial_ends_at: string | null };

/** Admin-only, member-specific trial changes. The database trigger independently blocks self-service edits. */
export const adminUpdateTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => trialInput.parse(value))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !isAdmin) throw new Error("Only admins can change member trials.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let trialEndsAt: string | null;
    if (data.action === "extend") {
      if (!data.days || ![7, 14, 21, 30].includes(data.days)) throw new Error("Choose a 7, 14, 21 or 30 day extension.");
      const found = await supabaseAdmin.from("profiles").select("trial_started_at,trial_ends_at").eq("id", data.userId).maybeSingle();
      if (found.error) throw new Error("We couldn't read this member's trial.");
      if (!found.data) throw new Error("Member not found.");
      const profile = found.data as TrialProfile;
      trialEndsAt = extendTrialEnd(profile.trial_started_at, profile.trial_ends_at, data.days);
    } else if (data.action === "set") {
      const parsed = data.endsAt ? Date.parse(data.endsAt) : Number.NaN;
      if (Number.isNaN(parsed)) throw new Error("Choose a valid trial end date.");
      if (parsed <= Date.now()) throw new Error("Choose a future trial end date.");
      trialEndsAt = new Date(parsed).toISOString();
    } else if (data.action === "end") {
      trialEndsAt = new Date().toISOString();
    } else {
      trialEndsAt = null;
    }

    const saved = await supabaseAdmin.from("profiles")
      .update({ trial_ends_at: trialEndsAt } as never)
      .eq("id", data.userId)
      .select("trial_started_at,trial_ends_at")
      .single();
    if (saved.error) throw new Error("We couldn't save this member's trial.");
    return saved.data as TrialProfile;
  });

/** Complimentary access is explicit and revocable; it does not create or alter a payment record. */
export const adminSetComplimentaryAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ userId: z.string().uuid(), enabled: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !isAdmin) throw new Error("Only admins can grant complimentary access.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const saved = await supabaseAdmin.from("profiles")
      .update({ complimentary_access: data.enabled } as never)
      .eq("id", data.userId)
      .select("id,complimentary_access")
      .single();
    if (saved.error) throw new Error("We couldn't save this member's access.");
    return saved.data as { id: string; complimentary_access: boolean };
  });
