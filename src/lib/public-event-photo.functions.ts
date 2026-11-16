import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: a short-lived signed URL for a published event's cover photo, looked up by its share slug. */
export const getPublicEventPhoto = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin.from("events").select("photo_url").eq("join_slug", data.slug).eq("status", "published").maybeSingle();
    const path = ev?.photo_url;
    if (!path) return { url: null as string | null };
    if (path.startsWith("http")) return { url: path };
    const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(path, 60 * 60);
    return { url: signed?.signedUrl ?? null };
  });

/** Public: link-preview details (title, host, time, cover photo) for a published event's share slug. */
export const getEventShareMeta = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin.rpc("public_event_preview", { _slug: data.slug });
      const ev = rows?.[0];
      if (!ev) return null;
      const { data: row } = await supabaseAdmin.from("events").select("photo_url").eq("join_slug", data.slug).eq("status", "published").maybeSingle();
      let image: string | null = null;
      const path = row?.photo_url;
      if (path?.startsWith("http")) image = path;
      else if (path) {
        const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 30);
        image = signed?.signedUrl ?? null;
      }
      const tz = ev.timezone || "UTC";
      const when = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(new Date(ev.starts_at));
      return { title: ev.title as string, host: (ev.host_name as string | null) ?? null, when, image };
    } catch {
      return null;
    }
  });
