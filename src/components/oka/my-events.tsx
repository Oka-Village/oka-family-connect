import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, MapPin, Pencil, Video } from "lucide-react";

import { TYPE_TINT } from "@/components/oka/event-card";
import { EventTime } from "@/components/oka/event-time";
import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { createdEventStatusLabel } from "@/lib/created-event-status";
import { groupEventSeries, type GroupedEvent, type SeriesEvent } from "@/lib/event-series";
import {
  FORMAT_LABELS,
  TYPE_LABELS,
  type EventFormat,
  type EventType,
} from "@/lib/events";
import { cn } from "@/lib/utils";

const VISIBLE_STATUSES = ["pending_approval", "published", "rejected", "cancelled"] as const;

/** Soft brand pill per review state, so status reads at a glance. */
const STATUS_PILL: Record<string, string> = {
  pending_approval: "bg-golden-tint text-golden-ink",
  published: "bg-sage-light text-sage-ink",
  rejected: "bg-terracotta-tint text-terracotta-ink",
  cancelled: "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-[0.68rem] font-medium tracking-wide whitespace-nowrap",
        STATUS_PILL[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {createdEventStatusLabel(status)}
    </span>
  );
}

/** Month / day / weekday tile, in the event's own timezone. */
function DateTile({ iso, tz, tint }: { iso: string; tz: string | null; tint: string }) {
  const d = new Date(iso);
  const opt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, ...o }).format(d);
  return (
    <div className={cn("flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl text-center", tint)}>
      <span className="text-[0.6rem] uppercase tracking-widest text-primary">{opt({ month: "short" })}</span>
      <span className="font-serif text-2xl leading-none text-foreground">{opt({ day: "numeric" })}</span>
      <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{opt({ weekday: "short" })}</span>
    </div>
  );
}

function EventRowItem({ item }: { item: GroupedEvent<SeriesEvent> }) {
  const { event } = item;
  const FormatIcon = event.format === "virtual" ? Video : MapPin;
  const cancelled = event.status === "cancelled";
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-3.5 transition-colors hover:bg-sand/40"
    >
      <DateTile iso={event.starts_at} tz={event.timezone} tint={TYPE_TINT[event.event_type as EventType] ?? "bg-sand/70"} />
      <div className="min-w-0 flex-1">
        <h3 className={cn("truncate font-serif text-xl leading-tight text-foreground", cancelled && "line-through opacity-70")}>
          {event.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="uppercase tracking-widest text-terracotta-ink">{TYPE_LABELS[event.event_type as EventType] ?? event.event_type}</span>
          <span className="flex items-center gap-1.5">
            <FormatIcon className="size-3.5 text-primary" strokeWidth={1.5} />
            {FORMAT_LABELS[event.format as EventFormat] ?? event.format}
          </span>
          <span className="flex min-w-0 items-start gap-1.5">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={1.5} />
            <EventTime start={event.starts_at} timezone={event.timezone} />
          </span>
        </div>
        {item.label && <p className="mt-1.5 truncate text-xs text-muted-foreground">{item.label}</p>}
      </div>
      <StatusPill status={event.status} />
      <ArrowRight
        className={cn(
          "size-4 shrink-0 text-primary transition-all",
          cancelled ? "opacity-40" : "opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100",
        )}
        strokeWidth={1.5}
      />
    </Link>
    <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full">
      <Link to="/events/edit/$eventId" params={{ eventId: event.id }} aria-label={`Edit ${event.title}`} title={`Edit ${event.title}`}>
        <Pencil className="size-4 text-primary" strokeWidth={1.5} />
      </Link>
    </Button>
    </div>
  );
}

/** Events this member created, with the review status an admin sets. */
export function MyEvents() {
  const { data: uid } = useCurrentUserId();
  const q = useQuery({
    queryKey: ["my-events", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return [];
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,event_type,format,starts_at,timezone,capacity,created_by,created_at,photo_url,status")
        .eq("created_by", uid)
        .in("status", [...VISIBLE_STATUSES])
        .order("starts_at")
        .limit(200);
      if (error) throw error;
      return groupEventSeries((data ?? []) as SeriesEvent[], "upcoming");
    },
  });

  if (!q.data?.length) return null;

  return (
    <section className="mt-10 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <div className="flex items-center gap-4">
        <h2 className="section-label">Your proposals &amp; events</h2>
        <span className="rounded-full bg-sand/70 px-2.5 py-0.5 text-xs text-brown-muted">{q.data.length}</span>
        <span className="h-px flex-1 bg-border/70" />
      </div>
      <ul className="mt-3 divide-y divide-border/60">
        {q.data.map((item) => (
          <li key={item.event.id}>
            <EventRowItem item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
