import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const markAppreciationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ letterId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const visible = await context.supabase
      .from("appreciation_letters")
      .select("id,recipient_id")
      .eq("id", data.letterId)
      .eq("recipient_id", context.userId)
      .maybeSingle();
    if (visible.error || !visible.data) throw new Error("Letter not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("mark_letter_read", { _letter_id: data.letterId, _recipient_id: context.userId });
    if (result.error) throw result.error;
    return { readAt: result.data };
  });