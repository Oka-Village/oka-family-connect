import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { toCsv } from "@/lib/csv";
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

/** Pure helper: filter members by name or email (case-insensitive), named first alphabetically, then paginate. */
export function filterAdminMembers(
  rows: { id: string; display_name: string | null; email: string | null }[],
  term: string,
  offset: number,
  limit: number,
) {
  const t = term.trim().toLowerCase();
  const matched = rows
    .filter((r) => !t || (r.display_name ?? "").toLowerCase().includes(t) || (r.email ?? "").toLowerCase().includes(t))
    .sort((a, b) => {
      if (!a.display_name && !b.display_name) return (a.email ?? "").localeCompare(b.email ?? "");
      if (!a.display_name) return 1;
      if (!b.display_name) return -1;
      return a.display_name.localeCompare(b.display_name);
    });
  return { page: matched.slice(offset, offset + limit), total: matched.length };
}

/** Admin-only: page through all members (including unfinished profiles), searching by name or email. */
export const searchAdminMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ term: z.string().max(200), offset: z.number().int().min(0), limit: z.number().int().min(1).max(100) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Only admins can list members.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails = new Map<string, string | null>();
    for (let p = 1; p <= 50; p++) {
      const res = await supabaseAdmin.auth.admin.listUsers({ page: p, perPage: 1000 });
      if (res.error) throw new Error("We couldn't read member emails.");
      for (const u of res.data.users) emails.set(u.id, u.email ?? null);
      if (res.data.users.length < 1000) break;
    }
    const { data: profiles, error: pErr } = await supabaseAdmin.from("profiles").select("id,display_name");
    if (pErr) throw new Error("We couldn't read members.");
    const rows = (profiles ?? []).map((p) => ({ id: p.id, display_name: p.display_name, email: emails.get(p.id) ?? null }));
    const { page, total } = filterAdminMembers(rows, data.term, data.offset, data.limit);
    return { members: page.map((m) => ({ id: m.id, email: m.email })), total };
  });

/** Admin-only: every member with email, payment status, location and join date, as CSV text. */
export const exportAdminMembersCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !isAdmin) throw new Error("Only admins can export members.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails = new Map<string, string | null>();
    for (let p = 1; p <= 50; p++) {
      const res = await supabaseAdmin.auth.admin.listUsers({ page: p, perPage: 1000 });
      if (res.error) throw new Error("We couldn't read member emails.");
      for (const u of res.data.users) emails.set(u.id, u.email ?? null);
      if (res.data.users.length < 1000) break;
    }
    const { data: profiles, error: pErr } = await supabaseAdmin.from("profiles").select("id,display_name,location,created_at").order("created_at");
    if (pErr) throw new Error("We couldn't read members.");
    const { data: ms, error: mErr } = await supabaseAdmin.from("memberships").select("user_id,active");
    if (mErr) throw new Error("We couldn't read memberships.");
    const paid = new Set((ms ?? []).filter((m) => m.active).map((m) => m.user_id));
    const rows = [["Name", "Email", "Phone", "Status", "Location", "Joined Date"]];
    for (const p of profiles ?? []) {
      rows.push([p.display_name ?? "", emails.get(p.id) ?? "", "", paid.has(p.id) ? "Paid" : "Free", p.location ?? "", (p.created_at ?? "").slice(0, 10)]);
    }
    return { csv: toCsv(rows), count: rows.length - 1 };
  });
