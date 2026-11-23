import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, Clock, Hourglass, Lock, MapPin, Pencil, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { useEffect, type ReactNode } from "react";
import { trackEventRegistration, trackEventView } from "@/lib/meta-pixel";

import { EventPageShell } from "@/components/oka/event-page-shell";
import { EventSignIn } from "@/components/oka/event-sign-in";
import { publicEventsOptions } from "@/lib/public-events.functions";
import { RsvpBadge, useEventPhoto } from "@/components/oka/event-card";
import { EventTime, ViewerTimezone } from "@/components/oka/event-time";
import { AddToCalendarDropdown } from "@/components/oka/add-to-calendar-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentUserId, useIsStaff } from "@/hooks/use-is-admin";
import { resolvePhotoUrl } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { notifyEventStatus, notifyRsvpConfirmed } from "@/lib/event-notifications.functions";
import { getVideoConfigured } from "@/lib/video.functions";
import { VideoRoom } from "@/components/oka/video-room";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CopyJoinLink } from "@/components/oka/copy-join-link";
import { canShareEventLink, joinUrl } from "@/lib/join-link";
import { eventCallAction } from "@/lib/event-call-entry";
import { canEditEvent } from "@/lib/event-edit";
import { eventMeetingLink } from "@/lib/event-video";
import { EventVideo } from "@/components/oka/event-video";
import { useEnsureInviteCode } from "@/lib/affiliates";
import { ensureEventHostInvite } from "@/lib/affiliate-sharing.functions";
import {
  EVENT_SELECT,
  FORMAT_LABELS,
  TYPE_LABELS,
  formatDuration,
  formatEventDate,
  hostName,
  spotsLeft,
  type EventRow,
} from "@/lib/events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ context, params }) => (await context.queryClient.ensureQueryData(publicEventsOptions)).find((event) => event.id === params.eventId) ?? null,
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — Oka Events` : "Event — Oka";
    const description = loaderData?.description?.slice(0, 180) || "Details, host and RSVP for an Oka family event.";
    const image = loaderData?.photo_url?.startsWith("https://") ? loaderData.photo_url : null;
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
    ] };
  },
  validateSearch: (s: Record<string, unknown>) => z.object({ via: z.enum(["link"]).optional() }).parse({ via: s["via"] === "link" ? "link" : undefined }),
  component: () => <EventPageShell><EventDetail /></EventPageShell>,
});

/** Prefer history.back so Events filters + scroll restore; fall back to /events for cold entry. */
function BackToEvents({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (router.history.canGoBack()) router.history.back();
        else void navigate({ to: "/events" });
      }}
    >
      {children}
    </button>
  );
}

function EventDetail() {
  const { eventId } = Route.useParams();
  const { via } = Route.useSearch();
  const publicEvent = Route.useLoaderData();
  const qc = useQueryClient();
  const { data: uid, isPending: userPending } = useCurrentUserId();
  const eventKey = ["event", eventId, uid ?? null];
  const { data: isAdmin } = useIsStaff();
  const fetchVideoCfg = useServerFn(getVideoConfigured);
  const confirmRsvp = useServerFn(notifyRsvpConfirmed);
  const changeStatus = useServerFn(notifyEventStatus);
  const videoCfg = useQuery({ queryKey: ["video-configured"], queryFn: () => fetchVideoCfg(), staleTime: 5 * 60_000, enabled: Boolean(uid) });

  const q = useQuery({
    queryKey: eventKey,
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      const callerId = auth.user?.id;
      if (!callerId) return { event: publicEvent, location: null, rsvp: undefined as string | undefined };
      const [ev, loc, mine] = await Promise.all([
        supabase.from("events").select(EVENT_SELECT).eq("id", eventId).maybeSingle(),
        // RLS returns nothing unless you're confirmed, the host, or an admin.
        supabase.from("event_locations").select("venue_address,video_link,meeting_link").eq("event_id", eventId).maybeSingle(),
        supabase.from("event_rsvps").select("status").eq("event_id", eventId).eq("user_id", callerId).maybeSingle(),
      ]);
      if (ev.error) throw ev.error;
      if (mine.error) throw mine.error;
      const memberEvent = ev.data as unknown as EventRow | null;
      const event = memberEvent ? { ...memberEvent, host: memberEvent.host ?? publicEvent?.host ?? null } : publicEvent;
      return { event, location: loc.data, rsvp: mine.data?.status };
    },
    enabled: !userPending,
    initialData: !uid && publicEvent ? { event: publicEvent, location: null, rsvp: undefined as string | undefined } : undefined,
  });

  const photo = useQuery({
    queryKey: ["photo", q.data?.event?.host?.photo_url],
    queryFn: () => resolvePhotoUrl(q.data?.event?.host?.photo_url ?? null),
    enabled: !!q.data?.event?.host?.photo_url,
  });

  const cover = useEventPhoto(q.data?.event?.photo_url);

  const myAffiliate = useEnsureInviteCode(uid, q.data?.event?.status === "published");
  const refCode = myAffiliate.data ?? null;
  const fetchHostInvite = useServerFn(ensureEventHostInvite);
  const hostInvite = useMutation({
    mutationFn: () => fetchHostInvite({ data: { eventId } }),
    onError: (error: Error) => toast.error(error.message),
  });

  const rsvp = useMutation({
    mutationFn: async (action: "join" | "leave") => {
      const { data, error } = await supabase.rpc(action === "join" ? "rsvp_event" : "cancel_rsvp", { _event_id: eventId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (status) => {
      if (status === "going") void confirmRsvp({ data: { eventId } }).catch(() => undefined);
      toast.success(status === "going" ? "You're going — see you there" : status === "waitlist" ? "It's full, so you're on the waitlist" : "Your RSVP is cancelled");
      if (status === "going" || status === "waitlist") {
        const evRow = q.data?.event;
        if (evRow) {
          trackEventRegistration({
            id: evRow.id,
            join_slug: evRow.join_slug,
            title: evRow.title,
            hostDisplayName: evRow.host?.display_name,
          });
        }
      }
      const applyStatus = (current: { rsvp?: string } | undefined) => (current ? { ...current, rsvp: status } : current);
      qc.setQueryData(eventKey, applyStatus);
      void qc.invalidateQueries({ queryKey: ["event", eventId] }).then(() => {
        qc.setQueryData(eventKey, applyStatus);
      });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["my-rsvps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const evRow = q.data?.event;
    if (!evRow) return;
    trackEventView({
      id: evRow.id,
      join_slug: evRow.join_slug,
      title: evRow.title,
      hostDisplayName: evRow.host?.display_name,
    });
  }, [q.data?.event?.id]);

  const admin = useMutation({
    mutationFn: (status: "published" | "unpublished" | "rejected" | "cancelled") => changeStatus({ data: { eventId, status } }),
    onSuccess: () => { toast.success("Event updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="px-6 py-16 text-muted-foreground">Loading…</p>;
  const ev = q.data?.event;
  if (!ev) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl text-foreground">This event isn't available</h1>
        <p className="mt-3 text-muted-foreground">It may still be waiting for review, or it has been removed.</p>
        <BackToEvents className="mt-6 inline-block text-primary">Back to events</BackToEvents>
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
  const meetingLink = eventMeetingLink(loc);
  const useRoom = ev.format === "virtual" && videoCfg.data?.configured === true && !past && ev.status !== "cancelled";
  const callAction = eventCallAction({
    via,
    useRoom,
    mayEnter: status === "going" || isManager || Boolean(isAdmin),
    hasExternalLink: Boolean(meetingLink),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <BackToEvents className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> All events
      </BackToEvents>

      {ev.status !== "published" && (
        <div className={cn("mt-6 rounded-2xl px-5 py-3 text-sm", ev.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-golden/25 text-foreground")}>
          {ev.status === "cancelled" ? "This event has been cancelled." : ev.status === "unpublished" ? "Approved but unpublished — off the schedule until you publish again." : ev.status === "pending_approval" ? "Awaiting admin review — not yet on the public schedule." : ev.status === "rejected" ? "This proposal was not approved." : `Status: ${ev.status}`}
        </div>
      )}

      {status === "awaiting_reconfirmation" && ev.status === "published" && (
        <div className="mt-6 rounded-2xl bg-golden/25 px-5 py-4 text-sm text-foreground">
          <p>The time for this gathering has changed. Please confirm whether you can still join.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="rounded-full" disabled={rsvp.isPending} onClick={() => rsvp.mutate("join")}>Confirm attendance</Button>
            <Button variant="outline" className="rounded-full" disabled={rsvp.isPending} onClick={() => rsvp.mutate("leave")}>Can't make it</Button>
          </div>
        </div>
      )}

      {via === "link" && !isManager && (status === "going" || status === "waitlist") && (
        <div className="mt-6 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground">
          {status === "going" ? "You're in — your spot is saved. The call appears below when the room opens." : "This gathering is full, so you're on the waitlist. We'll move you in if a spot opens."}
        </div>
      )}

      {canShareEventLink(Boolean(uid), ev.status) && (
        <section aria-label="Share event" className="mt-6 border-y border-border py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-64">
              <p className="section-label">{ev.host_id === uid ? "Share your gathering" : "Share this gathering"}</p>
              {refCode && <p className="mt-2 break-all text-sm text-muted-foreground">{joinUrl(ev.join_slug, refCode)}</p>}
              {myAffiliate.isPending && <p className="mt-2 text-sm text-muted-foreground">Preparing your invitation…</p>}
              {myAffiliate.isError && <p className="mt-2 text-sm text-destructive">Couldn't prepare your invitation.</p>}
              {myAffiliate.isSuccess && !refCode && <p className="mt-2 text-sm text-muted-foreground">Your affiliate link is paused. Please contact the Oka team.</p>}
            </div>
            {myAffiliate.isError ? (
              <Button variant="outline" className="rounded-full" onClick={() => void myAffiliate.refetch()}>Try again</Button>
            ) : (
              <CopyJoinLink slug={ev.join_slug} refCode={refCode} label="Copy my invite link" disabled={!refCode || myAffiliate.isFetching} />
            )}
          </div>
          {isAdmin && ev.host_id && ev.host_id !== uid && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <div className="min-w-0 flex-1 basis-64">
                <p className="section-label">Host · {hostName(ev.host)}</p>
                {hostInvite.data && <p className="mt-2 break-all text-sm text-muted-foreground">{joinUrl(ev.join_slug, hostInvite.data)}</p>}
                {hostInvite.isSuccess && !hostInvite.data && <p className="mt-2 text-sm text-muted-foreground">The host's affiliate link is paused.</p>}
              </div>
              {hostInvite.data ? (
                <CopyJoinLink slug={ev.join_slug} refCode={hostInvite.data} label="Copy host's link" />
              ) : (
                <Button variant="outline" className="rounded-full" disabled={hostInvite.isPending || (hostInvite.isSuccess && !hostInvite.data)} onClick={() => hostInvite.mutate()}>
                  {hostInvite.isPending ? "Preparing…" : "Get host's link"}
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {cover && <img src={cover} alt="" className="mt-8 h-auto w-full rounded-3xl object-contain object-center shadow-soft" />}

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
              <EventTime start={ev.starts_at} end={ev.ends_at} timezone={ev.timezone} />
            </Detail>
            {duration && <Detail icon={Hourglass}>Duration · {duration}</Detail>}
            <Detail icon={Clock}><ViewerTimezone /></Detail>
          </div>

          <div className="mt-8 rounded-2xl bg-secondary/50 p-5">
            <p className="section-label">{ev.format === "virtual" ? (useRoom && !meetingLink ? "Event room" : "Join meeting") : "Location"}</p>
            {meetingLink && (
              <p className="mt-3 flex items-start gap-2 break-all">
                <Video className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
                <a href={meetingLink} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{meetingLink}</a>
              </p>
            )}
            {callAction === "room_button" ? (
              <VideoRoom eventId={ev.id} startsAt={ev.starts_at} bypassTiming={!!isAdmin} />
            ) : callAction === "locked" ? (
              <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                <Lock className="size-4 text-primary" strokeWidth={1.5} />
                The room is open to confirmed guests once you're going.
              </p>
            ) : loc?.venue_address ? (
              <p className="mt-3 flex items-start gap-2 break-all">
                <LocIcon className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
                {loc.venue_address}
              </p>
            ) : meetingLink ? null : (
              <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                <Lock className="size-4 text-primary" strokeWidth={1.5} />
                {loc ? "Details coming soon." : "Shared with confirmed guests once you're going."}
              </p>
            )}
          </div>

          <p className="section-label mt-10">About</p>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground">{ev.description || "More details soon."}</p>
          <EventVideo url={ev.video_url} />
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
              !uid ? (
                <div className="mt-6"><EventSignIn label="Sign in / Sign up to RSVP" /></div>
              ) : status === "going" ? (
                <div className="mt-6 grid justify-items-center gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground" role="status">
                    <Check className="size-4 text-primary" strokeWidth={1.5} /> You're going
                  </span>
                  <AddToCalendarDropdown event={{
                    id: ev.id, title: ev.title, startsAt: ev.starts_at, endsAt: ev.ends_at,
                    description: ev.description, url: joinUrl(ev.join_slug),
                    location: meetingLink || loc?.venue_address || null,
                  }} />
                  <Button variant="link" className="h-auto whitespace-normal p-0 text-sm text-muted-foreground" disabled={rsvp.isPending} onClick={() => rsvp.mutate("leave")}>
                    {rsvp.isPending ? "Cancelling…" : "Can't make it"}
                  </Button>
                </div>
              ) : status === "waitlist" ? (
                <Button variant="outline" className="mt-6 w-full rounded-full" disabled={rsvp.isPending} onClick={() => rsvp.mutate("leave")}>
                  Leave the waitlist
                </Button>
              ) : status === "awaiting_reconfirmation" ? (
                <p className="mt-6 text-sm text-muted-foreground">Please confirm your attendance above.</p>
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
            {uid ? <Link to={ev.host_id ? "/members/$memberId" : "/directory"} params={{ memberId: ev.host_id ?? "" }} className="mt-4 flex items-center gap-3">
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
            </Link> : <div className="mt-4 flex items-center gap-3">
              <Avatar className="size-12">
                {photo.data && <AvatarImage src={photo.data} alt="" />}
                <AvatarFallback className="bg-secondary text-foreground">{hostName(ev.host).slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{hostName(ev.host)}</span>
            </div>}
          </div>

          {canEditEvent(ev, uid, Boolean(isAdmin)) && (
            <div className="grid gap-2 rounded-2xl bg-accent/60 p-5">
              <p className="section-label">{isAdmin ? "Moderation" : ev.status === "pending_approval" ? "Your proposal" : "Host tools"}</p>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/events/edit/$eventId" params={{ eventId }}><Pencil className="size-4" strokeWidth={1.5} /> Edit</Link>
              </Button>
              {ev.status === "unpublished" && (
                <Button className="rounded-full" disabled={admin.isPending} onClick={() => admin.mutate("published")}>Publish</Button>
              )}
              {isAdmin && !["published", "cancelled", "unpublished"].includes(ev.status) && (
                <Button className="rounded-full" disabled={admin.isPending} onClick={() => admin.mutate("published")}>Approve & publish</Button>
              )}
              {isAdmin && ev.status === "pending_approval" && (
                <Button variant="outline" className="rounded-full" onClick={() => admin.mutate("rejected")}>Reject</Button>
              )}
              {isAdmin && ev.status === "published" && (
                <Button variant="outline" className="rounded-full" disabled={admin.isPending} onClick={() => confirm("Unpublish this event? Its approval and RSVPs stay saved; the host can edit and publish again.") && admin.mutate("unpublished")}>Unpublish</Button>
              )}
              {isAdmin && ["published", "unpublished"].includes(ev.status) && (
                <Button variant="outline" className="rounded-full text-destructive" onClick={() => confirm("Cancel this event for everyone?") && admin.mutate("cancelled")}>
                  Cancel event
                </Button>
              )}
            </div>
          )}

          {past && (isManager || isAdmin) && <AttendanceCheckIn eventId={ev.id} />}
        </aside>
      </div>
    </div>
  );
}

type AttendeeRow = { user_id: string; attended: boolean; display_name: string | null };

/** Host/admin attendance check-in. Feeds event_contributions.verified_attendees
 * (via public.sync_event_contributions), which is the real source for
 * contribution points on Open Accounting — there is no attendance tracking
 * anywhere else in the app. */
function AttendanceCheckIn({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const attendees = useQuery({
    queryKey: ["event", eventId, "attendees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("user_id,attended,profile:profiles!event_rsvps_user_id_fkey(display_name)")
        .eq("event_id", eventId)
        .eq("status", "going")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        user_id: row.user_id,
        attended: row.attended,
        display_name: (row as unknown as { profile: { display_name: string | null } | null }).profile?.display_name ?? null,
      })) as AttendeeRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, attended }: { userId: string; attended: boolean }) => {
      const { error } = await supabase.from("event_rsvps").update({ attended }).eq("event_id", eventId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event", eventId, "attendees"] }),
    onError: () => toast.error("That didn't save."),
  });

  const rows = attendees.data ?? [];
  if (attendees.isLoading) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="section-label">Attendance check-in</p>
      <p className="mt-2 text-sm text-muted-foreground">Verified attendees earn contribution points on Open Accounting.</p>
      <ul className="mt-4 grid gap-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">No one RSVP'd as going.</p>}
        {rows.map((row) => (
          <li key={row.user_id} className="flex items-center justify-between gap-3">
            <span className="text-foreground">{row.display_name ?? "Member"}</span>
            <Button
              type="button"
              size="sm"
              variant={row.attended ? "default" : "outline"}
              className="rounded-full"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ userId: row.user_id, attended: !row.attended })}
            >
              {row.attended ? "Attended" : "Mark attended"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} />
      {children}
    </span>
  );
}
