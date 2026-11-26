import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Host, creator or staff only: the people going to an event, with email (phone not collected yet). */
export const getEventAttendees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ eventId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [ev, admin, mod] = await Promise.all([
      supabase.from("events").select("host_id,created_by").eq("id", data.eventId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
    ]);
    const manager = ev.data && (ev.data.host_id === userId || ev.data.created_by === userId);
    if (!manager && !admin.data && !mod.data) throw new Error("Only the host and admins can see attendees.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rsvps, error } = await supabaseAdmin
      .from("event_rsvps").select("user_id,status,created_at")
      .eq("event_id", data.eventId).in("status", ["going", "waitlist"]).order("created_at");
    if (error) throw new Error("We couldn't read attendees.");
    const ids = (rsvps ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,display_name,photo_url").in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const emails = await Promise.all(ids.map(async (id) => (await supabaseAdmin.auth.admin.getUserById(id)).data.user?.email ?? null));
    return (rsvps ?? []).map((r, i) => ({
      id: r.user_id,
      name: byId.get(r.user_id)?.display_name ?? "Unnamed member",
      photo_url: byId.get(r.user_id)?.photo_url ?? null,
      email: emails[i] ?? null,
      phone: null as string | null,
      status: r.status,
      rsvp_at: r.created_at,
    }));
  });
