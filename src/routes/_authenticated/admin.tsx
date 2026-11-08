import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarDays, Palette, Gift, Home, Plus, Search, ShieldCheck, Sparkles, Star, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserId, useRoles } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { getAdminMemberStatuses } from "@/lib/admin-members.functions";
import { deleteEvent, setEventStatus } from "@/lib/event-admin";
import { groupEventSeries, type GroupedEvent } from "@/lib/event-series";
import { EVENT_SELECT, TYPE_LABELS, formatEventDate, formatEventTime, hostName, type EventRow } from "@/lib/events";
import { memberStatusIndicators } from "@/lib/member-status";
import { CopyJoinLink } from "@/components/oka/copy-join-link";
import { AffiliatesSection } from "@/components/oka/admin-affiliates";
import { FacilitatorsSection } from "@/components/oka/admin-facilitators";
import { ActivitySection } from "@/components/oka/admin-activity";
import { ThemesSection } from "@/components/oka/admin-themes";
import { cn } from "@/lib/utils";
import { AdminDeleteMember, AdminEditProfile, AdminMemberPhoto, AdminSuspendMember, BlockedEmails, useSuspendedIds } from "@/components/oka/admin-member-tools";

const TABS = ["events", "members", "listings", "affiliates", "facilitators", "activity", "themes"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  // Route-level guard: members without admin/moderator are sent to Events before anything renders.
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id).in("role", ["admin", "moderator"]);
    if (!data || data.length === 0) throw redirect({ to: "/events" });
  },
  head: () => ({
    meta: [
      { title: "Admin — Oka" },
      { name: "description", content: "Review events, manage roles and moderate listings across Oka." },
      { property: "og:title", content: "Admin — Oka" },
      { property: "og:description", content: "Review events, manage roles and moderate listings across Oka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: roles, isLoading } = useRoles();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });

  if (isLoading) return null;
  if (!roles?.isStaff) {
    return <EmptyState icon={ShieldCheck} label="Admin" title="This space is for the stewards" description="If you think you should have access, reach out to the Oka team." />;
  }
  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "events", label: "Events", icon: CalendarDays },
    ...(roles.isAdmin ? [{ id: "members" as const, label: "Members", icon: Users }] : []),
    { id: "listings", label: "Houses & skills", icon: Home },
    ...(roles.isAdmin ? [{ id: "affiliates" as const, label: "Affiliates", icon: Gift }] : []),
    ...(roles.isAdmin ? [{ id: "facilitators" as const, label: "Facilitators", icon: Star }] : []),
    ...(roles.isAdmin ? [{ id: "activity" as const, label: "Activity log", icon: Activity }] : []),
    ...(roles.isAdmin ? [{ id: "themes" as const, label: "Themes", icon: Palette }] : []),
  ];
  const active: Tab = tab && tabs.some((t) => t.id === tab) ? tab : "events";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <p className="section-label">{roles.isAdmin ? "Admin" : "Moderation"}</p>
      <h1 className="mt-3 text-4xl text-foreground">Tend the family</h1>
      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate({ search: { tab: t.id }, replace: true })}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
              active === t.id ? "border-transparent bg-secondary text-secondary-foreground" : "border-border text-muted-foreground",
            )}
          >
            <t.icon className="size-4 text-primary" strokeWidth={1.5} /> {t.label}
          </button>
        ))}
      </div>
      {active === "events" && <EventsSection />}
      {active === "members" && roles.isAdmin && <MembersSection viewerIsAdmin={roles.isAdmin} />}
      {active === "listings" && <ListingsSection />}
      {active === "affiliates" && roles.isAdmin && <AffiliatesSection />}
      {active === "facilitators" && roles.isAdmin && <FacilitatorsSection />}
      {active === "activity" && roles.isAdmin && <ActivitySection />}
      {active === "themes" && roles.isAdmin && <ThemesSection />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">{children}</li>;
}

