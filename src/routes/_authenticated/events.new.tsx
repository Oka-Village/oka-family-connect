import { createFileRoute } from "@tanstack/react-router";

import { EventForm } from "@/components/oka/event-form";
import { useCurrentUserId, useIsStaff } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({
    meta: [
      { title: "Propose an event — Oka" },
      { name: "description", content: "Propose a gathering, workshop or retreat for the Oka family." },
      { property: "og:title", content: "Propose an event — Oka" },
      { property: "og:description", content: "Propose a gathering, workshop or retreat for the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewEvent,
});

function NewEvent() {
  const admin = useIsStaff();
  const uid = useCurrentUserId();
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:py-16">
      <p className="section-label">New event</p>
      <h1 className="mt-3 text-4xl text-foreground">
        {admin.data ? "Create an event" : "Propose an event"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {admin.data
          ? "As an admin or moderator, your event is published straight away."
          : "An admin will review your proposal before it appears on the schedule."}
      </p>
      {uid.data && !admin.isLoading && <EventForm mode="create" isAdmin={!!admin.data} userId={uid.data} />}
    </div>
  );
}
