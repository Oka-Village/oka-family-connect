import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Users, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { EventInviteChip } from "@/components/oka/event-invite-chip";
import { EventTime } from "@/components/oka/event-time";
import { Button } from "@/components/ui/button";
import { formatEventTimeDual } from "@/lib/event-time";
import { signPaths } from "@/lib/skills";
import {
  FORMAT_LABELS,
  TYPE_LABELS,
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

export function spotsText(e: EventRow) {
  const left = spotsLeft(e);
  return left == null ? "Open to all" : left === 0 ? "Full · waitlist open" : `${left} spot${left === 1 ? "" : "s"} left`;
}

function subscribeLabel(event: EventRow, rsvp?: string) {
  if (rsvp === "going") return "You're going";
  if (rsvp === "waitlist") return "On waitlist";
  return spotsLeft(event) === 0 ? "Join waitlist" : "Subscribe";
}

function eventDateParts(iso: string, tz: string | null) {
  const d = new Date(iso);
  const opt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, ...o }).format(d);
  return {
    weekday: opt({ weekday: "short" }).toUpperCase(),
    day: opt({ day: "numeric" }),
    month: opt({ month: "short" }).toUpperCase(),
    shortLine: `${opt({ day: "numeric" })} ${opt({ weekday: "short" }).toUpperCase()} · ${opt({ month: "short" }).toUpperCase()}`,
    heroLine: `${opt({ weekday: "short" }).toUpperCase()} ${opt({ day: "numeric" })} ${opt({ month: "short" }).toUpperCase()}`,
  };
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

function PhotoBlock({
  path,
  eventType,
  className,
  rounded = "rounded-2xl",
}: {
  path: string | null | undefined;
  eventType: EventType;
  className?: string;
  rounded?: string;
}) {
  const photo = useEventPhoto(path);
  if (photo) {
    return <img src={photo} alt="" loading="lazy" className={cn("object-cover", rounded, className)} />;
  }
  return <div className={cn(TYPE_TINT[eventType], rounded, className)} aria-hidden />;
}

/** An event rendered like an invitation card (home, day, past). */
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
      <div className="font-serif text-4xl leading-none text-foreground">{new Date(event.starts_at).toLocaleDateString("en-US", { day: "numeric", timeZone: event.timezone || "UTC" })}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-widest text-primary">{TYPE_LABELS[event.event_type]}</span>
          {cancelled && <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive">Cancelled</span>}
          <span className="ml-auto"><RsvpBadge status={rsvp} /></span>
        </div>
        <h3 className={cn("mt-2 text-xl leading-[1.08] text-foreground", cancelled && "line-through")}>{event.title}</h3>
        {seriesLabel && <p className="mt-2 text-xs text-muted-foreground">{seriesLabel}</p>}
        <div className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground"><Clock className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} /><EventTime start={event.starts_at} timezone={event.timezone} /></div>
        <p className="mt-4 text-xs text-muted-foreground">{TYPE_LABELS[event.event_type]} · {spotsText(event)}</p>
      </div>
    </Link>
  );
}

