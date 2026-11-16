import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The database verifies staff authorization and derives the host from the event. */
export const ensureEventHostInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: code, error } = await context.supabase.rpc("ensure_event_host_invite", { _event_id: data.eventId });
    if (error) throw new Error(error.message);
    return code;
  });