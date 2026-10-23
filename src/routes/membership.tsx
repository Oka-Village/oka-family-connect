import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Infinity as InfinityIcon, CalendarDays, Loader2, LogOut } from "lucide-react";
import { GoogleBrandmark } from "@/components/oka/google-brandmark";
import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { isFullMember } from "@/lib/member-access";
import { afterMembershipPayment, hasPaidMembership, isPaymentExempt, type MembershipKind } from "@/lib/membership";
import { createFoundingCheckout } from "@/lib/stripe/founding.functions";
import { createMonthlyCheckout, confirmMembershipCheckout } from "@/lib/stripe/membership.functions";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { saveReturnTo } from "@/lib/join-link";
import { beginSignupFlow } from "@/lib/signup-flow.functions";
import { clearIntent, readIntent, resolveIntent, saveIntent } from "@/lib/membership-intent";

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
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<MembershipKind | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const founding = useServerFn(createFoundingCheckout);
  const monthly = useServerFn(createMonthlyCheckout);
  const confirm = useServerFn(confirmMembershipCheckout);
  const beginSignup = useServerFn(beginSignupFlow);
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
  const [selected, setSelected] = useState<MembershipKind | null>(null);
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
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }
  return <main className="min-h-screen bg-background px-6 pb-16">
    <header className="mx-auto flex max-w-[980px] items-center justify-between py-8"><Wordmark className="h-7" />{profile.data && <Button variant="ghost" onClick={signOut} className="rounded-full"><LogOut className="size-4 text-primary" strokeWidth={1.5} />Sign out</Button>}</header>
    <section className="mx-auto max-w-[980px] pt-10 sm:pt-16">
      <p className="section-label text-center">Your place in the family</p>
      <h1 className="mt-4 text-center font-serif text-4xl text-foreground sm:text-5xl">Choose your Oka membership</h1>
      <p className="mx-auto mt-5 max-w-xl text-center leading-relaxed text-muted-foreground">One family, two ways to join. Full access opens on December 1, 2026. Until then, you can share your skills, offer your home, add events and invite friends.</p>
      <div className="mt-10 grid items-stretch gap-6 md:grid-cols-2">
        <article className={`surface-card flex flex-col p-7 sm:p-8 ${selected === "founding" ? "ring-2 ring-primary" : ""}`}>
          <InfinityIcon className="size-7 text-primary" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-5 font-serif text-3xl">Founding membership</h2>
          <p className="mt-5"><span className="font-serif text-5xl">$250</span><span className="ml-2 text-muted-foreground">one-time</span></p>
          <p className="mt-4 text-sm text-primary">Founding member deal - available until November 15.</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">Lifetime membership. No renewals.</p>
          <Button className="mt-8 w-full rounded-full" disabled={!agreed || busy !== null} onClick={() => void pay("founding")}>{busy === "founding" && <Loader2 className="size-4 animate-spin" />}Choose founding membership</Button>
        </article>
        <article className={`surface-card flex flex-col p-7 sm:p-8 ${selected === "monthly" ? "ring-2 ring-primary" : ""}`}>
          <CalendarDays className="size-7 text-primary" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-5 font-serif text-3xl">Oka membership</h2>
          <p className="mt-5"><span className="font-serif text-5xl">$29</span><span className="ml-2 text-muted-foreground">per month</span></p>
          <p className="mt-4 text-sm text-primary">Monthly membership · Cancel anytime.</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">Your membership renews monthly until you cancel.</p>
          <Button className="mt-auto w-full rounded-full translate-y-0" disabled={!agreed || busy !== null} onClick={() => void pay("monthly")}>{busy === "monthly" && <Loader2 className="size-4 animate-spin" />}Choose monthly membership</Button>
        </article>
      </div>
      <div className="mx-auto mt-8 max-w-2xl">
        <p className="text-sm leading-relaxed text-muted-foreground">Founding membership ends without a refund if Oka stops operating. You may request a refund within 14 days at liran@okavillage.com; after that, it is non-refundable except where required by law. Monthly membership is $29 USD, charged each month until cancelled. Payments are securely processed by Stripe.</p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" /><span>I agree to the membership terms above and the <Link to="/terms" target="_blank" className="underline underline-offset-4">Oka Terms of Service</Link>.</span></label>
        {!profile.data && <p className="mt-4 text-sm text-muted-foreground">Continue with Google before choosing your membership.</p>}
        {busy === "confirm" && <p role="status" className="mt-5 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Confirming your membership…</p>}
        {pending && <p role="status" className="mt-5 text-muted-foreground">Your payment is still pending. Refresh this page once it has completed.</p>}
        {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
        <nav aria-label="Membership information" className="mt-8 flex justify-center gap-6 text-sm text-muted-foreground"><Link to="/privacy" className="underline underline-offset-4">Privacy</Link><Link to="/terms" className="underline underline-offset-4">Terms</Link></nav>
      </div>
    </section>
  </main>;
}