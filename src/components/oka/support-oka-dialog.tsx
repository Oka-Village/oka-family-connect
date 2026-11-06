import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Infinity as InfinityIcon, Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFoundingCheckout } from "@/lib/stripe/founding.functions";
import { createMonthlyCheckout } from "@/lib/stripe/membership.functions";
import { startTrial } from "@/lib/trial.functions";
import { type MembershipKind } from "@/lib/membership";
import { TRIAL_DAYS } from "@/lib/onboarding-rules";
import { type OkaProfile } from "@/lib/profile";

export function SupportOkaDialog({ open, onProceed, trialStartedAt }: {
  open: boolean;
  onProceed: () => void;
  trialStartedAt: string | null;
}) {
  const [agreed, setAgreed] = useState(true);
  const [busy, setBusy] = useState<MembershipKind | "trial" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const founding = useServerFn(createFoundingCheckout);
  const monthly = useServerFn(createMonthlyCheckout);
  const trial = useServerFn(startTrial);

  async function pay(kind: MembershipKind) {
    if (!agreed || busy) return;
    setBusy(kind); setError(null);
    try {
      const result = await (kind === "founding" ? founding : monthly)({ data: { acceptedTerms: true, origin: window.location.origin } });
      if (result.status === "already") onProceed();
      else window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not be opened. Please try again.");
    } finally { setBusy(null); }
  }

  async function beginTrial() {
    if (busy || trialStartedAt) return;
    setBusy("trial"); setError(null);
    try {
      const { trial_started_at } = await trial();
      queryClient.setQueryData<OkaProfile | null>(["profile"], (current) =>
        current && trial_started_at ? { ...current, trial_started_at } : current,
      );
      onProceed();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Your trial could not be started. Please try again."); }
    finally { setBusy(null); }
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!next) onProceed(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl p-6 sm:p-8">
      <DialogHeader>
        <DialogTitle className="font-serif text-4xl font-normal tracking-normal">Support Oka</DialogTitle>
        <DialogDescription className="mt-2 leading-relaxed">Help our chosen family grow.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-2">
        <section className="flex flex-col">
          <InfinityIcon className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-3 font-serif text-2xl">Founding membership</h2>
          <p className="mt-3"><span className="font-serif text-4xl">$250</span><span className="ml-2 text-sm text-muted-foreground">one-time</span></p>
          <p className="mt-3 text-sm text-primary">Founding member deal - available until November 30.</p>
          <p className="mt-2 text-sm text-muted-foreground">Lifetime membership. No renewals.</p>
          <Button className="mt-5 rounded-full" disabled={!agreed || busy !== null} onClick={() => void pay("founding")}>
            {busy === "founding" && <Loader2 className="size-4 animate-spin" />}Choose founding membership
          </Button>
        </section>
        <section className="flex flex-col">
          <CalendarDays className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-3 font-serif text-2xl">Monthly membership</h2>
          <p className="mt-3"><span className="font-serif text-4xl">$29</span><span className="ml-2 text-sm text-muted-foreground">per month</span></p>
          <p className="mt-3 text-sm text-primary">Cancel anytime.</p>
          <Button className="mt-auto rounded-full" disabled={!agreed || busy !== null} onClick={() => void pay("monthly")}>
            {busy === "monthly" && <Loader2 className="size-4 animate-spin" />}Choose monthly membership
          </Button>
        </section>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Founding membership ends without a refund if Oka stops operating. You may request a refund within 14 days at liran@okavillage.com; after that, it is non-refundable except where required by law. Monthly membership is $29 USD, charged each month until cancelled. Payments are securely processed by Stripe.</p>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />
        <span>I agree to the membership terms above and the <Link to="/terms" target="_blank" className="underline underline-offset-4">Oka Terms of Service</Link>.</span>
      </label>
      <div className="border-t border-border pt-5">
        <Button variant="outline" className="w-full rounded-full" disabled={busy !== null || Boolean(trialStartedAt)} onClick={() => void beginTrial()}>
          {busy === "trial" ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4 text-primary" strokeWidth={1.5} />}
          {trialStartedAt ? "Your trial has already started" : `Start ${TRIAL_DAYS}-day free trial`}
        </Button>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">No card required. The {TRIAL_DAYS}-day trial is for adding content — events, houses, and skills. After {TRIAL_DAYS} days, a paid membership is required to keep using Oka.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}