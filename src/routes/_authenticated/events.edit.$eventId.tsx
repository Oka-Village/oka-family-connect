import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EventForm } from "@/components/oka/event-form";
import { useCurrentUserId, useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, type EventRow } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/events/edit/$eventId")({
  head: () => ({
    meta: [
      { title: "Edit event — Oka" },
      { name: "description", content: "Update the details of an Oka event." },
      { property: "og:title", content: "Edit event — Oka" },
      { property: "og:description", content: "Update the details of an Oka event." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditEvent,
});

function EditEvent() {
  const { eventId } = Route.useParams();
  const admin = useIsAdmin();
  const uid = useCurrentUserId();
  const q = useQuery({
    queryKey: ["event-edit", eventId],
    queryFn: async () => {
      const [ev, loc] = await Promise.all([
        supabase.from("events").select(EVENT_SELECT).eq("id", eventId).maybeSingle(),
        supabase.from("event_locations").select("venue_address,video_link").eq("event_id", eventId).maybeSingle(),
      ]);
      if (ev.error) throw ev.error;
      return { event: ev.data as unknown as EventRow | null, location: loc.data };
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:py-16">
      <p className="section-label">Edit event</p>
      <h1 className="mt-3 text-4xl text-foreground">{q.data?.event?.title ?? "Event"}</h1>
      {q.data && !q.data.event && <p className="mt-6 text-muted-foreground">This event isn't available to edit.</p>}
      {q.data?.event && uid.data && !admin.isLoading && (
        <EventForm mode="edit" isAdmin={!!admin.data} userId={uid.data} initial={q.data.event} initialLocation={q.data.location} />
      )}
    </div>
  );
}
