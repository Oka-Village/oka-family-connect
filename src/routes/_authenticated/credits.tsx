import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CalendarHeart, Coins, Home, Loader2, Sparkles, UserRoundCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Credits — Oka" },
      { name: "description", content: "Your Oka credits: one credit is one night's stay or one hour of service." },
      { property: "og:title", content: "Credits — Oka" },
      { property: "og:description", content: "Your Oka credits: one credit is one night's stay or one hour of service." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreditsPage,
});

type Entry = { id: string; delta: number; reason: string; description: string; note: string | null; created_at: string };
type Cursor = { created_at: string; id: string } | null;
const PAGE = 25;

const WAYS = [
  { icon: Home, title: "Host a guest", amount: "1 per night", text: "Open your home and earn a credit for every night a family member stays.", to: "/houses/new", cta: "List my home" },
  { icon: Sparkles, title: "Share a skill", amount: "1 per session", text: "An hour of what you love — cooking, coaching, a language — is one credit.", to: "/skills/new", cta: "Offer a skill" },
  { icon: CalendarHeart, title: "Host a workshop", amount: "2", text: "Gather the family around something you know well.", to: "/events/new", cta: "Propose an event" },
  { icon: UserRoundCheck, title: "Complete your profile", { icon: UserRoundCheck, title: "Complete your profile", amount: "+3 once", text: "Let the family know you — every section filled in brings a welcome gift.", to: "/profile", cta: "My profile" },, text: "Let the family know you — every section filled in brings a welcome gift.", to: "/profile", cta: "My profile" },
  { icon: Users, title: "Complete a Pod", amount: "+3 once", text: "Journey through a Pod with a small circle of members.", to: "/events", cta: "See events" },
] as const;

function CreditsPage() {
  const credits = useCredits();
  const { data: uid } = useCurrentUserId();
  const history = useInfiniteQuery({
    queryKey: ["ledger", uid],
    enabled: Boolean(uid),
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("my_credit_history", pageParam
        ? { _before_created: pageParam.created_at, _before_id: pageParam.id, _limit: PAGE }
        : { _limit: PAGE });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
    getNextPageParam: (last) => {
      const l = last[last.length - 1];
      return last.length === PAGE && l ? { created_at: l.created_at, id: l.id } : null;
    },
  });
  const entries = history.data?.pages.flat() ?? [];
  const c = credits.data;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <p className="section-label">Credits</p>
      <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">What you've given, what you can receive</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">One credit is one night's stay or one hour of service. No money ever changes hands.</p>

      <div className="surface-card mt-10 flex flex-wrap items-end justify-between gap-8 p-8 lg:p-10">
        <div>
          <p className="section-label">Your balance</p>
          <p className="mt-3 font-serif text-7xl leading-none text-foreground lg:text-8xl">{credits.isLoading ? "…" : c?.balance ?? 0}</p>
          <p className="mt-3 text-sm text-muted-foreground">credit{c?.balance === 1 ? "" : "s"}</p>
        </div>
        {c && c.reserved > 0 && (
          <div className="text-sm text-muted-foreground">
            <p>{c.reserved} set aside for open session requests</p>
            <p className="mt-1 font-serif text-2xl text-foreground">{c.available} available</p>
            <Link to="/sessions" className="text-primary hover:underline">See sessions</Link>
          </div>
        )}
      </div>

      {c && c.available <= 0 && (
        <div className="mt-6 rounded-2xl bg-secondary p-6 text-secondary-foreground">
          <p className="font-serif text-2xl">Your credits grow when you give</p>
          <p className="mt-2 text-sm">Host a night or offer an hour of a skill, and doors across the family open to you.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full"><Link to="/houses/new">Host a guest</Link></Button>
            <Button asChild size="sm" variant="outline" className="rounded-full"><Link to="/skills/new">Offer a skill</Link></Button>
          </div>
        </div>
      )}

      <p className="section-label mt-16">Ways to earn</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {WAYS.map((w) => (
          <div key={w.title} className="surface-card flex flex-col p-6">
            <w.icon className="size-6 text-primary" strokeWidth={1.5} />
            <p className="mt-4 font-serif text-2xl text-foreground">{w.title}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-primary">{w.amount}</p>
            <p className="mt-3 flex-1 text-sm text-muted-foreground">{w.text}</p>
            <Link to={w.to} className="mt-4 text-sm text-primary hover:underline">{w.cta} →</Link>
          </div>
        ))}
      </div>

      <p className="section-label mt-16">History</p>
      {history.isLoading || !uid ? (
        <Loader2 className="mt-6 size-6 animate-spin text-primary" strokeWidth={1.5} />
      ) : entries.length === 0 ? (
        <div className="surface-card mt-4 flex items-center gap-3 p-6 text-muted-foreground">
          <Coins className="size-5 text-primary" strokeWidth={1.5} />Nothing yet — your first night hosted or hour shared will appear here.
        </div>
      ) : (
        <>
          <ul className="surface-card mt-4 divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-foreground">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {e.reason === "manual_adjustment" && e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <span className={cn("font-serif text-2xl", e.delta > 0 ? "text-sage" : "text-primary")}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
              </li>
            ))}
          </ul>
          {history.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" className="rounded-full" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
                {history.isFetchingNextPage && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Show earlier
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
