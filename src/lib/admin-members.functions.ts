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
    // Block the email from signing up again until an admin unblocks it.
    const found = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = found.data.user?.email?.toLowerCase();
    if (email) {
      const block = await supabaseAdmin.from("blocked_emails").upsert({ email, note: "Deleted by admin" });
      if (block.error) throw new Error("Couldn't block this member's email.");
    }
    // Letters block profile removal, so clear the member's sent and received letters first.
    const letters = await supabaseAdmin.from("appreciation_letters").delete().or(`sender_id.eq.${data.userId},recipient_id.eq.${data.userId}`);
    if (letters.error) throw new Error("Couldn't remove this member's letters.");
    const res = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (res.error) throw new Error(`Couldn't delete this member: ${res.error.message}`);
    return { ok: true };
  });

/** Admin-only read-only: verified membership rows for the listed members, so the Members tab can show payment status. */
export const getAdminMemberStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ userIds: z.array(z.string().uuid()).max(100) }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Only admins can view member payment status.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from("memberships")
      .select("user_id,kind,active,current_period_end")
      .in("user_id", data.userIds);
    if (mErr) throw new Error("We couldn't read member memberships. Please try again.");
    const byUser: Record<string, { user_id: string; kind: string; active: boolean; current_period_end: string | null }> = {};
    for (const m of memberships ?? []) byUser[m.user_id] = m;
    return byUser;
  });
