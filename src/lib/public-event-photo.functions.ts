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
