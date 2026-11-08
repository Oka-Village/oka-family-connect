import { useQuery } from "@tanstack/react-query";

import { EventCard } from "@/components/oka/event-card";
import { groupEventSeries } from "@/lib/event-series";
import { fetchEvents, fetchMyRsvps, type EventRow } from "@/lib/events";

/**
 * Home: the member's upcoming RSVPs — including ones since called off, so they
 * are not left wondering — or 3 soonest unregistered events; hidden when nothing
 * is upcoming.
 */
export function HomeEvents() {
  const q = useQuery({
    queryKey: ["home-next-events"],
    queryFn: async () => {
      const all = await fetchEvents({}, { limit: 100, includeCancelled: true });
      const rsvps = await fetchMyRsvps(all.map((e) => e.id));
      const mine = all.filter((e) => rsvps[e.id] === "going" || rsvps[e.id] === "waitlist");
      const open = all.filter((e) => e.status === "published");
      const cards = (events: EventRow[], seriesLabel: string | null) => events.map((event) => ({ event, seriesLabel }));
      return mine.length
        ? { title: "My next events", items: cards(mine, null), rsvps }
        : {
            title: "Events you might like",
            items: groupEventSeries(open.filter((e) => !rsvps[e.id] || rsvps[e.id] === "cancelled"), "upcoming")
              .slice(0, 3)
              .map((item) => ({ event: item.event, seriesLabel: item.label })),
            rsvps,
          };
    },
  });
  if (!q.data || q.data.items.length === 0) return null;
  return (
    <section aria-labelledby="home-events-heading" className="flex flex-col gap-5">
      <h2 id="home-events-heading" className="section-label">{q.data.title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {q.data.items.map((item) => <EventCard key={item.event.id} event={item.event} seriesLabel={item.seriesLabel} rsvp={q.data.rsvps[item.event.id]} />)}
      </div>
    </section>
  );
}
