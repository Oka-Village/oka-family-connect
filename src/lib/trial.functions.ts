import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordTrialOnce } from "./trial-recording";

/** Records only the caller's first trial; it does not grant or extend access. */
export const startTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trial_started_at = await recordTrialOnce({
      startIfUnset: async (timestamp) => {
        const { data, error } = await supabaseAdmin.from("profiles")
          .update({ trial_started_at: timestamp })
          .eq("id", context.userId).is("trial_started_at", null)
          .select("trial_started_at").maybeSingle();
        if (error) throw new Error("We couldn’t start your trial. Please try again.");
        return data?.trial_started_at ?? null;
      },
      readStartedAt: async () => {
        const { data, error } = await context.supabase.from("profiles")
          .select("trial_started_at").eq("id", context.userId).maybeSingle();
        if (error) throw new Error("We couldn’t check your trial. Please try again.");
        return data?.trial_started_at ?? null;
      },
    });
    return { trial_started_at };
  });