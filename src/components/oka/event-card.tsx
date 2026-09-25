import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin, Users, Video } from "lucide-react";

import {
  FORMAT_LABELS,
  TYPE_LABELS,
  formatEventDate,
  formatEventTime,
  hostName,
  spotsLeft,
  type EventRow,
} from "@/lib/events";
import { cn } from "@/lib/utils";

export function RsvpBadge({ status }: { status?: string }) {
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

export function EventCard({ event, rsvp }: { event: EventRow; rsvp?: string }) {
  const left = spotsLeft(event);
  const cancelled = event.status === "cancelled";
  const FormatIcon = event.format === "virtual" ? Video : MapPin;

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className={cn(
        "surface-card block rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-lifted",
        cancelled && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-widest text-secondary-foreground">
          {TYPE_LABELS[event.event_type]}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <FormatIcon className="size-3.5 text-primary" strokeWidth={1.5} />
          {FORMAT_LABELS[event.format]}
        </span>
        {cancelled && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive">Cancelled</span>
        )}
        <span className="ml-auto">
          <RsvpBadge status={rsvp} />
        </span>
      </div>
      <h3 className="mt-4 text-2xl leading-tight text-foreground">{event.title}</h3>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" strokeWidth={1.5} />
          {formatEventDate(event.starts_at, event.timezone)}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="size-4 text-primary" strokeWidth={1.5} />
          {formatEventTime(event.starts_at, event.timezone)}
        </span>
        <span className="flex items-center gap-2">
          <Users className="size-4 text-primary" strokeWidth={1.5} />
          Hosted by {hostName(event.host)}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-4" />
          {left == null ? "Open to all" : left === 0 ? "Full · waitlist open" : `${left} spot${left === 1 ? "" : "s"} left`}
        </span>
      </div>
    </Link>
  );
}
