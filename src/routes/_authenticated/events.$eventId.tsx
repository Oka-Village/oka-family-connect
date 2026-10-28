import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Clock, Hourglass, Lock, MapPin, Pencil, Users, Video } from "lucide-react";
import { toast } from "sonner";

import { RsvpBadge, useEventPhoto } from "@/components/oka/event-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentUserId, useIsStaff } from "@/hooks/use-is-admin";
import { resolvePhotoUrl } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { setEventStatus } from "@/lib/event-admin";
import { getVideoConfigured } from "@/lib/video.functions";
import { VideoRoom } from "@/components/oka/video-room";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CopyJoinLink } from "@/components/oka/copy-join-link";
import { canShareEventLink, joinPath } from "@/lib/join-link";
import {
  EVENT_SELECT,
  FORMAT_LABELS,
  TYPE_LABELS,
  formatDuration,
  formatEventDate,
  formatEventTime,
  hostName,
  spotsLeft,
  type EventRow,
} from "@/lib/events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event — Oka" },
      { name: "description", content: "Details, host and RSVP for an Oka family event." },
      { property: "og:title", content: "Event — Oka" },
      { property: "og:description", content: "Details, host and RSVP for an Oka family event." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => z.object({ via: z.enum(["link"]).optional() }).parse({ via: s["via"] === "link" ? "link" : undefined }),
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const { via } = Route.useSearch();
  const qc = useQueryClient();
  const { data: uid } = useCurrentUserId();
  const { data: isAdmin } = useIsStaff();
  // The sharer's own active affiliate code, if any — used only to tag shared join links.
  const myAffiliate = useQuery({
    queryKey: ["affiliate", "my-code", uid],
    queryFn: async () => {
      const { data } = await supabase.from("affiliates").select("invite_code,status").eq("user_id", uid!).maybeSingle();
      return data?.status === "active" ? data.invite_code : null;
    },
    enabled: !!uid,
  });
  const refCode = myAffiliate.data ?? null;
  const fetchVideoCfg = useServerFn(getVideoConfigured);
  const videoCfg = useQuery({ queryKey: ["video-configured"], queryFn: () => fetchVideoCfg(), staleTime: 5 * 60_000 });

  const q = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const [ev, loc, mine] = await Promise.all([
        supabase.from("events").select(EVENT_SELECT).eq("id", eventId).maybeSingle(),
        // RLS returns nothing unless you're confirmed, the host, or an admin.
        supabase.from("event_locations").select("venue_address,video_link").eq("event_id", eventId).maybeSingle(),
        supabase.from("event_rsvps").select("status").eq("event_id", eventId).eq("user_id", uid!).maybeSingle(),
      ]);
      if (ev.error) throw ev.error;
      return { event: ev.data as unknown as EventRow | null, location: loc.data, rsvp: mine.data?.status };
    },
    enabled: !!uid,
  });

  const photo = useQuery({
    queryKey: ["photo", q.data?.event?.host?.photo_url],
    queryFn: () => resolvePhotoUrl(q.data?.event?.host?.photo_url ?? null),
    enabled: !!q.data?.event?.host?.photo_url,
  });

  const cover = useEventPhoto(q.data?.event?.photo_url);

  const rsvp = useMutation({
    mutationFn: async (action: "join" | "leave") => {
      const { data, error } = await supabase.rpc(action === "join" ? "rsvp_event" : "cancel_rsvp", { _event_id: eventId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (status) => {
      toast.success(status === "going" ? "You're going — see you there" : status === "waitlist" ? "It's full, so you're on the waitlist" : "Your RSVP is cancelled");
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["my-rsvps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const admin = useMutation({
    mutationFn: (status: "published" | "rejected" | "cancelled") => setEventStatus(eventId, status),
    onSuccess: () => { toast.success("Event updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !uid) return <p className="px-6 py-16 text-muted-foreground">Loading…</p>;
  const ev = q.data?.event;
  if (!ev) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl text-foreground">This event isn't available</h1>
        <p className="mt-3 text-muted-foreground">It may still be waiting for review, or it has been removed.</p>
        <Link to="/events" className="mt-6 inline-block text-primary">Back to events</Link>
      </div>
    );
  }

  const left = spotsLeft(ev);
  const status = q.data?.rsvp;
  const isManager = ev.host_id === uid || ev.created_by === uid;
  const past = new Date(ev.ends_at ?? ev.starts_at) < new Date();
  const canRsvp = ev.status === "published" && !past;
  const duration = formatDuration(ev.starts_at, ev.ends_at);
  const fill = ev.capacity ? Math.min(100, (ev.going_count / ev.capacity) * 100) : 0;
  const LocIcon = ev.format === "virtual" ? Video : MapPin;
  const loc = q.data?.location;
  const useRoom = ev.format === "virtual" && videoCfg.data?.configured === true && !past && ev.status !== "cancelled";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <Link to="/events" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> All events
      </Link>

      {ev.status !== "published" && (
        <div className={cn("mt-6 rounded-2xl px-5 py-3 text-sm", ev.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-golden/25 text-foreground")}>
          {ev.status === "cancelled" ? "This event has been cancelled." : ev.status === "pending_approval" ? "Awaiting admin review — not yet on the public schedule." : ev.status === "rejected" ? "This proposal was not approved." : `Status: ${ev.status}`}
        </div>
      )}

      {via === "link" && !isManager && (status === "going" || status === "waitlist") && (
        <div className="mt-6 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground">
          {status === "going" ? "You're in — your spot is saved. The call appears below when the room opens." : "This gathering is full, so you're on the waitlist. We'll move you in if a spot opens."}
        </div>
      )}

      {canShareEventLink(isManager, !!isAdmin, refCode) && ev.status === "published" && ev.format === "virtual" && !past && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div>
            <p className="section-label">Share your call</p>
            <p className="mt-2 break-all text-sm text-muted-foreground">{typeof window !== "undefined" ? `${window.location.origin}${joinPath(ev.join_slug, refCode)}` : joinPath(ev.join_slug, refCode)}</p>
            {refCode && (
              <p className="mt-2 text-sm text-foreground">Your invite code is in this link — when someone new joins Oka through it and becomes a paying member, you earn credit.</p>
            )}
          </div>
          <CopyJoinLink slug={ev.join_slug} refCode={refCode} />
        </div>
      )}

      {cover && <img src={cover} alt="" className="mt-8 aspect-[21/9] w-full rounded-3xl object-cover shadow-soft" />}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-widest text-secondary-foreground">{TYPE_LABELS[ev.event_type]}</span>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{FORMAT_LABELS[ev.format]}</span>
            <RsvpBadge status={status} />
          </div>
          <h1 className="mt-5 text-4xl leading-tight text-foreground lg:text-5xl">{ev.title}</h1>

          <div className="mt-8 grid gap-3 text-foreground sm:grid-cols-2">
            <Detail icon={CalendarDays}>{formatEventDate(ev.starts_at, ev.timezone)}</Detail>
            <Detail icon={Clock}>
              {formatEventTime(ev.starts_at, ev.timezone)}
              {ev.ends_at && ` – ${formatEventTime(ev.ends_at, ev.timezone)}`}
            </Detail>
            {duration && <Detail icon={Hourglass}>{duration}</Detail>}
            {ev.timezone && <Detail icon={Clock}>{ev.timezone}</Detail>}
          </div>

          <div className="mt-8 rounded-2xl bg-secondary/50 p-5">
            <p className="section-label">{ev.format === "virtual" ? (useRoom ? "Event room" : "Video link") : "Location"}</p>
            {useRoom ? (
              status === "going" || isManager || isAdmin ? (
                <VideoRoom eventId={ev.id} startsAt={ev.starts_at} bypassTiming={!!isAdmin} autoJoin={via === "link"} />
              ) : (
                <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <Lock className="size-4 text-primary" strokeWidth={1.5} />
                  The room is open to confirmed guests once you're going.
                </p>
              )
            ) : loc && (loc.video_link || loc.venue_address) ? (
              <p className="mt-3 flex items-start gap-2 break-all">
                <LocIcon className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
                {loc.video_link ? (
                  <a href={loc.video_link} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{loc.video_link}</a>
                ) : (
                  loc.venue_address
                )}
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                <Lock className="size-4 text-primary" strokeWidth={1.5} />
                {loc ? "Details coming soon." : "Shared with confirmed guests once you're going."}
              </p>
            )}
          </div>

          <p className="section-label mt-10">About</p>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground">{ev.description || "More details soon."}</p>
        </div>

        <aside className="grid content-start gap-5">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="section-label">Spots</p>
            {ev.capacity ? (
              <>
                <p className="mt-3 text-3xl text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
                  {left} <span className="text-base text-muted-foreground">of {ev.capacity} left</span>
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${fill}%` }} />
                </div>
                {ev.waitlist_count > 0 && <p className="mt-2 text-xs text-muted-foreground">{ev.waitlist_count} on the waitlist</p>}
              </>
            ) : (
              <p className="mt-3 text-muted-foreground">Open to everyone · {ev.going_count} going</p>
            )}

            {canRsvp && (
              status === "going" || status === "waitlist" ? (
                <Button variant="outline" className="mt-6 w-full rounded-full" disabled={rsvp.isPending} onClick={() => rsvp.mutate("leave")}>
                  {status === "going" ? "Cancel my spot" : "Leave the waitlist"}
                </Button>
              ) : (
                <Button className="mt-6 w-full rounded-full" disabled={rsvp.isPending} onClick={() => rsvp.mutate("join")}>
                  {left === 0 ? "Join the waitlist" : "I'm going"}
                </Button>
              )
            )}
            {past && ev.status === "published" && <p className="mt-6 text-sm text-muted-foreground">This event has passed.</p>}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="section-label">Host</p>
            <Link to={ev.host_id ? "/members/$memberId" : "/directory"} params={{ memberId: ev.host_id ?? "" }} className="mt-4 flex items-center gap-3">
              <Avatar className="size-12">
                {photo.data && <AvatarImage src={photo.data} alt="" />}
                <AvatarFallback className="bg-secondary text-foreground">
                  {hostName(ev.host).slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span>
                <span className="block font-medium text-foreground">{hostName(ev.host)}</span>
                <span className="text-sm text-muted-foreground">View profile</span>
              </span>
            </Link>
          </div>

          {(isAdmin || (isManager && ev.status === "pending_approval")) && (
            <div className="grid gap-2 rounded-2xl bg-accent/60 p-5">
              <p className="section-label">{isAdmin ? "Moderation" : "Your proposal"}</p>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/events/edit/$eventId" params={{ eventId }}><Pencil className="size-4" strokeWidth={1.5} /> Edit</Link>
              </Button>
              {isAdmin && ev.status !== "published" && ev.status !== "cancelled" && (
                <Button className="rounded-full" onClick={() => admin.mutate("published")}>Approve & publish</Button>
              )}
              {isAdmin && ev.status === "pending_approval" && (
                <Button variant="outline" className="rounded-full" onClick={() => admin.mutate("rejected")}>Reject</Button>
              )}
              {isAdmin && ev.status === "published" && (
                <Button variant="outline" className="rounded-full text-destructive" onClick={() => confirm("Cancel this event for everyone?") && admin.mutate("cancelled")}>
                  Cancel event
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <Icon className="size-5 text-primary" strokeWidth={1.5} />
      {children}
    </span>
  );
}
