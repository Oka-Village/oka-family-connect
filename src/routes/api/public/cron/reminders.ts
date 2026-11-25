import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const parsed = z.object({ kind: z.literal("event_reminders") }).strict()
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        const { handleEventReminders } = await import("@/server/event-reminders.server");
        const extended = request as Request & { waitUntil?: (task: Promise<unknown>) => void };
        if (extended.waitUntil) {
          extended.waitUntil(handleEventReminders());
          return Response.json({ ok: true, accepted: true }, { status: 202 });
        }
        // Local development has no Worker lifetime extension.
        return handleEventReminders();
      },
    },
  },
});