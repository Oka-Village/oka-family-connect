import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Infinity as InfinityIcon, CalendarDays, Loader2, LogOut } from "lucide-react";
import { Wordmark } from "@/components/oka/wordmark";
import { StepProgress } from "@/components/oka/onboarding-visual/step-progress";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { isFullMember } from "@/lib/member-access";
import { afterMembershipPayment, hasPaidMembership, isPaymentExempt, type MembershipKind } from "@/lib/membership";
import { type OkaProfile } from "@/lib/profile";
import { createFoundingCheckout } from "@/lib/stripe/founding.functions";
import { createMonthlyCheckout, confirmMembershipCheckout } from "@/lib/stripe/membership.functions";
import { startTrial } from "@/lib/trial.functions";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { saveReturnTo } from "@/lib/join-link";
import { beginSignupFlow } from "@/lib/signup-flow.functions";
import { clearIntent, readIntent, resolveIntent, saveIntent } from "@/lib/membership-intent";
import { chosenPlanToStart, planClickAction, termsPromptText } from "@/lib/membership-flow";

export const Route = createFileRoute("/membership")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s["session_id"] === "string" ? s["session_id"] : undefined,
    kind: s["kind"] === "monthly" ? "monthly" as const : s["kind"] === "founding" ? "founding" as const : undefined,
  }),
  head: () => ({ meta: [
    { title: "Choose your membership — Oka" },
    { name: "description", content: "Choose Oka founding membership for $250 once, or monthly membership for $29 per month." },
    { property: "og:title", content: "Your place in Oka — Membership" },
    { property: "og:description", content: "Founding membership or monthly membership in a global chosen family." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MembershipPage,
});

function MembershipPage() {
  const { session_id, kind: kindParam } = Route.useSearch();
  const kind: MembershipKind = kindParam ?? "founding";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useProfile();
  const roles = useRoles();
  const membership = useMembership(profile.data?.id);
  const [agreed, setAgreed] = useState(true);
  const [needTerms, setNeedTerms] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<MembershipKind | "confirm" | "signin" | "trial" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const founding = useServerFn(createFoundingCheckout);
  const monthly = useServerFn(createMonthlyCheckout);
  const confirm = useServerFn(confirmMembershipCheckout);
  const beginSignup = useServerFn(beginSignupFlow);
  const trial = useServerFn(startTrial);
  const full = roles.data?.isStaff === true || isFullMember(profile.data, new Date(), hasPaidMembership(membership.data));
  const exempt = isPaymentExempt(profile.data, roles.data?.isStaff === true);
  async function finish() {
    await qc.invalidateQueries({ queryKey: ["membership"] });
    await qc.invalidateQueries({ queryKey: ["profile"] });
    void navigate({ to: afterMembershipPayment(full), replace: true });
  }
  useEffect(() => {
    if (profile.data && !session_id && (exempt || hasPaidMembership(membership.data))) void navigate({ to: afterMembershipPayment(full), replace: true });
  }, [profile.data, membership.data, session_id, full, exempt, navigate]);
  useEffect(() => {
    if (!profile.data || !session_id) return;
    let active = true;
    setBusy("confirm"); setError(null);
    void confirm({ data: { sessionId: session_id, kind } }).then(async (result) => {
      if (!active) return;
      if (result.paid) { clearIntent(); await finish(); } else setPending(true);
    }).catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(null); });
    return () => { active = false; };
  }, [profile.data?.id, session_id, kind, confirm]);
  // Resume a plan chosen before the Google sign-in round-trip.
  const [selected, setSelected] = useState<MembershipKind | null>(kind);
  const resumed = useRef(false);
  useEffect(() => {
    const intent = resolveIntent(kindParam, readIntent());
    if (!intent) return;
    setSelected(intent.kind);
    if (intent.agreed) setAgreed(true);
  }, [kindParam]);
  useEffect(() => {
    if (resumed.current || session_id || !profile.data || membership.isPending || roles.isPending) return;
    if (exempt || hasPaidMembership(membership.data)) { clearIntent(); return; }
    const intent = resolveIntent(kindParam, readIntent());
    if (!intent?.agreed) return;
    resumed.current = true;
    void pay(intent.kind);
  }, [profile.data, membership.isPending, membership.data, roles.isPending, exempt, session_id, kindParam]);
  async function signInGoogle() {
    setError(null); setBusy("signin");
    if (selected) saveIntent({ kind: selected, agreed });
    try {
      await beginSignup();
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/membership` });
      if (result.error) throw new Error("We couldn’t open Google sign-in. Please try again.");
      if (result.redirected) return;
      void qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Google sign-in could not be opened. Please try again."); }
    finally { setBusy(null); }
  }
  async function pay(choice: MembershipKind) {
    setError(null); setBusy(choice); setSelected(choice);
    try {
      if (!profile.data) {
        saveReturnTo(`/membership?kind=${choice}`);
        saveIntent({ kind: choice, agreed });
        await beginSignup();
        const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/membership?kind=${choice}` });
        if (result.error) throw new Error("We couldn’t open Google sign-in. Please try again.");
        return;
      }
      clearIntent();
      const result = await (choice === "founding" ? founding : monthly)({ data: { acceptedTerms: true, origin: window.location.origin } });
      if (result.status === "already") await finish(); else window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Checkout could not be opened. Please try again."); }
    finally { setBusy(null); }
  }
  // Plan choice comes first: a click without terms acceptance only points at the checkbox.
  function choosePlan(choice: MembershipKind) {
    setSelected(choice);
    if (planClickAction(agreed) === "ask-terms") {
      setNeedTerms(true);
      requestAnimationFrame(() => termsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    void pay(choice);
  }
  function onTermsChange(checked: boolean) {
    setAgreed(checked);
    if (!checked) return;
    setNeedTerms(false);
    const next = chosenPlanToStart(selected, true);
    if (next) void pay(next);
  }
  async function beginTrial() {
    if (busy || profile.data?.trial_started_at) return;
    setError(null); setBusy("trial");
    try {
      const { trial_started_at } = await trial();
      qc.setQueryData<OkaProfile | null>(["profile"], (current) =>
        current && trial_started_at ? { ...current, trial_started_at } : current,
      );
      void navigate({ to: "/welcome", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your trial could not be started. Please try again.");
    } finally { setBusy(null); }
  }
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }
  return <main className="min-h-screen bg-background px-6 pb-16 text-foreground">
    <header className="mx-auto flex max-w-[1240px] items-center justify-between py-8"><Wordmark className="h-7" />{profile.data && <Button variant="ghost" onClick={signOut} className="rounded-full"><LogOut className="size-4 text-primary" strokeWidth={1.5} />Sign out</Button>}</header>
    <section className="mx-auto max-w-[1240px]">
      <div className="flex items-center py-2"><StepProgress filled={3} label="3 / 3" /></div>
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <p className="section-label">Membership</p>
          <h1 className="mt-4 max-w-md font-serif text-4xl leading-tight sm:text-5xl">Choose how you&apos;d like to <span className="italic text-sage">join.</span></h1>
          <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">Your membership keeps the family growing. Not ready yet? Start with 7 days free, no card needed.</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Full access opens on December 1, 2026. Until then, you can share your skills, offer your home, add events and invite friends.</p>
          <div className="mt-8 flex max-w-md items-center gap-4 rounded-3xl bg-sage-light/50 p-5">
            <span className="shrink-0 whitespace-nowrap font-kaomoji text-lg text-sage-ink" aria-hidden="true">(´︶`)っ✿</span>
            <p className="text-sm leading-relaxed text-sage-ink">In your free week you can add events, homes and skills.</p>
          </div>
        </div>
        <div>
          <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Membership plans">
            <PlanCard
              selected={selected === "founding"}
              onSelect={() => setSelected("founding")}
              icon={<InfinityIcon className="size-6 text-sage" strokeWidth={1.5} aria-hidden />}
              title="Founding"
              price="$250"
              cadence="one time"
              badge="Founding member deal - available until November 30."
              detail="Yours for life. No renewals. For our first members."
            />
            <PlanCard
              selected={selected === "monthly"}
              onSelect={() => setSelected("monthly")}
              icon={<CalendarDays className="size-6 text-sage" strokeWidth={1.5} aria-hidden />}
              title="Monthly"
              price="$29"
              cadence="per month"
              badge="Cancel anytime."
              detail="Charged in USD each month."
            />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Founding membership ends without a refund if Oka stops operating. You may request a refund within 14 days at liran@okavillage.com; after that, it is non-refundable except where required by law. Monthly membership is $29 USD, charged each month until cancelled. Payments are securely processed by Stripe.</p>
          <div ref={termsRef} className={`mt-5 -mx-3 rounded-xl px-3 py-3 transition-all duration-300 ${needTerms ? "bg-terracotta-tint ring-2 ring-primary" : ""}`}>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={agreed} onChange={(e) => onTermsChange(e.target.checked)} aria-describedby={needTerms ? "terms-notice" : undefined} className="mt-1 size-[22px] shrink-0 accent-sage" /><span>I agree to the membership terms above and the <Link to="/terms" target="_blank" className="underline underline-offset-4">Oka Terms of Service</Link>.</span></label>
            {needTerms && <p id="terms-notice" role="alert" className="mt-2 text-sm font-medium text-primary">{termsPromptText(selected ?? kind)}</p>}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button className="h-14 flex-1 rounded-full bg-sage text-cream hover:bg-sage/90" disabled={busy !== null || !selected} onClick={() => selected && choosePlan(selected)}>
              {(busy === "founding" || busy === "monthly") && <Loader2 className="size-4 animate-spin" />}
              Continue to payment
            </Button>
            <Button variant="outline" className="h-14 flex-1 rounded-full border-sage text-sage hover:bg-sage-light/40 hover:text-sage" disabled={busy !== null || !profile.data || Boolean(profile.data.trial_started_at)} onClick={() => void beginTrial()}>
              {busy === "trial" && <Loader2 className="size-4 animate-spin" />}
              {profile.data?.trial_started_at ? "Your trial has already started" : "Start 7 days free"}
            </Button>
          </div>
          {!profile.data && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button variant="outline" className="rounded-full px-6" disabled={busy !== null} onClick={() => void signInGoogle()}>
                {busy === "signin" && <Loader2 className="size-4 animate-spin" />}Sign in with Google
              </Button>
              <p className="text-xs text-muted-foreground">Sign in first if you already have a membership, or to save your choice.</p>
            </div>
          )}
          {busy === "confirm" && <p role="status" className="mt-5 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Confirming your membership…</p>}
          {pending && <p role="status" className="mt-5 text-muted-foreground">Your payment is still pending. Refresh this page once it has completed.</p>}
          {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
          <nav aria-label="Membership information" className="mt-8 flex justify-center gap-6 text-sm text-muted-foreground"><Link to="/privacy" className="underline underline-offset-4">Privacy</Link><Link to="/terms" className="underline underline-offset-4">Terms</Link></nav>
        </div>
      </div>
    </section>
  </main>;
}

function PlanCard({ selected, onSelect, icon, title, price, cadence, badge, detail }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; price: string; cadence: string; badge: string; detail: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`surface-card flex w-full flex-col items-start gap-3 p-6 text-left ${selected ? "border-sage ring-2 ring-sage" : ""}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex items-center gap-2">{icon}<span className="font-serif text-2xl">{title}</span></span>
        <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-sage bg-sage text-cream" : "border-sand"}`} aria-hidden="true">{selected ? "✓" : ""}</span>
      </span>
      <span className="block"><span className="font-number text-4xl font-light">{price}</span><span className="ml-2 text-muted-foreground">{cadence}</span></span>
      <span className="block text-sm text-sage">{badge}</span>
      <span className="block text-sm leading-relaxed text-muted-foreground">{detail}</span>
    </button>
  );
}