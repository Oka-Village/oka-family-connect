import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/affiliates";

type Aff = { id: string; invite_code: string; status: string; commission_pct: number; created_at: string; owner: { display_name: string | null } | null };
type Stat = { referred_user_id: string; display_name: string | null; paid_cents: number; test_cents: number; earned_cents: number };

/** Admin: list affiliates, pause/resume, set commission %, and record TEST payments while Stripe isn't wired. */
export function AffiliatesSection() {
  const q = useQuery({
    queryKey: ["admin", "affiliates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("affiliates")
        .select("id,invite_code,status,commission_pct,created_at,owner:profiles!affiliates_user_id_fkey(display_name)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Aff[];
    },
  });
  return (
    <section className="mt-10">
      <p className="text-sm text-muted-foreground">Earnings = commission % × paid membership payments of each affiliate's referrals. Test payments are shown apart and never counted.</p>
      <ul className="mt-6 grid gap-3">
        {q.data?.length === 0 && <p className="text-muted-foreground">No affiliates yet.</p>}
        {q.data?.map((a) => <AffiliateRow key={a.id} a={a} />)}
      </ul>
    </section>
  );
}

function AffiliateRow({ a }: { a: Aff }) {
  const qc = useQueryClient();
  const [pct, setPct] = useState(String(a.commission_pct));
  const [open, setOpen] = useState(false);
  const stats = useQuery({
    queryKey: ["affiliate", "stats", a.id, "admin"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("affiliate_referral_stats", { _affiliate_id: a.id });
      if (error) throw error;
      return (data ?? []) as Stat[];
    },
  });

  async function update(patch: { status?: string; commission_pct?: number }) {
    const { error } = await supabase.from("affiliates").update(patch).eq("id", a.id);
    if (error) { toast.error("That didn't save."); return; }
    toast.success("Affiliate updated");
    await qc.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    await qc.invalidateQueries({ queryKey: ["affiliate"] });
  }

  async function testPayment(userId: string) {
    const { error } = await supabase.from("payments").insert({
      user_id: userId, amount_cents: 99900, currency: "usd", purpose: "membership_annual", status: "paid",
      metadata: { test: "true", note: "Admin test entry — Stripe not wired" },
    });
    if (error) { toast.error("Test payment didn't save."); return; }
    toast.success("Test payment of $999 recorded");
    await qc.invalidateQueries({ queryKey: ["affiliate"] });
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-serif text-xl text-foreground">{a.owner?.display_name ?? "Member"}</p>
          <p className="text-sm text-muted-foreground">Code {a.invite_code} · {a.status === "active" ? "Active" : "Paused"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="number" min={0} max={100} step={0.5} value={pct} onChange={(e) => setPct(e.target.value)} className="w-24 rounded-full" aria-label="Commission percent" />
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => {
            const n = Number(pct);
            if (!Number.isFinite(n) || n < 0 || n > 100) { toast.error("Commission must be 0–100%."); return; }
            void update({ commission_pct: n });
          }}>Set %</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => void update({ status: a.status === "active" ? "paused" : "active" })}>
            {a.status === "active" ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(!open)}>{open ? "Hide referrals" : "Referrals"}</Button>
        </div>
      </div>
      {open && (
        <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
          {stats.data?.length === 0 && <p className="text-muted-foreground">No referrals yet.</p>}
          {stats.data?.map((r) => (
            <li key={r.referred_user_id} className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-foreground">{r.display_name ?? "New member"}</span>
              <span className="text-muted-foreground">paid {formatCents(Number(r.paid_cents))} · earned {formatCents(Number(r.earned_cents))}{r.test_cents > 0 ? ` · test ${formatCents(Number(r.test_cents))}` : ""}</span>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void testPayment(r.referred_user_id)}>Record test payment</Button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
