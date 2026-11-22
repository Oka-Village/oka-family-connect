import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/oka/app-shell";
import { OpenAccountingBooks } from "@/components/oka/open-accounting-books";
import { OpenAccountingExpenses } from "@/components/oka/open-accounting-expenses";
import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTION_ORIGIN } from "@/lib/affiliate-share";
import { signInWithGoogle } from "@/lib/google-sign-in";
import { saveReturnTo } from "@/lib/join-link";
import { beginSignupFlow } from "@/lib/signup-flow.functions";
import { cn } from "@/lib/utils";

const TABS = ["books", "expenses"] as const;
type Tab = (typeof TABS)[number];

const OG_IMAGE = `${PRODUCTION_ORIGIN}/og/open-accounting.png`;
const OG_URL = `${PRODUCTION_ORIGIN}/open-accounting`;
const OG_DESCRIPTION = "See how Oka grows, creates value, and shares its prosperity.";

export const Route = createFileRoute("/open-accounting")({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Open Accounting — Oka" },
      { name: "description", content: OG_DESCRIPTION },
      { property: "og:title", content: "Open Accounting — Oka" },
      { property: "og:description", content: OG_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: OG_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Open Accounting — Oka" },
      { name: "twitter:description", content: OG_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
  }),
  component: OpenAccountingRoute,
});

function OpenAccountingRoute() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (signedIn === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background" role="status">
        <p className="font-serif text-2xl text-muted-foreground">A moment, please…</p>
      </main>
    );
  }

  if (!signedIn) return <OpenAccountingTeaser />;

  return (
    <AppShell>
      <OpenAccountingMemberPage />
    </AppShell>
  );
}

function OpenAccountingTeaser() {
  const beginSignup = useServerFn(beginSignupFlow);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError(null);
    setBusy(true);
    saveReturnTo("/open-accounting");
    try {
      await beginSignup();
      await signInWithGoogle(window.location.origin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in could not be opened. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-8">
        <Link to="/" aria-label="Oka home"><Wordmark className="h-7" /></Link>
        <p className="section-label hidden sm:block">One World Family</p>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-20">
        <p className="section-label">One World Family</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight text-foreground sm:text-5xl">Open Accounting</h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          See how our community grows, creates value, and shares its prosperity. Books are for members — sign in to open them.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button className="rounded-full px-8" disabled={busy} onClick={() => void signIn()}>
            {busy ? "Opening…" : "Sign in to view Books"}
          </Button>
          <Button asChild variant="outline" className="rounded-full px-8">
            <Link to="/">Back to Oka</Link>
          </Button>
        </div>
        {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
      </article>
    </main>
  );
}

function OpenAccountingMemberPage() {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/open-accounting" });

  if (rolesLoading) return null;

  const isAdmin = Boolean(roles?.isAdmin);
  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "books", label: "Books", icon: BookOpen },
    ...(isAdmin ? [{ id: "expenses" as const, label: "Expenses", icon: Receipt }] : []),
  ];
  const active: Tab = tab === "expenses" && isAdmin ? "expenses" : "books";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
      <p className="section-label">One World Family</p>
      <h1 className="mt-3 text-4xl text-foreground">Open Accounting</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        See how our community grows, creates value, and shares its prosperity.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Open Accounting sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => navigate({ search: { tab: t.id }, replace: true })}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
              active === t.id ? "border-transparent bg-secondary text-secondary-foreground" : "border-border text-muted-foreground",
            )}
          >
            <t.icon className="size-4 text-primary" strokeWidth={1.5} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-10" role="tabpanel" aria-label={active === "books" ? "Books" : "Expenses"}>
        {active === "books" && <OpenAccountingBooks />}
        {active === "expenses" && isAdmin && <OpenAccountingExpenses />}
      </div>
    </div>
  );
}
