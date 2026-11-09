import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format as fmt, isValid, parse } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EventCard } from "@/components/oka/event-card";
import { Button } from "@/components/ui/button";
import { fetchEvents, fetchMyRsvps } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/events/day/$date")({
  head: ({ params }) => ({
    meta: [
      { title: `Events on ${params.date} — Oka` },
      { name: "description", content: "Every Oka gathering scheduled for this day." },
      { property: "og:title", content: `Events on ${params.date} — Oka` },
      { property: "og:description", content: "Every Oka gathering scheduled for this day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayPage,
});

function DayPage() {
  const { date } = Route.useParams();
  const day = parse(date, "yyyy-MM-dd", new Date());
  const valid = isValid(day);
  const q = useQuery({
    queryKey: ["events", "day", date],
    enabled: valid,
    queryFn: () =>
      fetchEvents({}, { rangeStart: day.toISOString(), rangeEnd: addDays(day, 1).toISOString(), limit: 200 }),
  });
  const ids = (q.data ?? []).map((e) => e.id);
  const rsvps = useQuery({
    queryKey: ["rsvps", "day", ids],
    enabled: ids.length > 0,
    queryFn: () => fetchMyRsvps(ids),
  });
  const prev = fmt(addDays(day, -1), "yyyy-MM-dd");
  const next = fmt(addDays(day, 1), "yyyy-MM-dd");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/events" search={{ view: "calendar", month: valid ? fmt(day, "yyyy-MM") : undefined }} className="text-sm uppercase tracking-widest text-primary">
        ← Back to calendar
      </Link>
      {!valid ? (
        <p className="mt-8 text-muted-foreground">That date doesn't look right.</p>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between gap-4">
            <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Previous day">
              <Link to="/events/day/$date" params={{ date: prev }}><ChevronLeft className="size-5 text-primary" strokeWidth={1.5} /></Link>
            </Button>
            <div className="text-center">
              <p className="section-label">Events on</p>
              <h1 className="mt-2 text-4xl text-foreground">{fmt(day, "EEEE, MMMM d")}</h1>
            </div>
            <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Next day">
              <Link to="/events/day/$date" params={{ date: next }}><ChevronRight className="size-5 text-primary" strokeWidth={1.5} /></Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-5">
            {q.isLoading && <p className="text-muted-foreground">Gathering the day…</p>}
            {q.data?.length === 0 && <p className="font-serif text-center text-2xl text-muted-foreground">Nothing planned this day.</p>}
            {q.data?.map((e) => <EventCard key={e.id} event={e} rsvp={rsvps.data?.[e.id]} />)}
          </div>
        </>
      )}
    </div>
  );
}
