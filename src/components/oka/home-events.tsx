import { useQuery } from "@tanstack/react-query";

import { EventCard } from "@/components/oka/event-card";
import { fetchEvents, fetchMyRsvps } from "@/lib/events";

/** Home: the member's upcoming RSVPs, or 3 soonest unregistered events; hidden when nothing is upcoming. */
export function HomeEvents() {
  const q = useQuery({
    queryKey: ["home-next-events"],
    queryFn: async () => {
      const upcoming = (await fetchEvents({}, { limit: 100 })).filter((e) => e.status === "published");
      const rsvps = await fetchMyRsvps(upcoming.map((e) => e.id));
      const mine = upcoming.filter((e) => rsvps[e.id] === "going" || rsvps[e.id] === "waitlist");
      return mine.length
        ? { title: "My next events", items: mine, rsvps }
        : { title: "Events you might like", items: upcoming.filter((e) => !rsvps[e.id] || rsvps[e.id] === "cancelled").slice(0, 3), rsvps };
    },
  });
  if (!q.data || q.data.items.length === 0) return null;
  return (
    <section aria-labelledby="home-events-heading" className="flex flex-col gap-5">
      <h2 id="home-events-heading" className="section-label">{q.data.title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {q.data.items.map((e) => <EventCard key={e.id} event={e} rsvp={q.data.rsvps[e.id]} />)}
      </div>
    </section>
  );
}
