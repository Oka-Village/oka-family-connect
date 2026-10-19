import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: permanently delete a member's account. Role is verified as the caller under RLS first. */
export const adminDeleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ userId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You can't delete your own account here.");
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Only admins can delete members.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (res.error) throw new Error(`Couldn't delete this member: ${res.error.message}`);
    return { ok: true };
  });
