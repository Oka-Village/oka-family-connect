import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Copy, Gift, Home, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { hasPaidMembership } from "@/lib/membership";
import { inviteUrl } from "@/lib/affiliate-share";
import { claimEventInvite, peekEventJoinSlug, pickInviteCard } from "@/lib/event-invite";
import { formatEventDate } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";

async function hasRow(table: "skills" | "houses", uid: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("owner_id", uid);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Founding nudge + event invite card — same conditions as the former welcome hub. */
export function HomeForYouToday() {
  const uid = useProfile().data?.id;
  const profile = useProfile();
  const roles = useRoles();
  const membership = useMembership(profile.data?.id);
  const qc = useQueryClient();
  const claimed = useRef(false);

  useEffect(() => {
    if (!uid || claimed.current) return;
    const slug = peekEventJoinSlug();
    if (!slug) return;
    claimed.current = true;
    void claimEventInvite(slug, uid)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["event-invite-card", uid] });
      })
      .catch(() => {
        /* one attempt per visit */
      });
  }, [uid, qc]);

  const invite = useQuery({
    queryKey: ["event-invite-card", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      if (!uid) return null;
      const { data: visits, error } = await supabase
        .from("event_link_visits")
        .select("event_id,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return null;
      if (!visits?.length) return null;
      const { data: events, error: eventError } = await supabase
        .from("events")
        .select("id,title,starts_at,ends_at,timezone,status")
        .in(
          "id",
          visits.map((visit) => visit.event_id),
        );
      if (eventError) throw eventError;
      return pickInviteCard(visits, events ?? []);
    },
  });

  const showFounding = membership.isSuccess && !hasPaidMembership(membership.data) && roles.data?.isStaff !== true;
  if (!showFounding && !invite.data) return null;

  return (
    <section>
      <p className="section-label">For you today</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {showFounding && (
          <article className="surface-card p-6">
            <p className="section-label">Founding membership</p>
            <h2 className="mt-2 font-serif text-2xl text-foreground">Support Oka&apos;s chosen family</h2>
            <p className="mt-2 text-sm text-muted-foreground">$29 per month, or $250 once for lifetime membership.</p>
            <Button asChild className="mt-5 rounded-full bg-sage text-cream hover:bg-sage/90">
              <Link to="/membership" search={{ session_id: undefined, kind: undefined }}>
                See membership plans
              </Link>
            </Button>
          </article>
        )}
        {invite.data && (
          <article className="surface-card p-6">
            <p className="section-label">You&apos;re invited</p>
            <h2 className="mt-2 font-serif text-2xl text-foreground">{invite.data.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{formatEventDate(invite.data.starts_at, invite.data.timezone)}</p>
            <p className="mt-3 text-foreground">You&apos;re invited to this event.</p>
            <Button asChild className="mt-5 rounded-full bg-sage text-cream hover:bg-sage/90">
              <Link to="/events/$eventId" params={{ eventId: invite.data.id }}>
                See the event
              </Link>
            </Button>
          </article>
        )}
      </div>
    </section>
  );
}

/** Checklist of first contributions, with invite link copy when available. */
export function HomeWaysToBegin() {
  const uid = useProfile().data?.id;
  const progress = useQuery({
    queryKey: ["welcome-checklist", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      if (!uid) throw new Error("Sign in to see your checklist.");
      const id = uid;
      const [skill, house, events, aff, stats] = await Promise.all([
        hasRow("skills", id),
        hasRow("houses", id),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("created_by", id),
        supabase.from("affiliates").select("invite_code").eq("user_id", id).maybeSingle(),
        supabase.rpc("affiliate_referral_stats", {}),
      ]);
      return {
        skill,
        house,
        event: (events.count ?? 0) > 0,
        inviteCode: aff.data?.invite_code ?? null,
        invited: !stats.error && Array.isArray(stats.data) && stats.data.length > 0,
      };
    },
  });
  const p = progress.data;
  const link = p?.inviteCode ? inviteUrl(p.inviteCode) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  return (
    <section>
      <p className="section-label">Four small ways to begin</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Item to="/skills/new" icon={Sparkles} title="Add a skill" hint="Something you'd love to share." done={p?.skill} />
        <Item to="/houses/new" icon={Home} title="Add your home" hint="A door you could open to family." done={p?.house} />
        <Item to="/events/new" icon={CalendarPlus} title="Add an event" hint="A gathering, a walk, a circle." done={p?.event} />
        <Item to="/affiliate" icon={Gift} title="Invite a friend" hint="Bring someone you'd trust with your home." done={p?.invited}>
          {!p?.invited && link ? (
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground">{link}</code>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void copy()}>
                <Copy className="size-4 text-sage" strokeWidth={1.5} />
                Copy
              </Button>
            </div>
          ) : null}
        </Item>
      </div>
    </section>
  );
}

function Item({
  to,
  icon: Icon,
  title,
  hint,
  done,
  children,
}: {
  to: "/skills/new" | "/houses/new" | "/events/new" | "/affiliate";
  icon: LucideIcon;
  title: string;
  hint: string;
  done?: boolean | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="surface-card flex min-h-[76px] flex-col justify-center rounded-full px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-sage text-cream" : "bg-sage-light text-sage-ink"}`}>
          {done ? <Check className="size-4" strokeWidth={1.5} /> : <Icon className="size-4" strokeWidth={1.5} />}
        </span>
        <div className="min-w-0 flex-1">
          {done ? (
            <>
              <p className="font-medium text-foreground">{title}</p>
              <p className="truncate text-xs text-muted-foreground">Done — thank you.</p>
              <Link to={to} className="mt-1 inline-block text-xs font-medium text-sage hover:underline">
                Add another
              </Link>
            </>
          ) : (
            <>
              <Link to={to} className="font-medium text-foreground hover:text-sage">
                {title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{hint}</p>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
