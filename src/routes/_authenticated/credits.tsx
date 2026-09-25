import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Loader2 } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Credits — Oka" },
      { name: "description", content: "Your Oka credits: one credit is one night's stay or one hour of service." },
      { property: "og:title", content: "Credits — Oka" },
      { property: "og:description", content: "Your Oka credits: one credit is one night's stay or one hour of service." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreditsPage,
});

const REASON_LABELS: Record<string, string> = {
  skill_session_earn: "Skill session given",
  skill_session_spend: "Skill session received",
  hosting_night: "Night hosted",
  pod_completion: "Pod completed",
  profile_completion: "Profile completed",
  workshop_hosting: "Workshop hosted",
  booking_lock: "Stay reserved",
  booking_spend: "Stay",
  booking_refund: "Stay refunded",
  manual_adjustment: "Adjustment",
};

function CreditsPage() {
  const credits = useCredits();
  const { data: uid } = useCurrentUserId();
  const ledger = useQuery({
    queryKey: ["ledger", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("id,delta,reason,note,created_at")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <p className="section-label">Credits</p>
      <h1 className="mt-4 text-4xl text-foreground">Your credits</h1>
      <p className="mt-3 text-muted-foreground">One credit is one night's stay or one hour of service. Your balance always follows from your history below.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["Balance", credits.data?.balance],
          ["Set aside", credits.data?.reserved],
          ["Available", credits.data?.available],
        ].map(([label, v]) => (
          <div key={label as string} className="surface-card p-6">
            <p className="section-label">{label}</p>
            <p className="mt-3 font-serif text-5xl text-foreground">{credits.isLoading ? "…" : (v as number | undefined) ?? 0}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">"Set aside" covers session requests that are still open. <Link to="/sessions" className="text-primary hover:underline">See sessions</Link></p>

      <p className="section-label mt-12">History</p>
      {ledger.isLoading ? (
        <Loader2 className="mt-6 size-6 animate-spin text-primary" strokeWidth={1.5} />
      ) : !ledger.data?.length ? (
        <div className="surface-card mt-4 flex items-center gap-3 p-6 text-muted-foreground">
          <Coins className="size-5 text-primary" strokeWidth={1.5} />Nothing yet — your first hour shared will appear here.
        </div>
      ) : (
        <ul className="surface-card mt-4 divide-y divide-border">
          {ledger.data.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p className="text-foreground">{REASON_LABELS[e.reason] ?? e.reason}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{e.note ? ` · ${e.note}` : ""}</p>
              </div>
              <span className={cn("font-serif text-2xl", e.delta > 0 ? "text-sage" : "text-primary")}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
