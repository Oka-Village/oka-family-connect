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
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { EventCard, FeaturedEvent } from "@/components/oka/event-card";
import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_FORMATS,
  EVENT_TYPES,
  FORMAT_LABELS,
  TYPE_LABELS,
  fetchEvents,
  fetchMyRsvps,
  formatEventDate,
  type EventRow,
} from "@/lib/events";
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

export const Route = createFileRoute("/_authenticated/events/")({
  validateSearch: searchSchema,
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
  component: EventsPage,
});

const selectCls =
  "h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function EventsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const view = search.view ?? "list";
  const set = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch }), replace: true });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="section-label">Events</p>
          <h1 className="mt-3 text-4xl text-foreground lg:text-5xl">Gather with the family</h1>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/events/new">
            <Plus className="size-4" strokeWidth={1.5} /> Propose an event
          </Link>
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-border bg-card p-1">
          {(["list", "calendar"] as const).map((v) => {
            const Icon = v === "list" ? List : CalendarDays;
            return (
              <button
                key={v}
                onClick={() => set({ view: v === "list" ? undefined : v })}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm capitalize",
                  view === v ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4 text-primary" strokeWidth={1.5} /> {v}
              </button>
            );
          })}
        </div>
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
        {view === "list" && (
          <>
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
          </>
        )}
        {(search.type || search.format || search.from || search.to) && (
          <button
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => set({ type: undefined, format: undefined, from: undefined, to: undefined })}
          >
            Clear filters
          </button>
        )}
      </div>

      <MyProposals />

      {view === "list" ? <ListView search={search} /> : <CalendarView search={search} onMonth={(m) => set({ month: m })} />}
    </div>
  );
}

function useRsvpMap(events: EventRow[] | undefined) {
  const ids = (events ?? []).map((e) => e.id);
  return useQuery({
    queryKey: ["my-rsvps", ids],
    queryFn: () => fetchMyRsvps(ids),
    enabled: ids.length > 0,
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

function ListView({ search }: { search: Search }) {
  const filters = { type: search.type, format: search.format, from: search.from, to: search.to };
  const [showPast, setShowPast] = useState(false);
  const upcoming = useQuery({ queryKey: ["events", "upcoming", filters], queryFn: () => fetchEvents(filters) });
  const past = useQuery({
    queryKey: ["events", "past", filters],
    queryFn: () => fetchEvents(filters, { past: true, limit: 50 }),
    enabled: showPast,
  });
  const rsvps = useRsvpMap([...(upcoming.data ?? []), ...(past.data ?? [])]);
  const list = upcoming.data ?? [];
  const featured = list.find((e) => e.status === "published");
  const groups: [string, EventRow[]][] = [];
  for (const e of list) {
    if (e === featured) continue;
    const label = fmt(new Date(e.starts_at), "MMMM yyyy");
    const g = groups.at(-1);
    if (g && g[0] === label) g[1].push(e);
    else groups.push([label, [e]]);
  }

  if (upcoming.isLoading) return <p className="mt-12 text-muted-foreground">Gathering the schedule…</p>;
  if (upcoming.error) return <p className="mt-12 text-destructive">We couldn't load events. Please try again.</p>;

  return (
    <div className="mt-10">
      {upcoming.data!.length === 0 ? (
        <QuietCalendar />
      ) : (
        <>
          {featured && <FeaturedEvent event={featured} rsvp={rsvps.data?.[featured.id]} />}
          {groups.map(([label, items]) => (
            <section key={label} className="mt-14">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl text-foreground">{label}</h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {items.map((e) => <EventCard key={e.id} event={e} rsvp={rsvps.data?.[e.id]} />)}
              </div>
            </section>
          ))}
        </>
      )}
      <button
        onClick={() => setShowPast((s) => !s)}
        className="mt-12 flex items-center gap-2 text-sm uppercase tracking-widest text-muted-foreground"
      >
        <ChevronDown className={cn("size-4 text-primary transition-transform", showPast && "rotate-180")} strokeWidth={1.5} />
        Past events
      </button>
      {showPast && (
        <div className="mt-5 grid gap-5 opacity-80">
          {past.isLoading && <p className="text-muted-foreground">Looking back…</p>}
          {past.data?.length === 0 && <p className="text-muted-foreground">No past events yet.</p>}
          {past.data?.map((e) => <EventCard key={e.id} event={e} rsvp={rsvps.data?.[e.id]} />)}
        </div>
      )}
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
  const [selected, setSelected] = useState<string | null>(null);

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
            const isSel = selected === key;
            return (
              <button
                key={key}
                onClick={() => setSelected(isSel ? null : key)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-start rounded-2xl p-1 text-left transition-colors sm:aspect-auto sm:min-h-24 sm:items-stretch sm:p-2",
                  !inMonth && "opacity-35",
                  isSel ? "bg-secondary" : list.length ? "bg-accent/50 hover:bg-accent" : "hover:bg-accent/40",
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
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="mt-8">
          <p className="section-label">{fmt(parse(selected, "yyyy-MM-dd", new Date()), "EEEE, MMMM d")}</p>
          <div className="mt-4 grid gap-4">
            {(byDay.get(selected) ?? []).length === 0 && <p className="text-muted-foreground">Nothing planned this day.</p>}
            {(byDay.get(selected) ?? []).map((e) => <EventCard key={e.id} event={e} rsvp={rsvps.data?.[e.id]} />)}
          </div>
        </div>
      )}
      {q.data?.length === 0 && <p className="font-serif mt-8 text-center text-2xl text-muted-foreground">The calendar is quiet this month — new gatherings are coming.</p>}
    </div>
  );
}

/** A member's own proposals, which aren't publicly listed until an admin approves them. */
function MyProposals() {
  const { data: uid } = useCurrentUserId();
  const q = useQuery({
    queryKey: ["my-proposals", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,status,starts_at,timezone")
        .eq("created_by", uid!)
        .in("status", ["pending_approval", "rejected"])
        .order("starts_at")
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
  if (!q.data?.length) return null;
  return (
    <div className="mt-8 rounded-2xl bg-accent/60 p-5">
      <p className="section-label">Your proposals</p>
      <ul className="mt-3 grid gap-2">
        {q.data.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Link to="/events/$eventId" params={{ eventId: e.id }} className="font-medium text-foreground hover:underline">
              {e.title}
            </Link>
            <span className="text-muted-foreground">
              {formatEventDate(e.starts_at, e.timezone)} · {e.status === "rejected" ? "Not approved" : "Awaiting review"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
