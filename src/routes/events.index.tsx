import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as fmt,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { ComingSoonCard, EventListRow, FeaturedEvent, PastEventRow } from "@/components/oka/event-card";
import { EventPageShell } from "@/components/oka/event-page-shell";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { publicEventsOptions, fetchPublicEvents as fetchEvents } from "@/lib/public-events.functions";
import { filterPublicEvents } from "@/lib/public-events";
import { MyEvents } from "@/components/oka/my-events";
import { Button } from "@/components/ui/button";
import {
  EVENT_FORMATS,
  EVENT_TYPES,
  FORMAT_LABELS,
  TYPE_LABELS,
  fetchMyRsvps,
  type EventRow,
} from "@/lib/events";
import { groupEventSeries } from "@/lib/event-series";
import { bucketUpcomingEvents } from "@/lib/event-schedule";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  view: z.enum(["list", "calendar"]).optional().catch(undefined),
  type: z.enum(EVENT_TYPES).optional().catch(undefined),
  format: z.enum(EVENT_FORMATS).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined),
});
type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/events/")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(publicEventsOptions),
  head: () => ({
    meta: [
      { title: "Events — Oka" },
      { name: "description", content: "Gatherings, workshops, pod sessions and retreats across the Oka family." },
      { property: "og:title", content: "Events — Oka" },
      { property: "og:description", content: "Gatherings, workshops, pod sessions and retreats across the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <EventPageShell><EventsPage /></EventPageShell>,
});

const selectCls =
  "h-10 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:flex-none";

function EventsPage() {
  const search = Route.useSearch();
  const uid = useCurrentUserId();
  const navigate = useNavigate({ from: "/events/" });
  const view = search.view ?? "list";
  const set = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch }), replace: true });

  return (
    <div className="mx-auto max-w-[1180px] overflow-x-hidden px-6 py-6 lg:px-10 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap gap-3">
          <select
            aria-label="Event type"
            className={selectCls}
            value={search.type ?? ""}
            onChange={(e) => set({ type: (e.target.value || undefined) as Search["type"] })}
          >
            <option value="">All types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            aria-label="Format"
            className={selectCls}
            value={search.format ?? ""}
            onChange={(e) => set({ format: (e.target.value || undefined) as Search["format"] })}
          >
            <option value="">Any format</option>
            {EVENT_FORMATS.map((f) => (
              <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From date"
            className={selectCls}
            value={search.from ?? ""}
            onChange={(e) => set({ from: e.target.value || undefined })}
          />
          <input
            type="date"
            aria-label="To date"
            className={selectCls}
            value={search.to ?? ""}
            onChange={(e) => set({ to: e.target.value || undefined })}
          />
          {(search.type || search.format || search.from || search.to) && (
            <button
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => set({ type: undefined, format: undefined, from: undefined, to: undefined })}
            >
              Clear filters
            </button>
          )}
        </div>
        {uid.data && <Button asChild className="min-h-10 w-full rounded-full sm:ml-auto sm:w-auto">
          <Link to="/events/new"><Plus strokeWidth={1.5} /> Propose an event</Link>
        </Button>}
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant={view === "list" ? "default" : "outline"} className="rounded-full" onClick={() => set({ view: "list" })}>List</Button>
        <Button variant={view === "calendar" ? "default" : "outline"} className="rounded-full" onClick={() => set({ view: "calendar" })}>Calendar</Button>
      </div>
      {view === "calendar" ? (
        <CalendarView search={search} onMonth={(m) => set({ month: m })} />
      ) : (
        <ListView search={search} />
      )}
    </div>
  );
}

function useRsvpMap(events: EventRow[] | undefined) {
  const uid = useCurrentUserId();
  const ids = (events ?? []).map((e) => e.id);
  return useQuery({
    queryKey: ["my-rsvps", uid.data, ids],
    queryFn: () => fetchMyRsvps(ids),
    enabled: Boolean(uid.data) && ids.length > 0,
  });
}

function QuietCalendar() {
  return (
    <div className="mt-12 flex flex-col items-center rounded-2xl bg-secondary/50 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-card">
        <CalendarDays className="size-6 text-primary" strokeWidth={1.5} />
      </span>
      <h2 className="mt-6 text-3xl text-foreground">The calendar is quiet</h2>
      <p className="mt-3 max-w-md text-muted-foreground">New gatherings are coming. Or propose one yourself — the family grows when someone opens the door.</p>
    </div>
  );
}

function SectionHeading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="section-label">{label}</h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <span className="hidden h-px flex-1 bg-border sm:block" />
    </div>
  );
}

