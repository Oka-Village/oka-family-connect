import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Infinity as InfinityIcon, Loader2, Sparkles } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { saveReturnTo } from "@/lib/join-link";
import { confirmFoundingCheckout, createFoundingCheckout } from "@/lib/stripe/founding.functions";

export const Route = createFileRoute("/founding")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s["session_id"] === "string" ? s["session_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Become a Founding Member — Oka · One World Family" },
      { name: "description", content: "Join Oka as a founding member: lifetime membership for a single payment of $250." },
      { property: "og:title", content: "Become a Founding Member of Oka" },
      { property: "og:description", content: "One payment of $250. Membership for life in a global chosen family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoundingPage,
});

const TERMS = [
  "Founding membership is a one-time payment of $250 (USD). There are no renewals and no further membership fees.",
  "It gives one person full Oka membership for as long as the Oka platform operates. It cannot be transferred or resold.",
  "Oka may decide at any time to stop operating. If that happens, lifetime memberships end and are not refunded.",
  "Membership does not buy credits. Credits are still earned by hosting and sharing, have no cash value, and money never passes between members.",
  "You may request a full refund within 14 days of payment by writing to liran@okavillage.com. After that, the payment is non-refundable except where the law requires.",
  "Founding membership follows the Oka Terms of Service. If your account is removed for breaking them, the membership ends without refund.",
  "Payment is processed securely by Stripe. Oka never sees or stores your card details.",
];

const PERKS = [
  "Full membership for life — never renew",
  "Founding member recognition in the community",
  "Everything full members unlock: homes, sessions, events, Pods",
];

function FoundingPage() {
  const { session_id } = Route.useSearch();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"paid" | "pending" | null>(null);
  const startCheckout = useServerFn(createFoundingCheckout);
  const confirm = useServerFn(confirmFoundingCheckout);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    if (!session_id || !signedIn) return;
    confirm({ data: { sessionId: session_id } })
      .then((r) => setDone(r.paid ? "paid" : "pending"))
      .catch((e: Error) => setError(e.message));
  }, [session_id, signedIn, confirm]);

  async function signIn() {
    saveReturnTo("/founding");
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  }

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const r = await startCheckout({ data: { acceptedTerms: true, origin: window.location.origin } });
      if (r.status === "already") setDone("paid");
      else window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-8">
        <Link to="/" aria-label="Oka home"><Wordmark className="h-7" /></Link>
        <p className="section-label hidden sm:block">One World Family</p>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-20">
        <p className="section-label">Founding members</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          Be part of the beginning.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          The first people to join help shape what Oka becomes. One payment, and your place in the family is kept for life.
        </p>

        <div className="surface-card mt-10 p-6 sm:p-8">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-5xl text-foreground">$250</span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <InfinityIcon className="size-4 text-primary" strokeWidth={1.5} aria-hidden /> once, lifetime membership
            </span>
          </div>
          <ul className="mt-6 flex flex-col gap-3">
            {PERKS.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />{p}
              </li>
            ))}
          </ul>
        </div>

        {done === "paid" ? (
          <div role="status" className="surface-card mt-8 p-6 sm:p-8 text-center">
            <Sparkles className="mx-auto size-6 text-primary" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 font-serif text-3xl text-foreground">Welcome, founding member.</h2>
            <p className="mt-3 text-muted-foreground">Your lifetime membership is active.</p>
            <Button asChild className="mt-6 rounded-full"><Link to="/home">Go to Home</Link></Button>
          </div>
        ) : done === "pending" ? (
          <p role="status" className="mt-8 text-muted-foreground">
            Your payment hasn't completed yet. If you finished paying, refresh this page in a moment.
          </p>
        ) : session_id && signedIn ? (
          <p role="status" className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming your payment…
          </p>
        ) : (
          <section aria-labelledby="terms" className="mt-12">
            <h2 id="terms" className="font-serif text-[26px] text-foreground">Terms and conditions</h2>
            <ol className="mt-4 flex flex-col gap-3">
              {TERMS.map((t, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-[1.7] text-muted-foreground">
                  <span className="tabular-nums text-[var(--color-brown-label)]">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>

            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-sand p-4">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 size-4 accent-[var(--color-terracotta)]"
              />
              <span className="text-[15px] text-foreground">
                I have read and agree to the founding membership terms above and the{" "}
                <Link to="/terms" className="underline underline-offset-4" target="_blank">Oka Terms of Service</Link>.
              </span>
            </label>

            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

            <div className="mt-6">
              {signedIn === false ? (
                <Button onClick={signIn} disabled={!agreed} className="rounded-full px-8">
                  Sign in with Google to continue
                </Button>
              ) : (
                <Button onClick={pay} disabled={!agreed || busy || signedIn === null} className="rounded-full px-8">
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Pay $250 and become a founding member
                </Button>
              )}
              {!agreed && <p className="mt-3 text-sm text-muted-foreground">Tick the box to continue.</p>}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
