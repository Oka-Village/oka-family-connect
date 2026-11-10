import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Copy, Gift, Home, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { MyEvents } from "@/components/oka/my-events";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { hasPaidMembership } from "@/lib/membership";
import { FULL_ACCESS_OPENS_AT, isFullMember } from "@/lib/member-access";
import { inviteUrl } from "@/lib/affiliate-share";
import { claimEventInvite, peekEventJoinSlug, pickInviteCard } from "@/lib/event-invite";
import { formatEventDate } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title: "Make yourself at home · Oka" },
      { name: "description", content: "A few gentle first steps while your place in the family is kept." },
      { property: "og:title", content: "Make yourself at home · Oka" },
      { property: "og:description", content: "A few gentle first steps while your place in the family is kept." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

async function hasRow(table: "skills" | "houses", uid: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("owner_id", uid);
  if (error) throw error;
  return (count ?? 0) > 0;
}

function Welcome() {
  const uid = useProfile().data?.id;
  const profile = useProfile();
  const roles = useRoles();
  const membership = useMembership(profile.data?.id);
  const qc = useQueryClient();
  const claimed = useRef(false);
  const fullAccess = roles.data?.isStaff === true || isFullMember(profile.data, new Date(), hasPaidMembership(membership.data));
  useEffect(() => {
    if (!uid || claimed.current) return;
    const slug = peekEventJoinSlug();
    if (!slug) return;
    claimed.current = true;
    void claimEventInvite(slug, uid).then(() => {
      void qc.invalidateQueries({ queryKey: ["event-invite-card", uid] });
    }).catch(() => { /* one attempt per visit */ });
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
        .in("id", visits.map((visit) => visit.event_id));
      if (eventError) throw eventError;
      return pickInviteCard(visits, events ?? []);
    },
  });
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
        skill, house,
        event: (events.count ?? 0) > 0,
        inviteCode: aff.data?.invite_code ?? null,
        invited: !stats.error && Array.isArray(stats.data) && stats.data.length > 0,
      };
    },
  });
  const p = progress.data;
  const link = p?.inviteCode ? inviteUrl(p.inviteCode) : "";

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    catch { toast.error("Couldn't copy — select the link and copy it by hand."); }
  }

  const name = profile.data?.display_name?.trim();
  const daysUntilOpen = Math.max(0, Math.ceil((Date.parse(FULL_ACCESS_OPENS_AT) - Date.now()) / 86_400_000));

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
      <p className="section-label">Welcome to Oka</p>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-6xl">
        Make yourself at home{name ? <>, <span className="italic text-sage">{name}.</span></> : "."}
      </h1>

      <section className="mt-8 flex flex-col gap-4 rounded-3xl bg-sage-light/40 p-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="sm:max-w-xs sm:border-r sm:border-sand sm:pr-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sage-ink">This month · Presence</p>
          <p className="mt-2 text-sm text-sage-ink">Giving presence to your neighbours</p>
        </div>
        <p className="text-sage-ink">
          <span className="font-number text-5xl font-light text-sage">{daysUntilOpen}</span>
          <span className="ml-3 text-sm">days until the whole home opens on December 1</span>
        </p>
      </section>

      {(membership.isSuccess && !hasPaidMembership(membership.data) && roles.data?.isStaff !== true) || invite.data ? (
        <section className="mt-10">
          <p className="section-label">For you today</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {membership.isSuccess && !hasPaidMembership(membership.data) && roles.data?.isStaff !== true && (
              <article className="surface-card p-6">
                <p className="section-label">Founding membership</p>
                <h2 className="mt-2 font-serif text-2xl text-foreground">Support Oka&apos;s chosen family</h2>
                <p className="mt-2 text-sm text-muted-foreground">$29 per month, or $250 once for lifetime membership.</p>
                <Button asChild className="mt-5 rounded-full bg-sage text-cream hover:bg-sage/90">
                  <Link to="/membership" search={{ session_id: undefined, kind: undefined }}>See membership plans</Link>
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
                  <Link to="/events/$eventId" params={{ eventId: invite.data.id }}>See the event</Link>
                </Button>
              </article>
            )}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <p className="section-label">Four small ways to begin</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Item to="/skills/new" icon={Sparkles} title="Add a skill" hint="Something you'd love to share." done={p?.skill} />
          <Item to="/houses/new" icon={Home} title="Add your home" hint="A door you could open to family." done={p?.house} />
          <Item to="/events/new" icon={CalendarPlus} title="Add an event" hint="A gathering, a walk, a circle." done={p?.event} />
          <Item to="/affiliate" icon={Gift} title="Invite a friend" hint="Bring someone you'd trust with your home." done={p?.invited}>
            {!p?.invited && link && (
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground">{link}</code>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => void copy()}><Copy className="size-4 text-sage" strokeWidth={1.5} />Copy</Button>
              </div>
            )}
          </Item>
        </div>
      </section>

      <MyEvents />

      {!fullAccess && (
        <section className="surface-card mt-10 p-7 text-center sm:p-10">
          <h2 className="text-3xl text-foreground">Your place in the family is kept.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">Full access opens on December 1. Until then you can add what you&apos;d love to offer and complete your <Link to="/profile" className="text-sage underline-offset-4 hover:underline">profile</Link> — the rest of the app opens at the soft launch.</p>
        </section>
      )}
    </div>
  );
}

function Item({ to, icon: Icon, title, hint, done, children }: { to: "/skills/new" | "/houses/new" | "/events/new" | "/affiliate"; icon: LucideIcon; title: string; hint: string; done?: boolean | undefined; children?: React.ReactNode }) {
  return (
    <div className="surface-card flex min-h-[76px] flex-col justify-center rounded-full px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-sage text-cream" : "bg-sage-light text-sage-ink"}`}>
          {done ? <Check className="size-4" strokeWidth={1.5} /> : <Icon className="size-4" strokeWidth={1.5} />}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={to} className="font-medium text-foreground hover:text-sage">{done ? "Add another" : title}</Link>
          <p className="truncate text-xs text-muted-foreground">{done ? "Done — thank you." : hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