function ListView({ search }: { search: Search }) {
  const filters = { type: search.type, format: search.format, from: search.from, to: search.to };
  const uid = useCurrentUserId();
  const catalog = Route.useLoaderData();
  const [showPast, setShowPast] = useState(false);
  const upcoming = useQuery({ queryKey: ["events", "upcoming", filters], initialData: () => filterPublicEvents(catalog, filters, { limit: 400 }), queryFn: () => fetchEvents(filters, { limit: 400 }) });
  const past = useQuery({
    queryKey: ["events", "past", filters],
    queryFn: () => fetchEvents(filters, { past: true, limit: 400 }),
    enabled: showPast,
  });
  const list = groupEventSeries(upcoming.data ?? [], "upcoming");
  const pastList = groupEventSeries(past.data ?? [], "past");
  const featured = list[0] ?? null;
  const comingSoon = list.slice(1, 4);
  const featuredIds = new Set([featured?.event.id, ...comingSoon.map((item) => item.event.id)].filter(Boolean) as string[]);
  const remaining = list.filter((item) => !featuredIds.has(item.event.id));
  const buckets = bucketUpcomingEvents(remaining.map((item) => item.event));
  const remainingById = new Map(remaining.map((item) => [item.event.id, item]));
  const thisWeekItems = buckets.thisWeek.map((event) => remainingById.get(event.id)).filter(Boolean) as typeof remaining;
  const laterItems = buckets.later.map((event) => remainingById.get(event.id)).filter(Boolean) as typeof remaining;

  const rsvps = useRsvpMap([
    ...list.map((item) => item.event),
    ...pastList.map((item) => item.event),
  ]);

  const pastGroups: [string, typeof pastList][] = [];
  for (const item of pastList) {
    const label = fmt(new Date(item.event.starts_at), "MMMM yyyy");
    const g = pastGroups.at(-1);
    if (g && g[0] === label) g[1].push(item);
    else pastGroups.push([label, [item]]);
  }

  if (upcoming.isLoading) return <p className="mt-12 text-muted-foreground">Gathering the schedule…</p>;
  if (upcoming.error) return <p className="mt-12 text-destructive">We couldn't load events. Please try again.</p>;

  return (
    <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-14">
      {(upcoming.data ?? []).length === 0 ? (
        <QuietCalendar />
      ) : (
        <>
          {featured && (
            <FeaturedEvent event={featured.event} rsvp={rsvps.data?.[featured.event.id]} />
          )}

          {comingSoon.length > 0 && (
            <section>
              <SectionHeading label="Coming soon" hint="The next three gatherings." />
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {comingSoon.map((item) => (
                  <ComingSoonCard
                    key={item.event.id}
                    event={item.event}
                    seriesLabel={item.label}
                    rsvp={rsvps.data?.[item.event.id]}
                  />
                ))}
              </div>
            </section>
          )}

          {thisWeekItems.length > 0 && (
            <section>
              <SectionHeading label="This week" hint={buckets.thisWeekHint} />
              <div className="mt-5 grid gap-3">
                {thisWeekItems.map((item) => (
                  <EventListRow
                    key={item.event.id}
                    event={item.event}
                    seriesLabel={item.label}
                    rsvp={rsvps.data?.[item.event.id]}
                  />
                ))}
              </div>
            </section>
          )}

          {laterItems.length > 0 && (
            <section>
              <SectionHeading label={buckets.laterTitle} hint={buckets.laterHint} />
              <div className="mt-5 grid gap-3">
                {laterItems.map((item) => (
                  <EventListRow
                    key={item.event.id}
                    event={item.event}
                    seriesLabel={item.label}
                    rsvp={rsvps.data?.[item.event.id]}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {uid.data && <MyEvents />}

      <section>
        <button
          type="button"
          aria-expanded={showPast}
          onClick={() => setShowPast((s) => !s)}
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
        >
          <h2 className="section-label">Past events</h2>
          <p className="text-sm text-muted-foreground">Gatherings that already happened</p>
          {showPast && past.isSuccess && (
            <span className="rounded-full bg-sand/70 px-2.5 py-0.5 text-xs text-brown-muted">{pastList.length}</span>
          )}
          <span className="hidden h-px flex-1 bg-border sm:block" />
          <span className="inline-flex items-center gap-1.5 text-sm text-primary">
            {showPast ? "Hide" : "Show"}
            <ChevronDown className={cn("size-4 transition-transform", showPast && "rotate-180")} strokeWidth={1.5} />
          </span>
        </button>
        {showPast && (
          <div className="mt-6 space-y-8">
            {past.isLoading && <p className="text-muted-foreground">Looking back…</p>}
            {past.isError && <p className="text-destructive">We couldn't load past events. Please try again.</p>}
            {past.isSuccess && past.data.length === 0 && (
              <p className="text-muted-foreground">No past events yet.</p>
            )}
            {past.isSuccess && pastGroups.map(([label, items]) => (
              <div key={label}>
                <SectionHeading label={label} />
                <div className="mt-4 grid gap-3">
                  {items.map((item) => (
                    <PastEventRow
                      key={item.event.id}
                      event={item.event}
                      seriesLabel={item.label}
                      rsvp={rsvps.data?.[item.event.id]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarView({ search, onMonth }: { search: Search; onMonth: (m: string) => void }) {
  const month = search.month ? parse(search.month, "yyyy-MM", new Date()) : startOfMonth(new Date());
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const filters = { type: search.type, format: search.format };
  const q = useQuery({
    queryKey: ["events", "range", filters, gridStart.toISOString()],
    queryFn: () =>
      fetchEvents(filters, {
        rangeStart: gridStart.toISOString(),
        rangeEnd: new Date(gridEnd.getTime() + 1).toISOString(),
        limit: 500,
      }),
  });
  const rsvps = useRsvpMap(q.data);
  const byDay = new Map<string, EventRow[]>();
  for (const e of q.data ?? []) {
    const k = fmt(new Date(e.starts_at), "yyyy-MM-dd");
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Previous month" onClick={() => onMonth(fmt(addMonths(month, -1), "yyyy-MM"))}>
          <ChevronLeft className="size-5 text-primary" strokeWidth={1.5} />
        </Button>
        <h2 className="text-3xl text-foreground">{fmt(month, "MMMM yyyy")}</h2>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Next month" onClick={() => onMonth(fmt(addMonths(month, 1), "yyyy-MM"))}>
          <ChevronRight className="size-5 text-primary" strokeWidth={1.5} />
        </Button>
      </div>
      <div className="mt-6 rounded-3xl bg-card p-3 shadow-soft sm:p-6">
        <div className="grid grid-cols-7">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="pb-3 text-center text-[0.65rem] uppercase tracking-widest text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((d) => {
            const key = fmt(d, "yyyy-MM-dd");
            const list = byDay.get(key) ?? [];
            const inMonth = isSameMonth(d, month);
            return (
              <Link
                key={key}
                to="/events/day/$date"
                params={{ date: key }}
                aria-label={`Events on ${fmt(d, "EEEE, MMMM d")}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-start rounded-2xl p-1 text-left transition-colors sm:aspect-auto sm:min-h-24 sm:items-stretch sm:p-2",
                  !inMonth && "opacity-35",
                  list.length ? "bg-accent/50 hover:bg-accent" : "hover:bg-accent/40",
                )}
              >
                <span className={cn("font-serif inline-flex size-7 items-center justify-center rounded-full text-lg", isToday(d) ? "bg-primary text-primary-foreground" : "text-foreground")}>
                  {fmt(d, "d")}
                </span>
                <span className="mt-1 flex gap-1 sm:hidden">
                  {list.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("size-1.5 rounded-full", e.status === "cancelled" ? "bg-muted-foreground" : "bg-primary")} />
                  ))}
                </span>
                <span className="mt-1 hidden flex-col gap-1 sm:flex">
                  {list.slice(0, 2).map((e) => (
                    <span key={e.id} className="flex items-center gap-1.5 truncate text-[0.7rem] text-foreground">
                      <span className={cn("size-1.5 shrink-0 rounded-full", e.status === "cancelled" ? "bg-muted-foreground" : rsvps.data?.[e.id] === "going" ? "bg-sage" : "bg-primary")} />
                      <span className={cn("truncate", e.status === "cancelled" && "line-through")}>{e.title}</span>
                    </span>
                  ))}
                  {list.length > 2 && <span className="text-[0.65rem] text-muted-foreground">+{list.length - 2} more</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {q.data?.length === 0 && <p className="font-serif mt-8 text-center text-2xl text-muted-foreground">The calendar is quiet this month — new gatherings are coming.</p>}
    </div>
  );
}
