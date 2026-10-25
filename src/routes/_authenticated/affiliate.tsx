import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Gift, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { useCurrentUserId, useRoles } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/affiliates";
import { inviteUrl } from "@/lib/affiliate-share";
import { signPaths } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/affiliate")({
  head: () => ({
    meta: [
      { title: "Invite & earn — Oka" },
      { name: "description", content: "Invite people into the Oka family. When someone you invite pays for membership, your affiliate share is tracked as your affiliate credit." },
      { property: "og:title", content: "Invite & earn — Oka" },
      { property: "og:description", content: "Invite people into the Oka family. When someone you invite pays for membership, your affiliate share is tracked as your affiliate credit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AffiliatePage,
});

type Stat = { referred_user_id: string; display_name: string | null; photo_url: string | null; joined_at: string; membership_tier: string; paid_cents: number; test_cents: number; earned_cents: number };

function AffiliatePage() {
  const { data: uid } = useCurrentUserId();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const aff = useQuery({
    queryKey: ["affiliate", "me", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("affiliates").select("id,invite_code,status,commission_pct").eq("user_id", uid!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const stats = useQuery({
    queryKey: ["affiliate", "stats", aff.data?.id],
    enabled: !!aff.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("affiliate_referral_stats", {});
      if (error) throw error;
      const rows = (data ?? []) as Stat[];
      const sign = await signPaths(rows.map((r) => r.photo_url));
      return rows.map((r) => ({ ...r, photo: sign(r.photo_url) }));
    },
  });

  async function activate() {
    setBusy(true);
    const { error } = await supabase.rpc("activate_affiliate");
    setBusy(false);
    if (error) { toast.error("That didn't work. Please try again."); return; }
    await qc.invalidateQueries({ queryKey: ["affiliate"] });
  }

  const link = aff.data ? inviteUrl(aff.data.invite_code) : "";
  /** The rate the backend actually credits: the affiliate's stored commission_pct. */
  const sharePct = aff.data ? Number(aff.data.commission_pct) : null;
  const rows = stats.data ?? [];
  const earned = rows.reduce((s, r) => s + Number(r.earned_cents), 0);
  const tests = rows.reduce((s, r) => s + Number(r.test_cents), 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <p className="section-label">Invite & earn</p>
      <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">Grow the family</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Share your personal link. {sharePct != null ? `When someone you invite pays for membership, ${sharePct}% of what they paid is tracked as your affiliate credit.` : "When someone you invite pays for membership, your affiliate share is tracked as your affiliate credit."}
      </p>
      <ProgramTotals />

      {aff.isLoading || !uid ? (
        <Loader2 className="mt-10 size-6 animate-spin text-primary" strokeWidth={1.5} />
      ) : !aff.data ? (
        <div className="surface-card mt-10 p-8">
          <Gift className="size-7 text-primary" strokeWidth={1.5} />
          <p className="mt-4 font-serif text-3xl text-foreground">Get your invitation link</p>
          <p className="mt-2 text-muted-foreground">It takes one click. You can share it anywhere.</p>
          <Button className="mt-6 rounded-full px-8" onClick={() => void activate()} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Activate Invite & earn</Button>
        </div>
      ) : (
        <>
          {aff.data.status === "paused" && <p className="mt-8 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">Your invite link is paused by the Oka team. Reach out if you think this is a mistake.</p>}
          <div className="surface-card mt-8 p-6">
            <p className="section-label">Your link</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-5 py-2.5 text-sm text-secondary-foreground">{link}</code>
              <Button className="rounded-full" onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check className="size-4" strokeWidth={1.5} /> : <Copy className="size-4" strokeWidth={1.5} />}{copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Invited" value={String(rows.length)} />
            <Stat label="Your share" value={sharePct != null ? `${sharePct}%` : "—"} />
            <Stat label="Earned" value={formatCents(earned)} />
          </div>
          {tests > 0 && <p className="mt-3 text-sm text-muted-foreground">Test payments ({formatCents(tests)}) are shown for setup only and not counted in earnings.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Earnings = {sharePct != null ? `${sharePct}%` : "your share"} of the membership payments of the members you invited, as recorded by Oka. Payouts begin once payments go live.</p>

          <p className="section-label mt-12">People you invited</p>
          {rows.length === 0 ? (
            <div className="surface-card mt-4 flex items-center gap-3 p-6 text-muted-foreground"><Users className="size-5 text-primary" strokeWidth={1.5} />No one yet — your first invitation is one message away.</div>
          ) : (
            <ul className="surface-card mt-4 divide-y divide-border">
              {rows.map((r) => (
                <li key={r.referred_user_id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar src={r.photo} name={r.display_name} className="size-10" />
                    <div>
                      <p className="text-foreground">{r.display_name ?? "New member"}</p>
                      <p className="text-xs text-muted-foreground">Joined {new Date(r.joined_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={r.paid_cents > 0 || r.membership_tier === "full" ? "rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-widest text-secondary-foreground" : "rounded-full bg-muted px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground"}>
                      {r.paid_cents > 0 || r.membership_tier === "full" ? "Full member" : "Free"}
                    </span>
                    {r.paid_cents > 0 && (
                      <span className="font-serif text-xl text-foreground">
                        paid {formatCents(Number(r.paid_cents))} · credit {formatCents(Number(r.earned_cents))}
                      </span>
                    )}
                    {r.test_cents > 0 && <span className="text-xs text-muted-foreground">test {formatCents(Number(r.test_cents))}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-6">
      <p className="section-label">{label}</p>
      <p className="mt-3 font-serif text-4xl text-foreground">{value}</p>
    </div>
  );
}

/** Admin-only: totals across every affiliate. Uses the admin branch of affiliate_referral_stats. */
function ProgramTotals() {
  const roles = useRoles();
  const isAdmin = Boolean(roles.data?.isAdmin);
  const q = useQuery({
    queryKey: ["affiliate", "program-totals"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: affs, error } = await supabase.from("affiliates").select("id");
      if (error) throw error;
      const all = await Promise.all((affs ?? []).map(async (a) => {
        const { data, error: e } = await supabase.rpc("affiliate_referral_stats", { _affiliate_id: a.id });
        if (e) throw e;
        return (data ?? []) as Stat[];
      }));
      const rows = all.flat();
      return {
        affiliates: affs?.length ?? 0,
        members: new Set(rows.map((r) => r.referred_user_id)).size,
        paid: rows.reduce((s, r) => s + Number(r.paid_cents), 0),
        earned: rows.reduce((s, r) => s + Number(r.earned_cents), 0),
      };
    },
  });
  if (!isAdmin) return null;
  return (
    <section className="surface-card mt-8 p-6" aria-label="Program totals">
      <p className="section-label">All affiliates · Admin only</p>
      {q.isLoading ? <Loader2 className="mt-4 size-5 animate-spin text-primary" strokeWidth={1.5} /> : q.isError ? (
        <p className="mt-3 text-sm text-destructive">Couldn't load totals. <button type="button" className="underline" onClick={() => void q.refetch()}>Try again</button></p>
      ) : q.data && (
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Stat label="Affiliates" value={String(q.data.affiliates)} />
          <Stat label="Members joined" value={String(q.data.members)} />
          <Stat label="Paid memberships" value={formatCents(q.data.paid)} />
          <Stat label="Affiliates earned" value={formatCents(q.data.earned)} />
        </div>
      )}
    </section>
  );
}
