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
import { isFullMember } from "@/lib/member-access";
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

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <p className="section-label">Welcome to Oka</p>
      <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-secondary-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        Oka launches December 1
      </p>
      <h1 className="mt-4 text-4xl text-foreground sm:text-5xl">Make yourself at home</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">Four small ways to begin, whenever you're ready.</p>

      {invite.data && (
        <section className="surface-card mt-10 p-6">
          <p className="section-label">You're invited</p>
          <h2 className="mt-2 font-serif text-2xl text-foreground">{invite.data.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{formatEventDate(invite.data.starts_at, invite.data.timezone)}</p>
          <p className="mt-3 text-foreground">You're invited to this event.</p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/events/$eventId" params={{ eventId: invite.data.id }}>See the event</Link>
          </Button>
        </section>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Item to="/skills/new" icon={Sparkles} title="Add a skill" hint="Something you'd love to share." done={p?.skill} />
        <Item to="/houses/new" icon={Home} title="Add your house" hint="A door you could open to family." done={p?.house} />
        <Item to="/events/new" icon={CalendarPlus} title="Add an event" hint="A gathering, a walk, a circle." done={p?.event} />
        <Item to="/affiliate" icon={Gift} title="Invite friends" hint="Bring someone you'd trust with your home." done={p?.invited}>
          {!p?.invited && link && (
            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-4 py-2 text-xs text-secondary-foreground">{link}</code>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void copy()}><Copy className="size-4 text-primary" strokeWidth={1.5} />Copy</Button>
            </div>
          )}
        </Item>
      </div>

      <MyEvents />

      {!fullAccess && (
        <section className="surface-card mt-10 p-7 text-center sm:p-10">
          <h2 className="text-3xl text-foreground">Your place in the family is kept.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">Full access opens on December 1. Until then you can add what you'd love to offer and complete your <Link to="/profile" className="text-primary underline-offset-4 hover:underline">profile</Link> — the rest of the app opens at the soft launch.</p>
        </section>
      )}
    </div>
  );
}

function Item({ to, icon: Icon, title, hint, done, children }: { to: "/skills/new" | "/houses/new" | "/events/new" | "/affiliate"; icon: LucideIcon; title: string; hint: string; done?: boolean | undefined; children?: React.ReactNode }) {
  return (
    <div className="surface-card flex flex-col p-6">
      <div className="flex items-start gap-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
          {done ? <Check className="size-5" strokeWidth={1.5} /> : <Icon className="size-5" strokeWidth={1.5} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{done ? "Done — thank you." : hint}</p>
        </div>
      </div>
      {children}
      <Button asChild variant={done ? "ghost" : "default"} className="mt-5 self-start rounded-full">
        <Link to={to}>{done ? "Add another" : title}</Link>
      </Button>
    </div>
  );
}
