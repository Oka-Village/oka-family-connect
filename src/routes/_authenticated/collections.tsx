import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Heart } from "lucide-react";
import { z } from "zod";

import { HouseCard } from "@/components/oka/house-card";
import { SkillCard } from "@/components/oka/skill-card";
import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites, type Favorite, type FavoriteType } from "@/hooks/use-favorites";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_SELECT, withSignedHousePhotos, type HouseRow } from "@/lib/houses";
import { SKILL_SELECT, signPaths, type SkillRow } from "@/lib/skills";
import { cn } from "@/lib/utils";

const TABS = ["skills", "houses", "inspiration", "reflection"] as const;
type Tab = (typeof TABS)[number];
const TYPE_OF: Record<Tab, FavoriteType> = { skills: "skill", houses: "house", inspiration: "inspiration", reflection: "reflection" };
const LABEL: Record<Tab, string> = { skills: "Skills", houses: "Houses", inspiration: "Inspiration", reflection: "Reflection" };

export const Route = createFileRoute("/_authenticated/collections")({
  validateSearch: zodValidator(z.object({ tab: fallback(z.enum(TABS), "skills").default("skills") })),
  head: () => ({ meta: [
    { title: "Collections — Oka" },
    { name: "description", content: "The skills, houses, quotes and questions you've saved in Oka." },
    { property: "og:title", content: "Collections — Oka" },
    { property: "og:description", content: "The skills, houses, quotes and questions you've saved in Oka." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fav = useFavorites();
  const byTab = (t: Tab) => fav.favorites.filter((f) => f.item_type === TYPE_OF[t]);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-10 lg:px-10 lg:py-14">
      <p className="section-label">Kept close</p>
      <h1 className="mt-4 text-5xl text-foreground sm:text-6xl">Collections</h1>
      <p className="mt-4 text-muted-foreground">Everything you've kept close.</p>

      <div role="tablist" aria-label="Collections" className="mt-8 grid grid-cols-2 gap-1 rounded-3xl bg-cream-deep p-1 sm:flex sm:w-fit sm:rounded-full">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => void navigate({ search: { tab: t }, replace: true })}
            className={cn("min-h-11 whitespace-nowrap rounded-full px-4 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none", tab === t ? "bg-card text-foreground shadow-nav" : "text-muted-foreground hover:text-foreground")}>
            {LABEL[t]} <span className="ml-1 text-xs text-muted-foreground">{fav.isLoading ? "·" : byTab(t).length}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-8">
        {fav.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
        ) : fav.isError ? (
          <div className="surface-card p-8 text-center"><p className="text-muted-foreground">Your collections couldn't load just now.</p><Button className="mt-4 rounded-full" onClick={() => void fav.refetch()}>Try again</Button></div>
        ) : byTab(tab).length === 0 ? (
          <Empty tab={tab} />
        ) : tab === "skills" ? (
          <SavedSkills items={byTab(tab)} />
        ) : tab === "houses" ? (
          <SavedHouses items={byTab(tab)} />
        ) : (
          <SavedCards items={byTab(tab)} kind={tab} />
        )}
      </div>
    </div>
  );
}

function Empty({ tab }: { tab: Tab }) {
  const copy: Record<Tab, string> = {
    skills: "No skills saved yet. Tap the heart on any offering to keep it here.",
    houses: "No houses saved yet. Tap the heart on a home you'd love to visit.",
    inspiration: "No quotes saved yet. Draw a card and tap the heart to keep one.",
    reflection: "No questions saved yet. Draw a card and tap the heart to keep one.",
  };
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary"><Heart className="size-6 text-primary" strokeWidth={1.5} /></span>
      <p className="mt-6 font-serif text-2xl text-foreground">{copy[tab]}</p>
      <Button asChild className="mt-6 rounded-full">
        {tab === "skills" ? <Link to="/skills">Browse skills</Link>
          : tab === "houses" ? <Link to="/houses">Browse houses</Link>
          : <Link to="/home" search={{ space: tab }}>Draw a card</Link>}
      </Button>
    </div>
  );
}

function GridSkeleton() {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>;
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return <div className="surface-card p-8 text-center"><p className="text-muted-foreground">These couldn't load just now.</p><Button className="mt-4 rounded-full" onClick={onRetry}>Try again</Button></div>;
}

function SavedSkills({ items }: { items: Favorite[] }) {
  const ids = items.map((f) => f.item_ref);
  const q = useQuery({
    queryKey: ["collection-skills", ids],
    queryFn: async () => {
      const { data, error } = await supabase.from("skills").select(SKILL_SELECT).in("id", ids);
      if (error) throw error;
      const rows = (data ?? []) as unknown as SkillRow[];
      const sign = await signPaths(rows.flatMap((s) => [s.photo_url, s.owner?.photo_url]));
      return rows.map((s) => ({ ...s, photo: sign(s.photo_url), hostPhoto: sign(s.owner?.photo_url) }));
    },
    placeholderData: (prev) => prev,
  });
  if (q.isLoading) return <GridSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const map = new Map((q.data ?? []).map((s) => [s.id, s]));
  const list = ids.map((id) => map.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((s) => <SkillCard key={s.id} skill={s} />)}{list.length < ids.length && <p className="text-sm text-muted-foreground sm:col-span-full">Some saved offerings are no longer available.</p>}</div>;
}

function SavedHouses({ items }: { items: Favorite[] }) {
  const ids = items.map((f) => f.item_ref);
  const q = useQuery({
    queryKey: ["collection-houses", ids],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select(HOUSE_SELECT).in("id", ids);
      if (error) throw error;
      return withSignedHousePhotos((data ?? []) as unknown as HouseRow[]);
    },
    placeholderData: (prev) => prev,
  });
  if (q.isLoading) return <GridSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const map = new Map((q.data ?? []).map((h) => [h.id, h]));
  const list = ids.map((id) => map.get(id)).filter((h): h is NonNullable<typeof h> => !!h);
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((h) => <HouseCard key={h.id} house={h} />)}{list.length < ids.length && <p className="text-sm text-muted-foreground sm:col-span-full">Some saved homes are no longer available.</p>}</div>;
}

