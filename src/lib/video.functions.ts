import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAILY_API = "https://api.daily.co/v1";
const EARLY_JOIN_MS = 15 * 60 * 1000;

export type JoinRoomResult =
  | { status: "ok"; url: string; token: string; isOwner: boolean }
  | { status: "not_configured" }
  | { status: "forbidden" | "too_early" | "unavailable"; message: string };

/** Whether in-app video is available (the Daily key is set). Never exposes the key. */
export const getVideoConfigured = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ configured: Boolean(process.env["DAILY_API_KEY"]) }));

export const joinEventRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<JoinRoomResult> => {
    const key = process.env["DAILY_API_KEY"];
    if (!key) return { status: "not_configured" };
    const { supabase, userId } = context;

    // Same visibility rules as the location: host/creator, confirmed RSVP, or admin/moderator.
    const [evRes, going, admin, mod, prof] = await Promise.all([
      supabase.from("events").select("id,title,format,status,starts_at,ends_at,host_id,created_by").eq("id", data.eventId).maybeSingle(),
      supabase.rpc("has_event_rsvp", { _event_id: data.eventId, _going_only: true }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);
    const ev = evRes.data;
    if (!ev || ev.format !== "virtual") return { status: "unavailable", message: "This event has no video room." };
    const isStaff = admin.data === true || mod.data === true;
    const isHost = ev.host_id === userId || ev.created_by === userId;
    if (!isStaff && !isHost && going.data !== true) {
      return { status: "forbidden", message: "The room is open to confirmed guests." };
    }
    if (ev.status !== "published" && !isStaff) return { status: "unavailable", message: "This event isn't live." };

    const start = new Date(ev.starts_at).getTime();
    const end = new Date(ev.ends_at ?? ev.starts_at).getTime() + (ev.ends_at ? 0 : 2 * 3600_000);
    const now = Date.now();
    if (!isStaff && now < start - EARLY_JOIN_MS) return { status: "too_early", message: "The room opens 15 minutes before the start." };
    const roomExp = Math.floor((end + 2 * 3600_000) / 1000);
    if (roomExp * 1000 <= now) return { status: "unavailable", message: "This room has closed." };

    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const name = `oka-${ev.id}`;
    try {
      let room = await fetch(`${DAILY_API}/rooms/${name}`, { headers });
      if (room.status === 404) {
        room = await fetch(`${DAILY_API}/rooms`, {
          method: "POST", headers,
          body: JSON.stringify({ name, privacy: "private", properties: { exp: roomExp, enable_prejoin_ui: true, enable_chat: true } }),
        });
      } else if (room.ok) {
        // Keep expiry in sync if the event time changed.
        room = await fetch(`${DAILY_API}/rooms/${name}`, { method: "POST", headers, body: JSON.stringify({ properties: { exp: roomExp } }) });
      }
      if (!room.ok) throw new Error(`room ${room.status}: ${await room.text()}`);
      const { url } = (await room.json()) as { url: string };

      const isOwner = isHost || admin.data === true;
      const tokRes = await fetch(`${DAILY_API}/meeting-tokens`, {
        method: "POST", headers,
        body: JSON.stringify({ properties: {
          room_name: name, is_owner: isOwner, user_id: userId,
          user_name: prof.data?.display_name ?? "Oka member",
          exp: Math.min(roomExp, Math.floor(now / 1000) + 4 * 3600),
        } }),
      });
      if (!tokRes.ok) throw new Error(`token ${tokRes.status}: ${await tokRes.text()}`);
      const { token } = (await tokRes.json()) as { token: string };
      return { status: "ok", url, token, isOwner };
    } catch (e) {
      console.error("Daily error", e);
      return { status: "unavailable", message: "The room couldn't open just now. Please try again in a moment." };
    }
  });

/** Permanently closes a Daily room. The caller must be its host/creator or an admin. */
export const endEventRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["DAILY_API_KEY"];
    if (!key) return { status: "not_configured" as const };
    const { supabase, userId } = context;
    const [eventResult, adminResult] = await Promise.all([
      supabase.from("events").select("host_id,created_by").eq("id", data.eventId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    const event = eventResult.data;
    if (!event || (event.host_id !== userId && event.created_by !== userId && adminResult.data !== true)) {
      return { status: "forbidden" as const };
    }
    const response = await fetch(`${DAILY_API}/rooms/oka-${data.eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok && response.status !== 404) return { status: "unavailable" as const };
    return { status: "ok" as const };
  });
