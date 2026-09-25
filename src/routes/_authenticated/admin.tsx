import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/oka/empty-state";
import { Button } from "@/components/ui/button";
import { useIsStaff } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { setEventStatus } from "@/lib/event-admin";
import { EVENT_SELECT, TYPE_LABELS, formatEventDate, formatEventTime, hostName, type EventRow } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Oka" },
      { name: "description", content: "Review proposed events and manage the Oka schedule." },
      { property: "og:title", content: "Admin — Oka" },
      { property: "og:description", content: "Review proposed events and manage the Oka schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

async function load(statuses: string[], upcomingOnly: boolean) {
  let q = supabase.from("events").select(EVENT_SELECT).in("status", statuses).order("starts_at").limit(100);
  if (upcomingOnly) q = q.gte("starts_at", new Date().toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as EventRow[];
}

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsStaff();
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ["admin", "pending"], queryFn: () => load(["pending_approval"], false), enabled: !!isAdmin });
  const live = useQuery({ queryKey: ["admin", "live"], queryFn: () => load(["published"], true), enabled: !!isAdmin });
  const act = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "published" | "rejected" | "cancelled" }) => setEventStatus(id, status),
    onSuccess: () => { toast.success("Event updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!isAdmin) {
    return <EmptyState icon={ShieldCheck} label="Admin" title="This space is for admins" description="If you think you should have access, reach out to the Oka team." />;
  }

  const Row = ({ e, children }: { e: EventRow; children: React.ReactNode }) => (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{TYPE_LABELS[e.event_type]}</p>
        <Link to="/events/$eventId" params={{ eventId: e.id }} className="mt-1 block text-xl text-foreground hover:underline" style={{ fontFamily: "var(--font-serif)" }}>
          {e.title}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)} · by {hostName(e.host)}
          {e.capacity ? ` · ${e.going_count}/${e.capacity} going` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/events/edit/$eventId" params={{ eventId: e.id }}>Edit</Link>
        </Button>
        {children}
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="mt-3 text-4xl text-foreground">Tend the schedule</h1>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/events/new"><Plus className="size-4" strokeWidth={1.5} /> Create event</Link>
        </Button>
      </div>

      <p className="section-label mt-12">Awaiting review</p>
      <ul className="mt-4 grid gap-4">
        {pending.data?.length === 0 && <p className="text-muted-foreground">Nothing waiting — all caught up.</p>}
        {pending.data?.map((e) => (
          <Row key={e.id} e={e}>
            <Button size="sm" className="rounded-full" onClick={() => act.mutate({ id: e.id, status: "published" })}>Approve</Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => act.mutate({ id: e.id, status: "rejected" })}>Reject</Button>
          </Row>
        ))}
      </ul>

      <p className="section-label mt-12">Upcoming published</p>
      <ul className="mt-4 grid gap-4">
        {live.data?.length === 0 && <p className="text-muted-foreground">No upcoming events yet.</p>}
        {live.data?.map((e) => (
          <Row key={e.id} e={e}>
            <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => confirm("Cancel this event for everyone?") && act.mutate({ id: e.id, status: "cancelled" })}>
              Cancel
            </Button>
          </Row>
        ))}
      </ul>
    </div>
  );
}