function HeroTime({ start, timezone }: { start: string; timezone: string | null }) {
  const [viewerTimezone, setViewerTimezone] = useState<string | null>(null);
  useEffect(() => {
    setViewerTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const dual = formatEventTimeDual(start, null, timezone, viewerTimezone);
  const large = dual.local?.replace(/\s·\syour time$/i, "") ?? dual.primary;
  return (
    <div>
      <p className="font-serif text-3xl leading-none text-cream sm:text-4xl">{large}</p>
      {dual.local && <p className="mt-2 text-sm text-cream/65">{dual.primary}</p>}
    </div>
  );
}

/** Next Up hero — dark brown split card matching the Events mock. */
export function FeaturedEvent({ event, rsvp }: { event: EventRow; rsvp?: string | undefined }) {
  const dates = eventDateParts(event.starts_at, event.timezone);
  const FormatIcon = event.format === "virtual" ? Video : MapPin;
  return (
    <article className="overflow-hidden rounded-[1.75rem] bg-brown text-cream shadow-soft">
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="order-2 flex flex-col justify-center gap-5 p-6 sm:p-8 lg:order-1 lg:p-10">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-cream/70">
            Next up · {dates.heroLine} · {TYPE_LABELS[event.event_type]}
          </p>
          <h2 className="font-serif text-3xl leading-[1.05] text-golden sm:text-4xl lg:text-5xl">{event.title}</h2>
          <HeroTime start={event.starts_at} timezone={event.timezone} />
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1.5 text-xs text-cream">
              <FormatIcon className="size-3.5" strokeWidth={1.5} />
              {FORMAT_LABELS[event.format]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1.5 text-xs text-cream">
              <Users className="size-3.5" strokeWidth={1.5} />
              with {hostName(event.host)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1.5 text-xs text-cream">
              {spotsText(event)}
            </span>
            <RsvpBadge status={rsvp} />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild className="min-h-10 rounded-full bg-golden px-6 text-brown hover:bg-golden/90">
              <Link to="/events/$eventId" params={{ eventId: event.id }}>{subscribeLabel(event, rsvp)}</Link>
            </Button>
            <EventInviteChip event={event} label="Invite a friend" dark />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <PhotoBlock
            path={event.photo_url}
            eventType={event.event_type}
            rounded="rounded-none"
            className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[22rem]"
          />
        </div>
      </div>
    </article>
  );
}

/** Coming soon vertical photo card. */
export function ComingSoonCard({ event, rsvp, seriesLabel }: { event: EventRow; rsvp?: string | undefined; seriesLabel?: string | null | undefined }) {
  const dates = eventDateParts(event.starts_at, event.timezone);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
      <PhotoBlock path={event.photo_url} eventType={event.event_type} rounded="rounded-none" className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-brown-muted">
            {dates.day} {dates.weekday} · {dates.month}
          </p>
          <span className="rounded-full bg-sage-light px-2.5 py-0.5 text-[0.65rem] uppercase tracking-widest text-sage-ink">
            {TYPE_LABELS[event.event_type]}
          </span>
        </div>
        <h3 className="font-serif text-2xl leading-tight text-foreground">
          <Link to="/events/$eventId" params={{ eventId: event.id }} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        {seriesLabel && <p className="text-xs text-muted-foreground">{seriesLabel}</p>}
        <p className="text-sm text-muted-foreground">
          with {hostName(event.host)}
        </p>
        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
          <EventTime start={event.starts_at} timezone={event.timezone} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <p className="mr-auto text-xs text-muted-foreground">{spotsText(event)}</p>
          <EventInviteChip event={event} />
          <Button asChild className="min-h-10 rounded-full bg-sage-deep px-5 text-cream hover:bg-sage-dark">
            <Link to="/events/$eventId" params={{ eventId: event.id }}>{subscribeLabel(event, rsvp)}</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Horizontal (desktop) / stacked (mobile) schedule row. */
export function EventListRow({ event, rsvp, seriesLabel }: { event: EventRow; rsvp?: string | undefined; seriesLabel?: string | null | undefined }) {
  const dates = eventDateParts(event.starts_at, event.timezone);
  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft md:px-5 md:py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
        <PhotoBlock
          path={event.photo_url}
          eventType={event.event_type}
          className="aspect-square w-full max-w-28 shrink-0 sm:max-w-24 md:size-16 md:max-w-none"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-5">
          <div className="shrink-0 md:w-24">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-brown-muted">
              {dates.weekday} {dates.day} {dates.month}
            </p>
            <span className="mt-1 inline-flex rounded-full bg-sage-light px-2.5 py-0.5 text-[0.65rem] uppercase tracking-widest text-sage-ink">
              {TYPE_LABELS[event.event_type]}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl leading-tight text-foreground md:text-2xl">
              <Link to="/events/$eventId" params={{ eventId: event.id }} className="hover:underline">
                {event.title}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {FORMAT_LABELS[event.format]} · with {hostName(event.host)}
            </p>
            {seriesLabel && <p className="mt-1 text-xs text-muted-foreground">{seriesLabel}</p>}
          </div>
          <div className="min-w-0 text-sm text-muted-foreground md:w-40 md:shrink-0">
            <EventTime start={event.starts_at} timezone={event.timezone} />
          </div>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">
            <p className="mr-auto text-xs text-muted-foreground md:mr-2">{spotsText(event)}</p>
            <RsvpBadge status={rsvp} />
            <EventInviteChip event={event} />
            <Button asChild className="min-h-10 rounded-full bg-sage-deep px-5 text-cream hover:bg-sage-dark">
              <Link to="/events/$eventId" params={{ eventId: event.id }}>{subscribeLabel(event, rsvp)}</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Compact past gathering row — view only, no subscribe/invite/spots. */
export function PastEventRow({ event, rsvp, seriesLabel }: { event: EventRow; rsvp?: string | undefined; seriesLabel?: string | null | undefined }) {
  const dates = eventDateParts(event.starts_at, event.timezone);
  const cancelled = event.status === "cancelled";
  return (
    <article className={cn("rounded-2xl border border-border/60 bg-card p-4 shadow-soft md:px-5 md:py-4", cancelled && "opacity-75")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
        <PhotoBlock
          path={event.photo_url}
          eventType={event.event_type}
          className="aspect-square w-full max-w-28 shrink-0 sm:max-w-24 md:size-16 md:max-w-none"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-5">
          <div className="shrink-0 md:w-24">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-brown-muted">
              {dates.weekday} {dates.day} {dates.month}
            </p>
            <span className="mt-1 inline-flex rounded-full bg-sand/80 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-widest text-brown-muted">
              {TYPE_LABELS[event.event_type]}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={cn("font-serif text-xl leading-tight text-foreground md:text-2xl", cancelled && "line-through")}>
              <Link to="/events/$eventId" params={{ eventId: event.id }} className="hover:underline">
                {event.title}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {FORMAT_LABELS[event.format]} · with {hostName(event.host)}
            </p>
            {seriesLabel && <p className="mt-1 text-xs text-muted-foreground">{seriesLabel}</p>}
            {cancelled && <p className="mt-1 text-xs text-destructive">Cancelled</p>}
          </div>
          <div className="min-w-0 text-sm text-muted-foreground md:w-40 md:shrink-0">
            <EventTime start={event.starts_at} timezone={event.timezone} />
          </div>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">
            <RsvpBadge status={rsvp} />
            <Button asChild variant="outline" className="min-h-10 rounded-full px-5">
              <Link to="/events/$eventId" params={{ eventId: event.id }}>View</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
