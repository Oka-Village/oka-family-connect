import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { signPaths } from "@/lib/skills";
import { ArrowRight, Clock, MapPin, Users, Video } from "lucide-react";

import {
  FORMAT_LABELS,
  TYPE_LABELS,
  formatEventTime,
  hostName,
  spotsLeft,
  type EventRow,
  type EventType,
} from "@/lib/events";
import { cn } from "@/lib/utils";

/** Soft brand tint per event type, so the schedule reads like a warm calendar. */
export const TYPE_TINT: Record<EventType, string> = {
  gathering: "bg-sage-light/60",
  workshop: "bg-sand/70",
  pod_session: "bg-terracotta-light/30",
  meditation: "bg-sage-light/40",
  retreat: "bg-golden/20",
};

export function RsvpBadge({ status }: { status?: string | undefined }) {
  if (status !== "going" && status !== "waitlist") return null;
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        status === "going" ? "bg-sage text-on-terracotta" : "bg-golden/30 text-foreground",
      )}
    >
      {status === "going" ? "You're going" : "On the waitlist"}
    </span>
  );
}

function spotsText(e: EventRow) {
  const left = spotsLeft(e);
  return left == null ? "Open to all" : left === 0 ? "Full · waitlist open" : `${left} spot${left === 1 ? "" : "s"} left`;
}

function DateBlock({ iso, tz, large }: { iso: string; tz: string | null; large?: boolean }) {
  const d = new Date(iso);
  const opt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, ...o }).format(d);
  return (
    <div className={cn("flex shrink-0 flex-col items-center justify-center rounded-2xl bg-card/80 text-center", large ? "size-28" : "size-20")}>
      <span className="text-[0.65rem] uppercase tracking-widest text-primary">{opt({ month: "short" })}</span>
      <span className={cn("font-serif leading-none text-foreground", large ? "text-6xl" : "text-4xl")}>{opt({ day: "numeric" })}</span>
      <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{opt({ weekday: "short" })}</span>
    </div>
  );
}

function Meta({ event }: { event: EventRow }) {
  const FormatIcon = event.format === "virtual" ? Video : MapPin;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5"><Clock className="size-4 text-primary" strokeWidth={1.5} />{formatEventTime(event.starts_at, event.timezone)}</span>
      <span className="flex items-center gap-1.5"><FormatIcon className="size-4 text-primary" strokeWidth={1.5} />{FORMAT_LABELS[event.format]}</span>
      <span className="flex items-center gap-1.5"><Users className="size-4 text-primary" strokeWidth={1.5} />{hostName(event.host)}</span>
    </div>
  );
}

/** Signed URL for an event photo stored privately. */
export function useEventPhoto(path: string | null | undefined) {
  return useQuery({
    queryKey: ["event-photo", path],
    queryFn: async () => (await signPaths([path]))(path) ?? null,
    enabled: !!path,
    staleTime: 30 * 60_000,
  }).data ?? null;
}

/** An event rendered like an invitation card. */
export function EventCard({ event, rsvp, seriesLabel }: { event: EventRow; rsvp?: string | undefined; seriesLabel?: string | null | undefined }) {
  const cancelled = event.status === "cancelled";
  const photo = useEventPhoto(event.photo_url);
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className={cn(
        "discovery-card group flex min-h-44 flex-col rounded-2xl border border-border p-4",
        TYPE_TINT[event.event_type],
        cancelled && "opacity-60",
      )}
    >
      {photo && <img src={photo} alt="" loading="lazy" className="-mx-4 -mt-4 mb-4 aspect-[16/9] w-[calc(100%+2rem)] max-w-none rounded-t-2xl object-cover" />}
      <div className="font-serif text-4xl leading-none text-foreground">{new Date(event.starts_at).toLocaleDateString(undefined, { day: "numeric" })}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-widest text-primary">{TYPE_LABELS[event.event_type]}</span>
          {cancelled && <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive">Cancelled</span>}
          <span className="ml-auto"><RsvpBadge status={rsvp} /></span>
        </div>
        <h3 className={cn("mt-2 text-xl leading-[1.08] text-foreground", cancelled && "line-through")}>{event.title}</h3>
        {seriesLabel && <p className="mt-2 text-xs text-muted-foreground">{seriesLabel}</p>}
        <p className="mt-4 text-xs text-muted-foreground">{TYPE_LABELS[event.event_type]} · {spotsText(event)}</p>
      </div>
    </Link>
  );
}

/** The next gathering, featured large at the top of the schedule. */
export function FeaturedEvent({ event, rsvp }: { event: EventRow; rsvp?: string | undefined }) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className={cn("group relative block overflow-hidden rounded-3xl p-8 shadow-soft transition-shadow hover:shadow-lifted sm:p-12", TYPE_TINT[event.event_type])}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-terracotta-light/25" />
      <div className="pointer-events-none absolute -bottom-24 right-24 size-48 rounded-full bg-sage/15" />
      <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center">
        <DateBlock iso={event.starts_at} tz={event.timezone} large />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="section-label">Next gathering · {TYPE_LABELS[event.event_type]}</p>
            <RsvpBadge status={rsvp} />
          </div>
          <h2 className="mt-3 text-4xl leading-[1.05] text-foreground sm:text-6xl">{event.title}</h2>
          {event.description && <p className="mt-4 line-clamp-2 max-w-xl leading-relaxed text-muted-foreground">{event.description}</p>}
          <div className="mt-6"><Meta event={event} /></div>
          <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground">
            {rsvp === "going" ? "View details" : spotsLeft(event) === 0 ? "Join the waitlist" : "Save my spot"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}