function SavedCards({ items, kind }: { items: Favorite[]; kind: "inspiration" | "reflection" }) {
  const { toggle } = useFavorites();
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const remove = (f: Favorite) => {
    setLeaving((s) => new Set(s).add(f.item_ref));
    window.setTimeout(() => {
      toggle(f.item_type, f.item_ref);
      setLeaving((s) => { const n = new Set(s); n.delete(f.item_ref); return n; });
    }, 260);
  };
  return (
    <div className={cn("grid gap-6", kind === "reflection" ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((f) => (
        <article key={f.item_ref} className={cn("saved-card", kind === "reflection" ? "saved-card-reflection" : "saved-card-inspiration", leaving.has(f.item_ref) && "collection-card-exit")}>
          <div>
            {kind === "reflection" && <p className="section-label text-primary">For reflection</p>}
            <p className={cn("font-serif leading-tight text-foreground", kind === "reflection" ? "mt-3 text-lg sm:text-2xl" : "text-2xl")}>{kind === "inspiration" ? `“${f.snapshot?.text ?? ""}”` : f.snapshot?.text}</p>
            {f.snapshot?.author && <p className="section-label mt-4">{f.snapshot.author}</p>}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Wordmark className="h-6 opacity-70" />
            <button type="button" aria-pressed="true" aria-label="Remove from Collections" onClick={() => remove(f)} disabled={leaving.has(f.item_ref)}
              className="favorite-btn inline-flex size-11 items-center justify-center rounded-full border border-border bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Heart className="size-5 fill-primary text-primary" strokeWidth={1.5} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
