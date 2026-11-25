import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { useProfile } from "@/hooks/use-profile";
import { inviteUrl, PRODUCTION_ORIGIN } from "@/lib/affiliate-share";
import { useEnsureInviteCode } from "@/lib/affiliates";
import { formatEventTimeDual } from "@/lib/event-time";
import { FORMAT_LABELS, hostName, type EventRow } from "@/lib/events";
import { publicEventsOptions } from "@/lib/public-events.functions";
import { cn } from "@/lib/utils";

const EVENT_ID_RE = /^\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const NOTE_PLACEHOLDER = "I found a quiet corner I think you'd love. I saved you a seat.";

export type InviteEvent = Pick<EventRow, "id" | "title" | "starts_at" | "timezone" | "format" | "join_slug" | "host">;

function eventIdFromPath(pathname: string): string | null {
  return EVENT_ID_RE.exec(pathname)?.[1] ?? null;
}

function eventPageUrl(eventId: string) {
  return `${PRODUCTION_ORIGIN}/events/${eventId}`;
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}

/** Copy text with clipboard API, falling back to a temporary textarea. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through */
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  if (!ok) throw new Error("copy failed");
}

function useRouteInviteEvent(): InviteEvent | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const eventId = eventIdFromPath(pathname);
  const catalog = useQuery({ ...publicEventsOptions, enabled: Boolean(eventId) });
  if (!eventId || !catalog.data) return null;
  const row = catalog.data.find((e) => e.id === eventId);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    starts_at: row.starts_at,
    timezone: row.timezone,
    format: row.format,
    join_slug: row.join_slug,
    host: row.host,
  };
}

/** Compact header CTA that opens the invite dialog — sage green, matching the invite modal. */
export function InviteFriendCta({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const routeEvent = useRouteInviteEvent();

  return (
    <>
      <Button
        type="button"
        className={cn(
          "h-9 shrink-0 whitespace-nowrap rounded-full bg-sage-deep px-3 text-cream hover:bg-sage-dark sm:px-4",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <span className="font-kaomoji" aria-hidden>
          (´◡`)っ✿
        </span>
        <span className="sm:hidden">Invite</span>
        <span className="hidden sm:inline">Invite a friend</span>
      </Button>
      <InviteFriendDialog open={open} onOpenChange={setOpen} event={routeEvent} />
    </>
  );
}

function EventInvitePreview({ event, inviterName }: { event: InviteEvent; inviterName: string }) {
  const [viewerTimezone, setViewerTimezone] = useState<string | null>(null);
  useEffect(() => {
    setViewerTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const dual = formatEventTimeDual(event.starts_at, null, event.timezone, viewerTimezone);
  const zone = viewerTimezone || event.timezone || undefined;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(event.starts_at));
  const timeBit = dual.local
    ? dual.local.replace(/\s*·\s*/g, " ").trim()
    : dual.primary;
  const meta = [dateLabel, timeBit, FORMAT_LABELS[event.format], `with ${hostName(event.host)}`].join(" · ");

  return (
    <div className="relative mt-2 rounded-2xl border border-dashed border-golden/50 bg-sand/40 px-5 pb-5 pt-10 text-center">
      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-golden px-3 py-1 font-kaomoji text-sm text-brown">
        (´◡`)っ♡
      </span>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-terracotta">
        {inviterName} invites you to
      </p>
      <p className="mt-2 font-serif text-2xl italic leading-snug text-foreground">{event.title}</p>
      <p className="mt-3 text-sm text-muted-foreground">{meta}</p>
      <p className="mt-4 text-xs text-muted-foreground">One World Family · by invitation</p>
    </div>
  );
}

export function InviteFriendDialog({
  open,
  onOpenChange,
  event = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: InviteEvent | null;
}) {
  const { data: uid } = useCurrentUserId();
  const invite = useEnsureInviteCode(uid, open && Boolean(uid) && !event);
  const personalLink = invite.data ? inviteUrl(invite.data) : "";
  const link = event ? eventPageUrl(event.id) : personalLink;
  const linkBusy = !event && (invite.isPending || invite.isFetching) && !invite.data;
  const profile = useProfile();
  const name = profile.data?.display_name?.trim() || "A member";
  const [note, setNote] = useState("");

  async function copyInvitation() {
    if (!link) {
      if (invite.isError) {
        toast.error("Couldn't prepare your invitation.");
        void invite.refetch();
        return;
      }
      toast.error("Your invite link isn't ready yet.");
      return;
    }
    const text = !event && note.trim() ? `${note.trim()}\n\n${link}` : link;
    try {
      await copyText(text);
      toast.success("Invitation copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-[1.75rem] sm:max-w-lg">
        {event ? (
          <>
            <DialogHeader className="space-y-2 text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-terracotta">
                Members and the friends they invite
              </p>
              <DialogTitle className="font-serif text-2xl text-foreground sm:text-3xl">
                Save a seat for a friend
              </DialogTitle>
              <DialogDescription className="sr-only">
                Share an invitation link to {event.title}.
              </DialogDescription>
            </DialogHeader>
            <EventInvitePreview event={event} inviterName={name} />
          </>
        ) : (
          <>
            <DialogHeader className="space-y-2 text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sage-ink">
                Membership is by invitation
              </p>
              <DialogTitle className="font-serif text-2xl text-foreground">
                Invite a friend into the family
              </DialogTitle>
              <DialogDescription className="sr-only">
                Share a personal invitation with your personal invite link.
              </DialogDescription>
            </DialogHeader>

            <div className="relative mt-2 rounded-2xl border border-dashed border-sage-deep/40 bg-sage-light px-5 pb-4 pt-8 text-center">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sage-deep px-3 py-1 text-xs text-cream">
                ╰(*´︶`*)╯♡
              </span>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sage-ink">
                {name} invites you to
              </p>
              <p className="mt-2 font-serif text-2xl text-foreground">One World Family</p>
              <p className="mt-2 text-sm text-sage-ink/90">
                A members-only community where we learn together, share what we know, and open our doors to
                each other.
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <label htmlFor="invite-friend-note" className="text-sm text-foreground">
                Add a personal note (optional)
              </label>
              <Textarea
                id="invite-friend-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={NOTE_PLACEHOLDER}
                rows={2}
                className="rounded-xl border-border bg-background"
              />
            </div>
          </>
        )}

        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
          <code className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">
            {linkBusy ? "Preparing your link…" : link ? displayUrl(link) : "Your invite link isn’t ready yet"}
          </code>
          <Button
            type="button"
            size="sm"
            className="shrink-0 rounded-full bg-sage-deep text-cream hover:bg-sage-dark"
            disabled={!link || linkBusy}
            onClick={() => void copyInvitation()}
          >
            {linkBusy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Copy className="size-4" strokeWidth={1.5} />
            )}
            Copy invitation
          </Button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {event
            ? "Your link carries your name. If a friend becomes a member through it, you receive a share of their membership."
            : "This is your personal link. If your friend becomes a member through it, you receive a share of their membership."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
