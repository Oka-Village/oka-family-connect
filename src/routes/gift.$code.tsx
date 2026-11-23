import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, HeartHandshake, Home, Loader2, Sparkles } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { EmailAuthDialog } from "@/components/oka/email-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/google-sign-in";
import { saveInviteCode } from "@/lib/affiliates";
import { beginSignupFlow } from "@/lib/signup-flow.functions";
import { claimGift } from "@/lib/gift.functions";

export const Route = createFileRoute("/gift/$code")({
  head: () => ({
    meta: [
      { title: "A gift: two months in One World Family — Oka" },
      { name: "description", content: "Someone gifted you your first two months in One World Family: homes, skills and gatherings shared with credits instead of money." },
      { property: "og:title", content: "Your first two months in One World Family, a gift" },
      { property: "og:description", content: "Claim two free months of membership in a global chosen family. No card needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GiftPage,
});

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

function GiftPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const beginSignup = useServerFn(beginSignupFlow);
  const claim = useServerFn(claimGift);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ status: string; endsAt: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const info = useQuery({
    queryKey: ["invite", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("affiliate_invite_info", { _code: code });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
  });

  useEffect(() => {
    saveInviteCode(code);
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setSignedIn(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, [code]);

  async function join() {
    setBusy(true);
    try {
      await beginSignup();
      const res = await signInWithGoogle(`${window.location.origin}/gift/${code}`);
      if (!res.redirected) setBusy(false);
    } catch { setBusy(false); }
  }

  async function open() {
    setBusy(true); setError(null);
    try {
      const r = await claim({ data: { code } });
      setResult(r);
      await qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  const name = info.data?.inviter_name;
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8"><Wordmark /></header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-6 text-center">
        <Gift className="mx-auto size-10 text-primary" strokeWidth={1.5} />
        <p className="section-label mt-6">A gift for you</p>
        <h1 className="mt-6 text-4xl leading-tight text-foreground sm:text-5xl lg:text-6xl">
          {info.isLoading ? "…" : name ? `${name} gifted you your first two months` : "Your first two months, a gift"}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          One World Family is a global chosen family: people who open their homes, share what they know and gather, with credits instead of money. Two months of full membership, no card needed.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          {result?.status === "ok" ? (
            <>
              <p className="font-serif text-3xl text-foreground">Welcome to the family ╰(´︶`)╯♡</p>
              {result.endsAt && <p className="text-muted-foreground">Your gift is open until {fmt(result.endsAt)}.</p>}
              <Button asChild size="lg" className="mt-2 rounded-full px-10"><Link to="/onboarding">Start exploring</Link></Button>
            </>
          ) : result ? (
            <>
              <p className="text-muted-foreground">
                {result.status === "already_member" ? "You already have a membership, so there's nothing more to open." :
                 result.status === "self" ? "This is your own gift link. Share it with someone new." :
                 "This account has already received a gift or special access."}
              </p>
              <Button asChild size="lg" className="rounded-full px-10"><Link to="/events">Enter Oka</Link></Button>
            </>
          ) : signedIn ? (
            <Button size="lg" className="rounded-full px-10" onClick={() => void open()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Open my two months
            </Button>
          ) : signedIn === false ? (
            <>
              <Button size="lg" className="rounded-full px-10" onClick={() => void join()} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Claim with Google
              </Button>
              <EmailAuthDialog label="Claim with email" />
              <p className="text-sm text-muted-foreground">After signing in, tap “Open my two months”.</p>
            </>
          ) : null}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-20 grid gap-5 text-left sm:grid-cols-3">
          {[
            { icon: Home, t: "Homes", d: "Stay with family around the world, and host them in return." },
            { icon: Sparkles, t: "Skills", d: "Share an hour of what you love; learn from others." },
            { icon: HeartHandshake, t: "Gatherings", d: "Retreats, workshops and circles, online and in person." },
          ].map((x) => (
            <div key={x.t} className="surface-card p-6">
              <x.icon className="size-6 text-primary" strokeWidth={1.5} />
              <p className="mt-4 font-serif text-2xl text-foreground">{x.t}</p>
              <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
