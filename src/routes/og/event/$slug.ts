import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const FALLBACK = "/og/default-gathering.jpg";

// Public share image for a published event: a stable URL (no expiring token) that
// streams the cover photo, falling back to the Oka banner. Exposes no private data.
export const Route = createFileRoute("/og/event/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const fallback = () => Response.redirect(new URL(FALLBACK, request.url).toString(), 302);
        const slug = z.string().trim().min(1).max(120).safeParse(params.slug);
        if (!slug.success) return fallback();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: ev } = await supabaseAdmin
            .from("events").select("photo_url").eq("join_slug", slug.data).eq("status", "published").maybeSingle();
          const path = ev?.photo_url;
          if (!path) return fallback();
          let src = path;
          if (!path.startsWith("http")) {
            const { data } = await supabaseAdmin.storage.from("avatars").createSignedUrl(path, 300);
            if (!data?.signedUrl) return fallback();
            src = data.signedUrl;
          }
          const res = await fetch(src);
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || !type.startsWith("image/")) return fallback();
          return new Response(res.body, {
            headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
          });
        } catch {
          return fallback();
        }
      },
    },
  },
});
