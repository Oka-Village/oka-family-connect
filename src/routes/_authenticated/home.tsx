import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Heart, Lightbulb, MoonStar } from "lucide-react";
import { z } from "zod";

import { AppreciationSpace } from "@/components/oka/appreciation-space";
import { InspirationDeck } from "@/components/oka/inspiration-deck";
import { ReflectionDeck } from "@/components/oka/reflection-deck";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const spaceSchema = z.object({ space: fallback(z.enum(["reflection", "inspiration", "appreciation"]).optional(), undefined) });
type HomeSpace = "reflection" | "inspiration" | "appreciation";

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: zodValidator(spaceSchema),
  head: () => ({ meta: [
    { title: "Home — Oka" },
    { name: "description", content: "A quiet place for reflection, inspiration, and appreciation in the Oka family." },
    { property: "og:title", content: "Home — Oka" },
    { property: "og:description", content: "A quiet place for reflection, inspiration, and appreciation in the Oka family." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});

const SPACES = [
  { id: "reflection", title: "Reflection", description: "A question to carry into the day.", icon: MoonStar },
  { id: "inspiration", title: "Inspiration", description: "A small spark from a timeless voice.", icon: Lightbulb },
  { id: "appreciation", title: "Appreciation", description: "A note of thanks for someone in the family.", icon: Heart },
] as const;

function HomePage() {
  const { data: profile, isLoading, isError } = useProfile();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const active = search.space;
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const choose = (space: HomeSpace) => void navigate({ search: { space }, replace: true });

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-10 lg:px-10 lg:py-14">
      <p className="section-label">Your place in Oka</p>
      <h1 className="mt-4 text-5xl text-foreground sm:text-6xl">Home</h1>
      {isLoading ? <Skeleton className="mt-5 h-7 w-72" /> : isError ? <p className="mt-5 text-muted-foreground">Welcome home. Your name will return when the connection does.</p> : <p className="mt-5 font-serif text-2xl text-foreground">Welcome home{firstName ? `, ${firstName}` : ""}.</p>}
      <p className="mt-2 max-w-xl text-muted-foreground">A quiet corner to pause, gather a little light, or let someone know they matter.</p>

      <div className="mt-10 grid gap-5 md:grid-cols-3" role="tablist" aria-label="Home spaces">
        {SPACES.map((space) => <button key={space.id} type="button" role="tab" aria-selected={active === space.id} onClick={() => choose(space.id)} className={cn("home-space-card surface-card min-h-52 p-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4", active === space.id && "is-active")}><space.icon className="size-7 text-primary" strokeWidth={1.5} /><p className="mt-10 font-serif text-3xl text-foreground">{space.title}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{space.description}</p></button>)}
      </div>

      <div className="mt-10" role="tabpanel">
        {!active && <div className="border-t border-border py-10 text-center"><p className="font-serif text-3xl text-foreground">Choose a space when you’re ready.</p></div>}
        {active === "reflection" && <ReflectionDeck />}
        {active === "inspiration" && <InspirationDeck />}
        {active === "appreciation" && profile && <AppreciationSpace currentUserId={profile.id} />}
        {active === "appreciation" && isLoading && <Skeleton className="h-96 rounded-2xl" />}
        {active === "appreciation" && isError && <p className="surface-card p-8 text-muted-foreground">Appreciation couldn't open just now. Please try again.</p>}
      </div>
    </div>
  );
}