import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Signed-in member reports a home, stay, session or letter change; the server re-reads the row and checks the caller is part of it. */
export const announceExchangeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ kind: z.enum(["house", "booking", "session", "letter"]), id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { announceExchange } = await import("@/server/exchange-alerts.server");
    await announceExchange({ ...data, userId: context.userId });
    return { ok: true };
  });
