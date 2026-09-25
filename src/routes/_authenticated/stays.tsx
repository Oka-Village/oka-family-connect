import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { BedDouble, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_STATUS_LABELS, formatDay, isoDay } from "@/lib/houses";
import { sessionErrorMessage, signPaths } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/stays")({
  validateSearch: zodValidator(z.object({ tab: fallback(z.enum(["hosting", "trips"]), "trips").default("trips") })),
  head: () => ({
    meta: [
      { title: "Stays — Oka" },
      { name: "description", content: "Your stay requests and the guests you're hosting." },
      { property: "og:title", content: "Stays — Oka" },
      { property: "og:description", content: "Your stay requests and the guests you're hosting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaysPage,
});

type Booking = {
  id: string; house_id: string; guest_id: string; host_id: string; check_in: string; check_out: string;
  nights: number; message: string | null; status: string; created_at: string;
  house: { title: string } | null;
  guest: { display_name: string | null; photo_url: string | null } | null;
  host: { display_name: string | null; photo_url: string | null } | null;
};

function StaysPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: uid } = useCurrentUserId();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["stays", tab, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("id,house_id,guest_id,host_id,check_in,check_out,nights,message,status,created_at,house:houses(title),guest:profiles!bookings_guest_id_fkey(display_name,photo_url),host:profiles!bookings_host_id_fkey(display_name,photo_url)")
        .eq(tab === "hosting" ? "host_id" : "guest_id", uid!)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Booking[];
      const sign = await signPaths(rows.map((b) => (tab === "hosting" ? b.guest : b.host)?.photo_url));
      return rows.map((b) => ({ ...b, photo: sign((tab === "hosting" ? b.guest : b.host)?.photo_url) }));
    },
  });

  async function act(id: string, action: string) {
    const { error } = await supabase.rpc("update_booking", { _booking_id: id, _action: action });
    if (error) { toast.error(sessionErrorMessage(error)); return; }
    toast.success({ approve: "Stay approved", decline: "Request declined — credits returned", cancel: "Stay cancelled — credits returned", complete: "Stay complete — credits moved" }[action] ?? "Done");
    await Promise.all([qc.invalidateQueries({ queryKey: ["stays"] }), qc.invalidateQueries({ queryKey: ["credits"] }), qc.invalidateQueries({ queryKey: ["ledger"] }), qc.invalidateQueries({ queryKey: ["house-booked"] })]);
  }

  const today = isoDay(0);
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <p className="section-label">Stays</p>
      <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">Coming and going</h1>
      <div className="mt-8 flex gap-2">
        {(["trips", "hosting"] as const).map((t) => (
          <button key={t} type="button" onClick={() => void navigate({ search: { tab: t } })}
            className={cn("rounded-full border px-5 py-2 text-sm", tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary")}>
            {t === "trips" ? "My trips" : "Guests at my home"}
          </button>
        ))}
      </div>

      {q.isLoading || !uid ? (
        <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>
      ) : !q.data?.length ? (
        <EmptyState icon={BedDouble} label={tab === "trips" ? "No trips yet" : "No guests yet"}
          title={tab === "trips" ? "Where will you wake up next?" : "Your door is ready"}
          description={tab === "trips" ? "Find a home in Houses and send a request." : "When someone asks to stay, you'll see it here."} />
      ) : (
        <ul className="mt-8 grid gap-4">
          {q.data.map((b) => {
            const other = tab === "hosting" ? b.guest : b.host;
            return (
              <li key={b.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar src={b.photo} name={other?.display_name} className="size-11" />
                    <div>
                      <Link to="/houses/$houseId" params={{ houseId: b.house_id }} className="font-serif text-xl text-foreground hover:text-primary">{b.house?.title ?? "A home"}</Link>
                      <p className="text-sm text-muted-foreground">{tab === "hosting" ? "Guest" : "Host"}: {other?.display_name ?? "Oka member"}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs uppercase tracking-widest", b.status === "approved" || b.status === "completed" ? "bg-secondary text-secondary-foreground" : b.status === "pending" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                    {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </div>
                <p className="mt-4 text-sm text-foreground">{formatDay(b.check_in)} → {formatDay(b.check_out)} · {b.nights} night{b.nights === 1 ? "" : "s"} · {b.nights} credit{b.nights === 1 ? "" : "s"}</p>
                {b.message && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">“{b.message}”</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {tab === "hosting" && b.status === "pending" && <>
                    <Button size="sm" className="rounded-full" onClick={() => void act(b.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => void act(b.id, "decline")}>Decline</Button>
                  </>}
                  {tab === "hosting" && b.status === "approved" && <>
                    {b.check_in <= today
                      ? <Button size="sm" className="rounded-full" onClick={() => void act(b.id, "complete")}>Mark stay complete</Button>
                      : <span className="self-center text-xs text-muted-foreground">You can mark it complete from check-in day.</span>}
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => void act(b.id, "decline")}>Cancel stay</Button>
                  </>}
                  {tab === "trips" && (b.status === "pending" || b.status === "approved") && b.check_in > today &&
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => void act(b.id, "cancel")}>Cancel request</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
