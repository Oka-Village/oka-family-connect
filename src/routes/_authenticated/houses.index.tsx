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
import { CreditPill } from "@/components/oka/credit-pill";
import { cn } from "@/lib/utils";
import { DealtHand } from "@/components/oka/dealt-hand";
import type { SignedHouse } from "@/lib/houses";

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

  const fanCard = (h: SignedHouse, front: boolean) => <Link to="/houses/$houseId" params={{ houseId: h.id }} className="flex h-full flex-col bg-card">{h.photoUrls[0] ? <img src={h.photoUrls[0]} alt="" className="h-[60%] w-full object-cover" /> : <div className="flex h-[60%] items-center justify-center bg-secondary"><Home className="size-10 text-primary" strokeWidth={1.5} /></div>}<div className="flex flex-1 flex-col p-5"><h3 className="text-2xl leading-none text-foreground">{h.title}</h3><p className="mt-2 text-xs text-muted-foreground">{h.location_text ?? "Somewhere beautiful"} · {PROPERTY_LABELS[h.property_type]}</p>{front && <span className="mt-auto w-fit rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground">Request a stay</span>}</div></Link>;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6 lg:px-10 lg:py-8">
      {houses.length > 0 && <DealtHand items={houses} itemKey={(h) => h.id} label="Houses · dealt for you" title={<>Three homes<br />waiting for you</>} description="Open doors in places the family calls home. One night is one credit." secondaryAction={<Button asChild variant="secondary" className="rounded-full px-6"><Link to="/houses/new"><Plus strokeWidth={1.5} />List my home</Link></Button>} renderCard={fanCard} />}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="section-label">All homes · {houses.length}</p><div className="flex items-center gap-3"><CreditPill /><Button asChild variant="outline" className="rounded-full"><Link to="/stays"><BedDouble strokeWidth={1.5} />Stays</Link></Button></div></div>

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
