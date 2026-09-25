import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { CalendarClock, Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_STATUS_LABELS, sessionErrorMessage, signPaths, useCredits } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sessions")({
  validateSearch: zodValidator(z.object({ tab: fallback(z.string(), "incoming").default("incoming") })),
  head: () => ({
    meta: [
      { title: "Sessions — Oka" },
      { name: "description", content: "Your skill session requests, given and received." },
      { property: "og:title", content: "Sessions — Oka" },
      { property: "og:description", content: "Your skill session requests, given and received." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionsPage,
});

type Person = { id: string; display_name: string | null; photo_url: string | null };
type SessionRow = {
  id: string; status: string; proposed_at: string; message: string | null; created_at: string; completed_at: string | null;
  requester_id: string; host_id: string;
  skill: { id: string; title: string } | null;
  requester: Person | null; host: Person | null;
};

const STATUS_TINT: Record<string, string> = {
  pending: "bg-golden/25 text-foreground",
  accepted: "bg-secondary text-secondary-foreground",
  completed: "bg-sage/25 text-foreground",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function SessionsPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: uid } = useCurrentUserId();
  const credits = useCredits();
  const qc = useQueryClient();
  const incoming = tab !== "outgoing";

  const q = useQuery({
    queryKey: ["sessions", uid, incoming ? "incoming" : "outgoing"],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_session_requests")
        .select("id,status,proposed_at,message,created_at,completed_at,requester_id,host_id,skill:skills(id,title),requester:profiles!skill_session_requests_requester_id_fkey(id,display_name,photo_url),host:profiles!skill_session_requests_host_id_fkey(id,display_name,photo_url)")
        .eq(incoming ? "host_id" : "requester_id", uid!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as SessionRow[];
      const sign = await signPaths(rows.map((r) => (incoming ? r.requester : r.host)?.photo_url));
      return rows.map((r) => ({ ...r, photo: sign((incoming ? r.requester : r.host)?.photo_url) }));
    },
  });

  async function act(id: string, action: "accept" | "decline" | "cancel" | "complete") {
    const { error } = await supabase.rpc("update_skill_session", { _request_id: id, _action: action });
    if (error) { toast.error(sessionErrorMessage(error)); return; }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["sessions"] }),
      qc.invalidateQueries({ queryKey: ["credits"] }),
      qc.invalidateQueries({ queryKey: ["ledger"] }),
    ]);
    toast.success(
      action === "complete" ? "Session complete — a credit has moved with gratitude" :
      action === "accept" ? "Request accepted" : action === "decline" ? "Request declined" : "Request cancelled",
    );
  }

  const tabCls = (on: boolean) => cn("flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors", on ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <p className="section-label">Sessions</p>
      <h1 className="mt-4 text-4xl text-foreground">Hours shared, hours received</h1>
      <p className="mt-3 text-muted-foreground">
        {credits.data ? `Balance ${credits.data.balance} · ${credits.data.reserved} set aside for open requests · ${credits.data.available} available` : "…"}
      </p>

      <div className="mt-8 flex gap-2">
        <button type="button" className={tabCls(incoming)} onClick={() => void navigate({ search: { tab: "incoming" } })}><Inbox className="size-4" strokeWidth={1.5} />Requests to me</button>
        <button type="button" className={tabCls(!incoming)} onClick={() => void navigate({ search: { tab: "outgoing" } })}><Send className="size-4" strokeWidth={1.5} />My requests</button>
      </div>

      {q.isLoading || !uid ? (
        <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={incoming ? Inbox : Send}
          label="Sessions"
          title={incoming ? "No requests yet" : "You haven't asked for a session yet"}
          description={incoming ? "When someone asks for one of your offerings, it will appear here." : "Browse the skills of the family and ask for an hour together."}
        />
      ) : (
        <ul className="mt-8 space-y-4">
          {q.data.map((r) => {
            const other = incoming ? r.requester : r.host;
            return (
              <li key={r.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar src={r.photo} name={other?.display_name} className="size-11" />
                    <div>
                      <p className="text-sm text-muted-foreground">{incoming ? "From" : "With"} {other?.display_name ?? "Oka member"}</p>
                      {r.skill ? (
                        <Link to="/skills/$skillId" params={{ skillId: r.skill.id }} className="font-serif text-xl text-foreground hover:text-primary">{r.skill.title}</Link>
                      ) : <span className="font-serif text-xl">A skill session</span>}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs uppercase tracking-widest", STATUS_TINT[r.status])}>{SESSION_STATUS_LABELS[r.status] ?? r.status}</span>
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-foreground">
                  <CalendarClock className="size-4 text-primary" strokeWidth={1.5} />
                  {new Date(r.proposed_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
                </p>
                {r.message && <p className="mt-3 whitespace-pre-line rounded-2xl bg-secondary/40 px-4 py-3 text-sm text-foreground">{r.message}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {incoming && r.status === "pending" && (
                    <>
                      <Button size="sm" className="rounded-full" onClick={() => void act(r.id, "accept")}>Accept</Button>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => void act(r.id, "decline")}>Decline</Button>
                    </>
                  )}
                  {incoming && r.status === "accepted" && (
                    <>
                      <Button size="sm" className="rounded-full" onClick={() => void act(r.id, "complete")}>Mark as completed</Button>
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void act(r.id, "decline")}>Decline</Button>
                    </>
                  )}
                  {!incoming && (r.status === "pending" || r.status === "accepted") && (
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => void act(r.id, "cancel")}>Cancel request</Button>
                  )}
                  {r.status === "completed" && (
                    <p className="text-sm text-muted-foreground">{incoming ? "You earned 1 credit." : "1 credit exchanged."}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
