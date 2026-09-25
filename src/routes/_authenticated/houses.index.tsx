import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { BedDouble, Home, Loader2, MapPin, Plus } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { HouseCard } from "@/components/oka/house-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROPERTY_LABELS, PROPERTY_TYPES, fetchHousesPage, type HouseCursor } from "@/lib/houses";
import { useCredits } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/houses/")({
  validateSearch: zodValidator(z.object({
    location: fallback(z.string(), "").default(""),
    type: fallback(z.string(), "").default(""),
  })),
  head: () => ({
    meta: [
      { title: "Houses — Oka" },
      { name: "description", content: "Homes open to the Oka family — one credit per night." },
      { property: "og:title", content: "Houses — Oka" },
      { property: "og:description", content: "Homes open to the Oka family — one credit per night." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HousesPage,
});

const pill = (on: boolean) =>
  cn("rounded-full border px-4 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary");

function HousesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const credits = useCredits();
  const [loc, setLoc] = useState(search.location);
  useEffect(() => {
    const t = setTimeout(() => { if (loc !== search.location) void navigate({ search: (p) => ({ ...p, location: loc }), replace: true }); }, 300);
    return () => clearTimeout(t);
  }, [loc, search.location, navigate]);

  const filters = { location: search.location, type: search.type };
  const query = useInfiniteQuery({
    queryKey: ["houses", filters],
    queryFn: ({ pageParam }) => fetchHousesPage(filters, pageParam),
    initialPageParam: null as HouseCursor,
    getNextPageParam: (last) => last.next,
  });
  const houses = query.data?.pages.flatMap((p) => p.houses) ?? [];
  const filtered = Boolean(filters.location || filters.type);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="section-label">Houses</p>
          <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">Doors open around the world</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Stay with family you haven't met yet. One night is one credit.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
            {credits.data ? `${credits.data.available} credit${credits.data.available === 1 ? "" : "s"} available` : "…"}
          </span>
          <Button asChild variant="outline" className="rounded-full"><Link to="/stays"><BedDouble className="size-4 text-primary" strokeWidth={1.5} />Stays</Link></Button>
          <Button asChild className="rounded-full"><Link to="/houses/new"><Plus className="size-4" strokeWidth={1.5} />List my home</Link></Button>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <MapPin className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Where would you like to go?" className="rounded-full pl-11" />
        </label>
        {PROPERTY_TYPES.map((t) => (
          <button key={t} type="button" className={pill(search.type === t)} onClick={() => void navigate({ search: (p) => ({ ...p, type: p.type === t ? "" : t }) })}>{PROPERTY_LABELS[t]}</button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>
      ) : houses.length === 0 ? (
        <EmptyState
          icon={Home}
          label={filtered ? "No matches" : "Houses"}
          title={filtered ? "No homes there just yet" : "The first doors are about to open"}
          description={filtered ? "Try another place or type of stay." : "Open your home to the family and be the first."}
        />
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{houses.map((h) => <HouseCard key={h.id} house={h} />)}</div>
          {query.hasNextPage && (
            <div className="mt-10 flex justify-center">
              <Button variant="outline" className="rounded-full px-8" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                {query.isFetchingNextPage && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Show more homes
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
