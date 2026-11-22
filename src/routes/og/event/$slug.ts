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
          // WhatsApp drops preview images over ~300 KB, so serve a resized rendition.
          const LIMIT = 280 * 1024;
          const load = async (width: number | null) => {
            let src = path;
            if (!path.startsWith("http")) {
              const { data } = await supabaseAdmin.storage.from("avatars").createSignedUrl(
                path, 300, width ? { transform: { width, resize: "contain", quality: 70 } } : undefined,
              );
              if (!data?.signedUrl) return null;
              src = data.signedUrl;
            }
            const res = await fetch(src);
            const type = res.headers.get("content-type") ?? "";
            if (!res.ok || !type.startsWith("image/")) return null;
            return { type, buf: await res.arrayBuffer() };
          };
          let img: { type: string; buf: ArrayBuffer } | null = null;
          for (const w of path.startsWith("http") ? [null] : [800, 400, 300]) {
            img = await load(w);
            if (!img || img.buf.byteLength <= LIMIT) break;
          }
          if (!img) return fallback();
          return new Response(img.buf, {
            headers: { "Content-Type": img.type, "Content-Length": String(img.buf.byteLength), "Cache-Control": "public, max-age=86400" },
          });
        } catch {
          return fallback();
        }
      },
    },
  },
});
