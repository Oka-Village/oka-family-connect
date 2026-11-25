import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Signed-in member reports their own signup; the server decides whether it is new. */
export const announceMySignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { announceSignup } = await import("@/server/community-alerts.server");
    await announceSignup(context.userId);
    return { ok: true };
  });

/** Signed-in member reports an RSVP made through someone's ?ref link. */
export const announceReferralRsvpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), code: z.string().trim().min(4).max(32) }).parse(input))
  .handler(async ({ data, context }) => {
    const { announceReferralRsvp } = await import("@/server/community-alerts.server");
    await announceReferralRsvp({ userId: context.userId, eventId: data.eventId, code: data.code });
    return { ok: true };
  });
