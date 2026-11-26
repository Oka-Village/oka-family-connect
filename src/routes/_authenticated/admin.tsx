import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarDays, Download, Mail, Palette, Gift, Home, Plus, Search, ShieldCheck, Sparkles, Star, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventBelongsToMember } from "@/lib/event-publication";
import { useCurrentUserId, useRoles } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { exportAdminMembersCsv, getAdminMemberStatuses, searchAdminMembers } from "@/lib/admin-members.functions";
import { deleteEvent } from "@/lib/event-admin";
import {
  countExceptionReminders,
  notifyEventStatus,
  sendExceptionReminders,
  testSendExceptionReminder,
} from "@/lib/event-notifications.functions";
import { useServerFn } from "@tanstack/react-start";
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
import { AdminTrialDialog } from "@/components/oka/admin-trial-dialog";
import { TRIAL_ACCESS_LAUNCH_AT, trialEndDate } from "@/lib/trial-access";
import { listPendingPods, publishPod } from "@/lib/pods/pods.functions";

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
      {active === "events" && (
        <>
          <PodsPendingSection />
          <EventsSection />
        </>
      )}
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

function PodsPendingSection() {
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ["admin", "pending-pods"], queryFn: () => listPendingPods() });
  const publish = useMutation({
    mutationFn: (podId: string) => publishPod({ data: { podId } }),
    onSuccess: () => {
      toast.success("Pod published");
      void qc.invalidateQueries({ queryKey: ["admin", "pending-pods"] });
      void qc.invalidateQueries({ queryKey: ["pods-published"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = pending.data?.pods ?? [];
  if (pending.isLoading || rows.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl text-foreground">Pods awaiting review</h2>
      <p className="mt-1 text-sm text-muted-foreground">Facilitator submissions stay off the member list until you publish.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((pod) => (
          <Card key={pod.id}>
            <div>
              <p className="font-medium text-foreground">{pod.title}</p>
              <p className="text-sm text-muted-foreground">
                {pod.host_name ?? "Facilitator"} · {new Date(pod.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/pods/$podId" params={{ podId: pod.id }}>
                  Open
                </Link>
              </Button>
              <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate(pod.id)}>
                Publish
              </Button>
            </div>
          </Card>
        ))}
      </ul>
    </section>
  );
}

// ---------------- Events ----------------
const EVENT_STATES = [
  ["pending_approval", "Awaiting review"], ["published", "Published"],
  ["unpublished", "Unpublished"], ["draft", "Drafts"],
  ["rejected", "Rejected"], ["cancelled", "Cancelled"], ["completed", "Completed"],
] as const;

async function loadAllAdminEvents() {
  const rows: EventRow[] = [];
  for (let offset = 0; ; offset += 400) {
    const { data, error } = await supabase.from("events").select(EVENT_SELECT)
      .order("starts_at").order("id").range(offset, offset + 399);
    if (error) throw error;
    rows.push(...(data ?? []) as unknown as EventRow[]);
    if ((data?.length ?? 0) < 400) return rows;
  }
}

function ReminderStat({ label, value, hint, small }: { label: string; value: string; hint: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-cream-deep p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-1 leading-tight text-foreground", small ? "break-words font-sans text-sm" : "font-number text-xl")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EventsSection() {
  const qc = useQueryClient();
  const [member, setMember] = useState("all");
  const [state, setState] = useState("all");
  const [memberSearch, setMemberSearch] = useState("");
  const changeStatus = useServerFn(notifyEventStatus);
  const countException = useServerFn(countExceptionReminders);
  const sendException = useServerFn(sendExceptionReminders);
  const testException = useServerFn(testSendExceptionReminder);
  const events = useQuery({ queryKey: ["admin", "all-events"], queryFn: loadAllAdminEvents });
  const members = useQuery({
    queryKey: ["admin", "event-members"],
    queryFn: async () => {
      const rows: { id: string; display_name: string | null }[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("profiles").select("id,display_name").order("display_name").order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) return rows;
      }
    },
  });
  const exceptionAudience = useQuery({
    queryKey: ["admin", "exception-reminder-audience"],
    queryFn: () => countException(),
  });
  const act = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "published" | "unpublished" | "rejected" | "cancelled" }) => {
      for (const id of ids) await changeStatus({ data: { eventId: id, status } });
    },
    onSuccess: () => { toast.success("Event updated"); void qc.invalidateQueries(); },
    onError: (e: Error) => { toast.error(e.message); void qc.invalidateQueries(); },
  });
  const del = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await deleteEvent(id); },
    onSuccess: () => { toast.success("Event deleted"); void qc.invalidateQueries(); },
    onError: (e: Error) => { toast.error(e.message); void qc.invalidateQueries(); },
  });
  const massBlast = useMutation({
    mutationFn: () => sendException({ data: { confirm: true } }),
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} of ${result.recipients} reminders`);
      void qc.invalidateQueries({ queryKey: ["admin", "exception-reminder-audience"] });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });
  const testBlast = useMutation({
    mutationFn: () => testException(),
    onSuccess: (result) => {
      toast.success(result.skipped ? "Test reminder was already in your inbox — check for an earlier copy." : "Test reminder sent to your own inbox.");
    },
    onError: (e: Error) => { toast.error(e.message); },
  });
  const busy = act.isPending || del.isPending;
  const filtered = (events.data ?? []).filter((e) => eventBelongsToMember(e, member === "all" ? "" : member) && (state === "all" || e.status === state));
  function update(item: GroupedEvent<EventRow>, status: "published" | "unpublished" | "rejected" | "cancelled") {
    const action = status === "published" ? "Publish" : status === "unpublished" ? "Unpublish" : status === "rejected" ? "Reject" : "Cancel";
    const extra = status === "unpublished" ? " Approval and RSVPs stay saved; the host can edit and publish again." : "";
    if (confirm(`${action} ${item.count > 1 ? `all ${item.count} dates of ` : ""}"${item.event.title}"?${extra}`)) act.mutate({ ids: item.ids, status });
  }
  function confirmMassSend() {
    const recipients = exceptionAudience.data?.recipients ?? 0;
    if (!confirm(`Send Liran's one-time RSVP reminder to ${recipients} going member${recipients === 1 ? "" : "s"} across ${exceptionAudience.data?.events ?? 0} upcoming event${(exceptionAudience.data?.events ?? 0) === 1 ? "" : "s"}? Already-sent people are skipped.`)) return;
    massBlast.mutate();
  }
  return (
    <section className="mt-10">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="section-label flex items-center gap-2"><Mail className="size-4 text-primary" strokeWidth={1.5} /> Email campaign · One-time RSVP reminder</p>
        <h3 className="mt-3 font-serif text-2xl text-foreground">Send RSVP reminder emails to event attendees</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Sends Liran's personalized reminder to every member who RSVP'd "Going" for an upcoming gathering. Each email
          carries the event title, the host's name, a direct link, and the start time in three major timezones.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReminderStat
            label="Audience"
            value={exceptionAudience.isPending ? "Counting…" : exceptionAudience.isError ? "Unavailable" : `${exceptionAudience.data.recipients}`}
            hint="going RSVPs in the send list"
          />
          <ReminderStat
            label="Coverage"
            value={exceptionAudience.isPending ? "Counting…" : exceptionAudience.isError ? "Unavailable" : `${exceptionAudience.data.events}`}
            hint="upcoming events covered"
          />
          <ReminderStat label="Safety" value="No duplicates" hint="members already sent are skipped" />
          <ReminderStat
            label="From"
            value={exceptionAudience.data?.from ? exceptionAudience.data.from.replace(/^.*<|>$/g, "") : "Not configured"}
            hint="sender address on every email"
            small
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" disabled={testBlast.isPending} onClick={() => testBlast.mutate()}>
            {testBlast.isPending ? "Sending test…" : "Send test email to me"}
          </Button>
          <Button className="rounded-full" disabled={massBlast.isPending || !(exceptionAudience.data?.recipients)} onClick={confirmMassSend}>
            {massBlast.isPending ? "Sending…" : "Send emails to all RSVP attendees"}
          </Button>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <div className="min-w-0 sm:w-64">
            <label className="mb-2 block text-sm text-muted-foreground">Member</label>
            <Input aria-label="Find event member" placeholder="Find member by name" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="mb-2 rounded-full" />
            <Select value={member} onValueChange={setMember}>
              <SelectTrigger aria-label="Filter events by member" className="rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All members</SelectItem>
                {members.data?.filter((p) => p.id === member || (p.display_name ?? "Unnamed member").toLowerCase().includes(memberSearch.toLowerCase())).map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name || "Unnamed member"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 sm:w-52">
            <label className="mb-2 block text-sm text-muted-foreground">Status</label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger aria-label="Filter events by status" className="rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem>{EVENT_STATES.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button asChild className="rounded-full"><Link to="/events/new"><Plus className="size-4" strokeWidth={1.5} /> Create event</Link></Button>
      </div>
      {events.isPending && <p className="mt-6 text-muted-foreground">Loading events…</p>}
      {(events.isError || members.isError) && <p className="mt-6 text-destructive">Couldn't load events or members. <Button variant="link" onClick={() => { void events.refetch(); void members.refetch(); }}>Try again</Button></p>}
      {events.isSuccess && filtered.length === 0 && <p className="mt-6 text-muted-foreground">No events match these filters.</p>}
      {EVENT_STATES.map(([status, label]) => {
        const list = groupEventSeries(filtered.filter((e) => e.status === status), "upcoming");
        if (!list.length) return null;
        return <div key={status}>
          <p className="section-label mt-10">{label}</p>
          <ul className="mt-4 grid gap-4">{list.map((item) => {
            const e = item.event;
            return <Card key={e.id}>
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{TYPE_LABELS[e.event_type]}</p>
                <Link to="/events/$eventId" params={{ eventId: e.id }} className="mt-1 block break-words font-serif text-xl text-foreground hover:underline">{e.title}</Link>
                <p className="mt-1 text-sm text-muted-foreground">{formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)} · by {hostName(e.host)}</p>
                {item.label && <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/events/edit/$eventId" params={{ eventId: e.id }}>Edit</Link></Button>
                {status === "pending_approval" && <>
                  <Button size="sm" disabled={busy} onClick={() => update(item, "published")}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => update(item, "rejected")}>Reject</Button>
                </>}
                {status === "published" && <>
                  {e.format === "virtual" && <CopyJoinLink slug={e.join_slug} />}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => update(item, "unpublished")}>Unpublish</Button>
                </>}
                {status === "unpublished" && <Button size="sm" disabled={busy} onClick={() => update(item, "published")}>Publish</Button>}
                {["published", "unpublished"].includes(status) && <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => update(item, "cancelled")}>Cancel</Button>}
                <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => {
                  if (confirm(`Delete ${item.count > 1 ? `all ${item.count} dates of ` : ""}"${e.title}" for good, including sign-ups and private locations? This cannot be undone.`)) del.mutate(item.ids);
                }}><Trash2 className="size-4" strokeWidth={1.5} /> Delete</Button>
              </div>
            </Card>;
          })}</ul>
        </div>;
      })}
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
  const [accessing, setAccessing] = useState<string | null>(null);
  const [shown, setShown] = useState(25);
  const [exporting, setExporting] = useState(false);
  const exportMembers = useServerFn(exportAdminMembersCsv);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const { csv, count } = await exportMembers();
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `members-list-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count} members`);
    } catch (e) { toast.error((e as Error).message); } finally { setExporting(false); }
  };
  const { data: suspendedIds } = useSuspendedIds();
  const q = useQuery({
    queryKey: ["admin", "members", term, shown],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const BASE = "id,display_name,location,profession,photo_url,trial_started_at,trial_ends_at,complimentary_access";
      const found = await searchAdminMembers({ data: { term: term.trim(), offset: 0, limit: 100 } });
      const all = found.members.slice(0, shown);
      // Fetch in batches of 100 when more are shown.
      for (let off = 100; off < shown && off < found.total; off += 100) {
        const more = await searchAdminMembers({ data: { term: term.trim(), offset: off, limit: Math.min(100, shown - off) } });
        all.push(...more.members);
      }
      const order = all.map((m) => m.id);
      const emailBy = new Map(all.map((m) => [m.id, m.email]));
      const run = (cols: string) => supabase.from("profiles").select(cols).in("id", order.length ? order : ["00000000-0000-0000-0000-000000000000"]);
      type Person = { id: string; display_name: string | null; location: string | null; profession: string | null; photo_url: string | null; trial_started_at: string | null; trial_ends_at: string | null; complimentary_access: boolean; approved_at?: string | null };
      // approved_at may not exist yet; fall back to today's query if it errors.
      let hasApproval = true;
      let res = await run(`${BASE},approved_at`);
      if (res.error) { hasApproval = false; res = await run(BASE); }
      if (res.error) throw res.error;
      const fetched = new Map(((res.data ?? []) as unknown as Person[]).map((p) => [p.id, p]));
      const people = order.map((id) => fetched.get(id)).filter((p): p is Person => Boolean(p));
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
      const membershipBy: Record<string, Awaited<ReturnType<typeof getAdminMemberStatuses>>[string]> = {};
      for (let i = 0; i < ids.length; i += 100) Object.assign(membershipBy, await getAdminMemberStatuses({ data: { userIds: ids.slice(i, i + 100) } }));
      const members = people.map((p) => ({
        ...p,
        email: emailBy.get(p.id) ?? null,
        roles: byUser.get(p.id) ?? new Set<string>(),
        affiliate: affBy.get(p.id) ?? null,
        membership: membershipBy[p.id] ?? null,
        pendingApproval: hasApproval && p.approved_at == null,
      }));
      return { members, total: found.total };
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
          <Input value={term} onChange={(e) => { setTerm(e.target.value); setShown(25); }} placeholder="Search members by name or email" className="rounded-full pl-10" />
        </div>
        <Button variant="outline" className="rounded-full" disabled={exporting} onClick={exportCsv}><Download className="size-4 text-primary" strokeWidth={1.5} /> {exporting ? "Exporting…" : "Export members (.csv)"}</Button>
      </div>
      <ul className="mt-6 grid gap-3">
        {q.data && <p className="text-sm text-muted-foreground">Showing {q.data.members.length} of {q.data.total} members</p>}
        {q.data?.members.length === 0 && <p className="text-muted-foreground">No members match that name or email.</p>}
        {q.data?.members.map((p) => {
          const isAdmin = p.roles.has("admin");
          const isMod = p.roles.has("moderator");
          const now = new Date();
          const { paid, trial } = memberStatusIndicators(p.membership, p.trial_started_at, now, p.trial_ends_at);
          const trialEnd = trialEndDate(p.trial_started_at, p.trial_ends_at);
          const trialPaused = !p.trial_ends_at && Boolean(p.trial_started_at) && now.getTime() < Date.parse(TRIAL_ACCESS_LAUNCH_AT);
          const self = p.id === me;
          return (
            <Card key={p.id}>
              <div className="flex items-start gap-4">
              <AdminMemberPhoto photoUrl={p.photo_url} name={p.display_name} />
              <div>
                <p className="font-serif text-xl text-foreground">{p.display_name || "Unnamed member"}{self && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}</p>
                {p.email && <p className="text-sm text-muted-foreground">{p.email}</p>}
                <p className="text-sm text-muted-foreground">{[p.profession, p.location].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.pendingApproval && <span className="rounded-full bg-golden-tint px-3 py-0.5 text-xs text-golden-ink">Pending approval</span>}
                  {isAdmin && <span className="rounded-full bg-primary/15 px-3 py-0.5 text-xs text-primary">Admin</span>}
                  {isMod && <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">Moderator</span>}
                  {paid && <span className="rounded-full bg-sage-light px-3 py-0.5 text-xs text-foreground">Paid</span>}
                  {p.complimentary_access && <span className="rounded-full bg-sage-light px-3 py-0.5 text-xs text-foreground">Complimentary access</span>}
                  {trial === "active" && <span className="rounded-full bg-accent px-3 py-0.5 text-xs text-foreground">{trialPaused ? "Trial paused until Dec 1" : trialEnd ? `Trial until ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(trialEnd)}` : "Trial active"}</span>}
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
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAccessing(p.id)}>Trial & access</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdjusting(adjusting === p.id ? null : p.id)}>Adjust credits</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(editing === p.id ? null : p.id)}>Edit profile</Button>
                {!self && <AdminSuspendMember userId={p.id} suspended={Boolean(suspendedIds?.has(p.id))} />}
                {!self && <AdminDeleteMember userId={p.id} name={p.display_name} />}
              </div>
              {adjusting === p.id && <AdjustCredits userId={p.id} onDone={() => setAdjusting(null)} />}
              {editing === p.id && <AdminEditProfile userId={p.id} onDone={() => setEditing(null)} />}
              {accessing === p.id && <AdminTrialDialog userId={p.id} name={p.display_name} trialStartedAt={p.trial_started_at} trialEndsAt={p.trial_ends_at} complimentaryAccess={p.complimentary_access} open onOpenChange={(open) => { if (!open) setAccessing(null); }} />}
            </Card>
          );
        })}
      </ul>
      {q.data && q.data.members.length < q.data.total && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="rounded-full" disabled={q.isFetching} onClick={() => setShown((n) => n + 25)}>
            {q.isFetching ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
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