// ---------------- Events ----------------
async function loadEvents(statuses: string[], upcomingOnly: boolean) {
  let q = supabase.from("events").select(EVENT_SELECT).in("status", statuses).order("starts_at").limit(400);
  if (upcomingOnly) q = q.gte("starts_at", new Date().toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as EventRow[];
}

function EventsSection() {
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ["admin", "pending"], queryFn: () => loadEvents(["pending_approval"], false) });
  const live = useQuery({ queryKey: ["admin", "live"], queryFn: () => loadEvents(["published"], true) });
  const cancelled = useQuery({ queryKey: ["admin", "cancelled"], queryFn: () => loadEvents(["cancelled"], false) });
  const act = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "published" | "rejected" | "cancelled" }) => {
      for (const id of ids) await setEventStatus(id, status);
    },
    onSuccess: () => { toast.success("Event updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await deleteEvent(id);
    },
    onSuccess: () => { toast.success("Event deleted"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const pendingList = groupEventSeries(pending.data ?? [], "upcoming");
  const liveList = groupEventSeries(live.data ?? [], "upcoming");
  const cancelledList = groupEventSeries(cancelled.data ?? [], "upcoming");

  const DeleteButton = ({ item }: { item: GroupedEvent<EventRow> }) => (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full text-destructive"
      disabled={del.isPending && del.variables?.includes(item.event.id)}
      onClick={() => {
        const message = item.count > 1
          ? `Delete all ${item.count} dates of "${item.event.title}" for good? They disappear from the schedule for everyone, along with their sign-ups and private locations. This cannot be undone.`
          : `Delete "${item.event.title}" for good? It disappears from the schedule for everyone, along with its sign-ups and its private location. This cannot be undone.`;
        if (confirm(message)) del.mutate(item.ids);
      }}
    >
      <Trash2 className="size-4" strokeWidth={1.5} /> Delete
    </Button>
  );

  const Row = ({ item, children }: { item: GroupedEvent<EventRow>; children: React.ReactNode }) => {
    const e = item.event;
    return (
      <Card>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{TYPE_LABELS[e.event_type]}</p>
          <Link to="/events/$eventId" params={{ eventId: e.id }} className="font-serif mt-1 block text-xl text-foreground hover:underline">{e.title}</Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)} · by {hostName(e.host)}
            {e.capacity ? ` · ${e.going_count}/${e.capacity} going` : ""}
          </p>
          {item.label && <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/events/edit/$eventId" params={{ eventId: e.id }}>Edit</Link>
          </Button>
          {children}
        </div>
      </Card>
    );
  };

  return (
    <section className="mt-10">
      <div className="flex justify-end">
        <Button asChild className="rounded-full">
          <Link to="/events/new"><Plus className="size-4" strokeWidth={1.5} /> Create event</Link>
        </Button>
      </div>
      <p className="section-label mt-6">Awaiting review</p>
      <ul className="mt-4 grid gap-4">
        {pending.data?.length === 0 && <p className="text-muted-foreground">Nothing waiting — all caught up.</p>}
        {pendingList.map((item) => (
          <Row key={item.event.id} item={item}>
            <Button size="sm" className="rounded-full" onClick={() => {
              const ok = item.count === 1 || confirm(`Approve all ${item.count} dates of "${item.event.title}"?`);
              if (ok) act.mutate({ ids: item.ids, status: "published" });
            }}>Approve</Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => {
              const ok = item.count === 1 || confirm(`Reject all ${item.count} dates of "${item.event.title}"?`);
              if (ok) act.mutate({ ids: item.ids, status: "rejected" });
            }}>Reject</Button>
            <DeleteButton item={item} />
          </Row>
        ))}
      </ul>
      <p className="section-label mt-12">Upcoming published</p>
      <ul className="mt-4 grid gap-4">
        {live.data?.length === 0 && <p className="text-muted-foreground">No upcoming events yet.</p>}
        {liveList.map((item) => (
          <Row key={item.event.id} item={item}>
            {item.event.format === "virtual" && <CopyJoinLink slug={item.event.join_slug} />}
            <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => {
              const message = item.count > 1 ? `Cancel all ${item.count} dates of "${item.event.title}" for everyone?` : "Cancel this event for everyone?";
              if (confirm(message)) act.mutate({ ids: item.ids, status: "cancelled" });
            }}>Cancel</Button>
            <DeleteButton item={item} />
          </Row>
        ))}
      </ul>
      {(cancelled.data?.length ?? 0) > 0 && (
        <>
          <p className="section-label mt-12">Cancelled</p>
          <p className="mt-2 text-sm text-muted-foreground">Off the schedule, but still visible to the people who signed up. Deleting takes it away for good.</p>
          <ul className="mt-4 grid gap-4">
            {cancelledList.map((item) => (
              <Row key={item.event.id} item={item}>
                <DeleteButton item={item} />
              </Row>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------------- Members (admin only) ----------------
function MembersSection({ viewerIsAdmin }: { viewerIsAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserId();
  const [term, setTerm] = useState("");
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const { data: suspendedIds } = useSuspendedIds();
  const q = useQuery({
    queryKey: ["admin", "members", term],
    queryFn: async () => {
      const BASE = "id,display_name,location,profession,photo_url,trial_started_at";
      const run = (cols: string) => {
        let pq = supabase.from("profiles").select(cols).order("display_name").limit(25);
        if (term.trim()) pq = pq.ilike("display_name", `%${term.trim().replace(/[%_]/g, "")}%`);
        return pq;
      };
      type Person = { id: string; display_name: string | null; location: string | null; profession: string | null; photo_url: string | null; trial_started_at: string | null; approved_at?: string | null };
      // approved_at may not exist yet; fall back to today's query if it errors.
      let hasApproval = true;
      let res = await run(`${BASE},approved_at`);
      if (res.error) { hasApproval = false; res = await run(BASE); }
      if (res.error) throw res.error;
      const people = (res.data ?? []) as unknown as Person[];
      const ids = (people ?? []).map((p) => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id,role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      const byUser = new Map<string, Set<string>>();
      for (const r of roles ?? []) byUser.set(r.user_id, (byUser.get(r.user_id) ?? new Set()).add(r.role));
      const { data: affs } = ids.length
        ? await supabase.from("affiliates").select("user_id,status").in("user_id", ids)
        : { data: [] as { user_id: string; status: string }[] };
      const affBy = new Map((affs ?? []).map((a) => [a.user_id, a.status]));
      const membershipBy = ids.length ? await getAdminMemberStatuses({ data: { userIds: ids } }) : {};
      return (people ?? []).map((p) => ({
        ...p,
        roles: byUser.get(p.id) ?? new Set<string>(),
        affiliate: affBy.get(p.id) ?? null,
        membership: membershipBy[p.id] ?? null,
        pendingApproval: hasApproval && p.approved_at == null,
      }));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, role, grant }: { userId: string; role: "admin" | "moderator"; grant: boolean }) => {
      const res = grant
        ? await supabase.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true })
        : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (res.error) throw res.error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin", "members"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const affiliate = useMutation({
    mutationFn: async ({ userId, name, status }: { userId: string; name: string | null; status: string | null }) => {
      const res = status === null
        ? await supabase.from("affiliates").insert({ user_id: userId, display_name: name })
        : await supabase.from("affiliates").update({ status: status === "active" ? "paused" : "active" }).eq("user_id", userId);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success("Affiliate updated");
      qc.invalidateQueries({ queryKey: ["admin", "members"] });
      qc.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ approved_at: new Date().toISOString() } as never).eq("id", userId).select("id").single();
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Member approved"); qc.invalidateQueries({ queryKey: ["admin", "members"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-10">
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search members by name" className="rounded-full pl-10" />
      </div>
      <ul className="mt-6 grid gap-3">
        {q.data?.length === 0 && <p className="text-muted-foreground">No members match that name.</p>}
        {q.data?.map((p) => {
          const isAdmin = p.roles.has("admin");
          const isMod = p.roles.has("moderator");
          const { paid, trial } = memberStatusIndicators(p.membership, p.trial_started_at);
          const self = p.id === me;
          return (
            <Card key={p.id}>
              <div className="flex items-start gap-4">
              <AdminMemberPhoto photoUrl={p.photo_url} name={p.display_name} />
              <div>
                <p className="font-serif text-xl text-foreground">{p.display_name || "Unnamed member"}{self && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}</p>
                <p className="text-sm text-muted-foreground">{[p.profession, p.location].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.pendingApproval && <span className="rounded-full bg-golden-tint px-3 py-0.5 text-xs text-golden-ink">Pending approval</span>}
                  {isAdmin && <span className="rounded-full bg-primary/15 px-3 py-0.5 text-xs text-primary">Admin</span>}
                  {isMod && <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">Moderator</span>}
                  {paid && <span className="rounded-full bg-sage-light px-3 py-0.5 text-xs text-foreground">Paid</span>}
                  {trial === "active" && <span className="rounded-full bg-accent px-3 py-0.5 text-xs text-foreground">7-day trial</span>}
                  {trial === "expired" && <span className="rounded-full bg-accent/40 px-3 py-0.5 text-xs text-muted-foreground">Trial ended</span>}
                  {p.affiliate === "active" && <span className="rounded-full bg-sage-light px-3 py-0.5 text-xs text-foreground">Affiliate</span>}
                  {suspendedIds?.has(p.id) && <span className="rounded-full bg-destructive/15 px-3 py-0.5 text-xs text-destructive">Suspended</span>}
                  {!isAdmin && !isMod && <span className="rounded-full bg-accent px-3 py-0.5 text-xs text-muted-foreground">Member</span>}
                </div>
              </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.pendingApproval && viewerIsAdmin && (
                  <Button size="sm" className="rounded-full" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>Approve</Button>
                )}
                <Button size="sm" variant={isMod ? "outline" : "default"} className="rounded-full" disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ userId: p.id, role: "moderator", grant: !isMod })}>
                  {isMod ? "Demote to member" : "Make moderator"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" disabled={toggle.isPending || (self && isAdmin)}
                  title={self && isAdmin ? "You can't remove your own admin role" : undefined}
                  onClick={() => confirm(isAdmin ? "Revoke admin?" : "Grant full admin access?") && toggle.mutate({ userId: p.id, role: "admin", grant: !isAdmin })}>
                  {isAdmin ? "Revoke admin" : "Grant admin"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" disabled={affiliate.isPending}
                  onClick={() => affiliate.mutate({ userId: p.id, name: p.display_name, status: p.affiliate })}>
                  {p.affiliate === "active" ? "Pause affiliate" : p.affiliate ? "Resume affiliate" : "Make affiliate"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdjusting(adjusting === p.id ? null : p.id)}>Adjust credits</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(editing === p.id ? null : p.id)}>Edit profile</Button>
                {!self && <AdminSuspendMember userId={p.id} suspended={Boolean(suspendedIds?.has(p.id))} />}
                {!self && <AdminDeleteMember userId={p.id} name={p.display_name} />}
              </div>
              {adjusting === p.id && <AdjustCredits userId={p.id} onDone={() => setAdjusting(null)} />}
              {editing === p.id && <AdminEditProfile userId={p.id} onDone={() => setEditing(null)} />}
            </Card>
          );
        })}
      </ul>
      <BlockedEmails />
    </section>
  );
}

function AdjustCredits({ userId, onDone }: { userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const delta = Number.parseInt(amount, 10);
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000) { toast.error("Enter a whole number between -1000 and 1000, not 0."); return; }
    if (!note.trim()) { toast.error("Please add a note — the member sees it in their history."); return; }
    setBusy(true);
    const { error } = await supabase.from("credit_ledger").insert({ user_id: userId, delta, reason: "manual_adjustment", reference_type: "admin", note: note.trim().slice(0, 300) });
    setBusy(false);
    if (error) { toast.error("The adjustment didn't save."); return; }
    toast.success(`${delta > 0 ? "+" : ""}${delta} credits recorded`);
    await Promise.all([qc.invalidateQueries({ queryKey: ["credits"] }), qc.invalidateQueries({ queryKey: ["ledger"] })]);
    onDone();
  }
  return (
    <form onSubmit={save} className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-4">
      <Input type="number" step={1} placeholder="+2 or -1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 rounded-full" />
      <Input placeholder="Note shown to the member" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="min-w-56 flex-1 rounded-full" />
      <Button type="submit" size="sm" className="rounded-full" disabled={busy}>Record</Button>
    </form>
  );
}

// ---------------- Houses & skills moderation ----------------
type Listing = { id: string; title: string; status: string; featured?: boolean; sub: string | null; owner: { display_name: string | null } | null };

function ListingsSection() {
  const qc = useQueryClient();
  const houses = useQuery({
    queryKey: ["admin", "houses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses")
        .select("id,title,status,featured,sub:location_text,owner:profiles!houses_owner_id_fkey(display_name)")
        .in("status", ["published", "archived"]).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });
  const skills = useQuery({
    queryKey: ["admin", "skills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skills")
        .select("id,title,status,sub:category,owner:profiles!skills_owner_id_fkey(display_name)")
        .in("status", ["published", "archived"]).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });
  const act = useMutation({
    mutationFn: async ({ table, id, status }: { table: "houses" | "skills"; id: string; status: "archived" | "published" }) => {
      const { error } = await supabase.from(table).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Listing updated"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const feature = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      const { error } = await supabase.from("houses").update({ featured }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.featured ? "Featured on Home" : "Removed from Home");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["home-featured"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const List = ({ table, icon: Icon, label, items }: { table: "houses" | "skills"; icon: typeof Home; label: string; items?: Listing[] | undefined }) => (
    <>
      <p className="section-label mt-10 flex items-center gap-2"><Icon className="size-4 text-primary" strokeWidth={1.5} /> {label}</p>
      <ul className="mt-4 grid gap-3">
        {items?.length === 0 && <p className="text-muted-foreground">Nothing listed yet.</p>}
        {items?.map((l) => (
          <Card key={l.id}>
            <div>
              <p className={cn("font-serif text-xl text-foreground", l.status === "archived" && "line-through opacity-60")}>{l.title}</p>
              <p className="text-sm text-muted-foreground">{[l.sub, l.owner?.display_name && `by ${l.owner.display_name}`].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
            {table === "houses" && l.status === "published" && (
              <Button size="sm" variant={l.featured ? "default" : "outline"} className="rounded-full" aria-pressed={!!l.featured}
                onClick={() => feature.mutate({ id: l.id, featured: !l.featured })}>
                <Star className="size-4" strokeWidth={1.5} fill={l.featured ? "currentColor" : "none"} aria-hidden />
                {l.featured ? "Featured on Home" : "Feature on Home"}
              </Button>
            )}
            {l.status === "archived" ? (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => act.mutate({ table, id: l.id, status: "published" })}>Restore</Button>
            ) : (
              <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => confirm("Unlist this for everyone?") && act.mutate({ table, id: l.id, status: "archived" })}>Unlist</Button>
            )}
            </div>
          </Card>
        ))}
      </ul>
    </>
  );

  return (
    <section className="mt-4">
      <p className="mt-6 text-sm text-muted-foreground">Members publish houses and skills directly. Unlist anything that doesn't belong. Featured homes show first on members' Home page.</p>
      <List table="houses" icon={Home} label="Houses" items={houses.data} />
      <List table="skills" icon={Sparkles} label="Skills" items={skills.data} />
    </section>
  );
}
