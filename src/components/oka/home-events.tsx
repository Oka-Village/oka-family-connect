import { useQuery } from "@tanstack/react-query";

import { EventCard } from "@/components/oka/event-card";
import { groupEventSeries } from "@/lib/event-series";
import { fetchEvents, fetchMyRsvps, type EventRow } from "@/lib/events";

type Item = { event: EventRow; seriesLabel: string | null };

/**
 * Home: the member's upcoming RSVPs (including ones since called off) when any,
 * plus — always — up to 3 featured upcoming events they haven't joined yet, so
 * new members see what's happening too.
 */
export function HomeEvents() {
  const q = useQuery({
    queryKey: ["home-next-events"],
    queryFn: async () => {
      const all = await fetchEvents({}, { limit: 100, includeCancelled: true });
      const rsvps = await fetchMyRsvps(all.map((e) => e.id));
      const mine: Item[] = all
        .filter((e) => rsvps[e.id] === "going" || rsvps[e.id] === "waitlist")
        .map((event) => ({ event, seriesLabel: null }));
      const featured: Item[] = groupEventSeries(
        all.filter((e) => e.status === "published" && (!rsvps[e.id] || rsvps[e.id] === "cancelled")),
        "upcoming",
      )
        .slice(0, 3)
        .map((item) => ({ event: item.event, seriesLabel: item.label }));
      return { mine, featured, rsvps };
    },
  });
  if (!q.data) return null;
  const { mine, featured, rsvps } = q.data;
  const sections = [
    { key: "mine", title: "My next events", items: mine },
    { key: "featured", title: "Featured events", items: featured },
  ].filter((s) => s.items.length > 0);
  if (!sections.length) return null;
  return (
    <>
      {sections.map((s) => (
        <section key={s.key} aria-labelledby={`home-events-${s.key}-heading`} className="flex flex-col gap-5">
          <h2 id={`home-events-${s.key}-heading`} className="section-label">{s.title}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((item) => <EventCard key={item.event.id} event={item.event} seriesLabel={item.seriesLabel} rsvp={rsvps[item.event.id]} />)}
          </div>
        </section>
      ))}
    </>
  );
}
