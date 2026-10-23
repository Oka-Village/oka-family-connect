import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe2, HeartHandshake, Home, Loader2, Sparkles } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { saveInviteCode } from "@/lib/affiliates";
import { useServerFn } from "@tanstack/react-start";
import { beginSignupFlow } from "@/lib/signup-flow.functions";

export const Route = createFileRoute("/invite/$code")({
  head: () => ({
    meta: [
      { title: "You're invited to Oka — a global chosen family" },
      { name: "description", content: "A friend invited you to Oka: stay in each other's homes and share skills, with credits instead of money." },
      { property: "og:title", content: "You're invited to Oka" },
      { property: "og:description", content: "A friend invited you to join a global chosen family — home stays and skill sharing, no money involved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const beginSignup = useServerFn(beginSignupFlow);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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
  }, [code]);

  async function join() {
    setBusy(true);
    saveInviteCode(code);
    await beginSignup();
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) setBusy(false);
    else if (!res.redirected) void navigate({ to: "/events" });
  }

  const name = info.data?.inviter_name;
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8"><Wordmark /></header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 text-center">
        <p className="section-label">An invitation</p>
        <h1 className="mt-6 text-5xl leading-tight text-foreground lg:text-6xl">
          {info.isLoading ? "…" : name ? `${name} invited you into the family` : "You're invited into the family"}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Oka is a One World Family: people who open their homes, share what they know and gather — with credits instead of money. One credit is one night's stay or one hour of service.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          {signedIn ? (
            <>
              <Button asChild size="lg" className="rounded-full px-10"><Link to="/events">Enter Oka</Link></Button>
              <p className="text-sm text-muted-foreground">You're already part of the family — welcome back.</p>
            </>
          ) : (
            <Button size="lg" className="rounded-full px-10" onClick={() => void join()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Join with Google
            </Button>
          )}
          {!info.isLoading && !name && <p className="text-sm text-muted-foreground">This invitation link isn't active, but you're still very welcome.</p>}
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
        <p className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Globe2 className="size-4 text-primary" strokeWidth={1.5} />No money between members. Ever.</p>
      </main>
    </div>
  );
}
