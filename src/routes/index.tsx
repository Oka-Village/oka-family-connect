import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Home, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Wordmark } from "@/components/oka/wordmark";
import { EmailAuthDialog } from "@/components/oka/email-auth";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { takeReturnTo } from "@/lib/join-link";
import { useServerFn } from "@tanstack/react-start";
import { beginSignupFlow } from "@/lib/signup-flow.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oka — social infrastructure for a global chosen family" },
      {
        name: "description",
        content:
          "Stay in each other's homes and share skills without money. One credit is one night's stay or one hour of service.",
      },
      { property: "og:title", content: "Oka — social infrastructure for a global chosen family" },
      {
        property: "og:description",
        content:
          "Stay in each other's homes and share skills without money. One credit is one night's stay or one hour of service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: Home,
    label: "Houses",
    text: "Open your home, and be welcomed into others. No money changes hands.",
  },
  {
    icon: Sparkles,
    label: "Skills",
    text: "Offer what you love doing. Receive what you need. One hour for one credit.",
  },
  {
    icon: Heart,
    label: "Family",
    text: "A gathering of people choosing each other, across borders and time zones.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const beginSignup = useServerFn(beginSignupFlow);
  const [signingIn, setSigningIn] = useState(false);

  // Someone already signed in never needs the welcome page. The OAuth return
  // can finish just after this mounts (full-page redirect mode exchanges the
  // code asynchronously), so also forward any SIGNED_IN that lands later.
  useEffect(() => {
    let active = true;
    const leave = () => {
      if (!active) return;
      active = false;
      const back = takeReturnTo();
      if (back) window.location.replace(back);
      else navigate({ to: "/home", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) leave();
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") leave();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    await beginSignup();
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    if (result.error) {
      setSigningIn(false);
      toast.error("We couldn't open Google sign-in. Please try again.");
      return;
    }
    if (result.redirected) return;

    navigate({ to: "/home", replace: true });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
        <Wordmark />
        <p className="section-label hidden sm:block">One World Family</p>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-10 pb-16 text-center sm:pt-20">
        <p className="section-label">A home everywhere</p>
        <h1 className="mt-6 text-5xl leading-[1.1] text-foreground sm:text-6xl">
          Social infrastructure for a global chosen family
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Oka is a circle of people who host each other and share their gifts in a credit economy.
          One credit is one night&apos;s stay, or one hour of service.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <Button size="lg" className="rounded-full px-8" onClick={handleGoogleSignIn} disabled={signingIn}>
            {signingIn ? "Opening Google…" : "Join the family"}
          </Button>
          <Button
            variant="ghost"
            className="rounded-full px-8"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
          >
            {signingIn ? "Opening Google…" : "Already a member? Sign in"}
          </Button>
          <EmailAuthDialog label="Sign up or sign in with email" />
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {PILLARS.map((pillar) => (
          <article key={pillar.label} className="surface-card p-8">
            <pillar.icon className="size-6 text-primary" strokeWidth={1.5} />
            <p className="section-label mt-6">{pillar.label}</p>
            <p className="mt-3 text-base leading-relaxed text-foreground">{pillar.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
