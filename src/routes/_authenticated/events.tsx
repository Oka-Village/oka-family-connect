import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/oka/empty-state";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "Events — Oka" },
      {
        name: "description",
        content: "Gatherings, workshops, pod sessions and retreats across the Oka family.",
      },
      { property: "og:title", content: "Events — Oka" },
      {
        property: "og:description",
        content: "Gatherings, workshops, pod sessions and retreats across the Oka family.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <EmptyState
      icon={CalendarDays}
      label="Events"
      title="The schedule is coming together soon"
      description="Gatherings, workshops, pod sessions and retreats will appear here as the family sets the dates. You'll be able to see what's near you and say you're coming."
    />
  );
}
