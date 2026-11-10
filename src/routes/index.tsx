import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FamilyCircle } from "@/components/oka/onboarding-visual/family-circle";
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
      { title: "Oka — A One World Family" },
      {
        name: "description",
        content:
          "Generosity, kindness and reciprocity are the currency here. We gather live, share our skills and open our homes to each other.",
      },
      { property: "og:title", content: "Oka — A One World Family" },
      {
        property: "og:description",
        content:
          "Generosity, kindness and reciprocity are the currency here. We gather live, share our skills and open our homes to each other.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

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
    <main className="flex min-h-screen flex-col bg-sage text-cream md:bg-background md:text-foreground">
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-6 py-7 md:px-10">
        <div className="flex items-center gap-3">
          <Wordmark className="h-5 brightness-0 invert md:h-7 md:brightness-100 md:invert-0" />
          <span className="hidden h-5 w-px bg-sand md:block" aria-hidden="true" />
          <span className="font-serif text-base md:text-xl">One World Family</span>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-full border-transparent bg-transparent px-4 text-cream hover:bg-cream/10 hover:text-cream md:border-sand md:bg-transparent md:px-6 md:text-foreground md:hover:bg-accent md:hover:text-foreground"
          onClick={handleGoogleSignIn}
          disabled={signingIn}
        >
          {signingIn ? "Opening…" : "Sign in"}
        </Button>
      </header>

      <section className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-10 px-6 pb-12 md:flex-row md:items-center md:gap-16 md:px-10 md:pb-16">
        <div className="order-2 flex w-full flex-col md:order-1 md:w-[520px] md:shrink-0">
          <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-cream md:text-terracotta">A seat is saved for you</p>
          <h1 className="mt-4 font-serif text-5xl leading-[0.98] text-cream md:mt-5 md:text-7xl md:text-foreground">A One World Family</h1>
          <p className="mt-3 font-serif text-2xl italic text-golden md:mt-4 md:text-4xl md:text-sage">Built on trust and connection.</p>
          <p className="mt-6 hidden max-w-[480px] text-lg leading-relaxed text-muted-foreground md:block">
            Generosity, kindness and reciprocity are the currency here. We gather live, share our skills and open our homes to each other.
          </p>
          <div className="mt-auto flex flex-col items-start gap-4 pt-10 md:mt-11 md:pt-0">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Button
                className="h-14 rounded-full bg-golden px-8 text-base font-semibold text-brown hover:bg-golden/90 md:bg-sage md:text-cream md:hover:bg-sage/90"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
              >
                {signingIn ? "Opening Google…" : "Join the family"}
              </Button>
              <p className="text-sm text-cream/80 md:text-muted-foreground">
                Free for <span className="font-number font-light">7</span> days · members only
              </p>
            </div>
            <EmailAuthDialog label="Sign up or sign in with email" />
          </div>
        </div>
        <div className="order-1 flex flex-1 justify-center md:order-2">
          <FamilyCircle />
        </div>
      </section>
    </main>
  );
}
