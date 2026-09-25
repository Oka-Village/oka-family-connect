import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Loader2, MapPin, Search, Users } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchDirectoryPage, type DirectoryCursor } from "@/lib/directory";
import { INTENTIONS } from "@/lib/profile";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  intention: fallback(z.string(), "").default(""),
  location: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/directory")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Directory — Oka" },
      { name: "description", content: "Meet the people of the Oka family." },
      { property: "og:title", content: "Directory — Oka" },
      { property: "og:description", content: "Meet the people of the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DirectoryPage,
});

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function DirectoryPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q);
  const [loc, setLoc] = useState(search.location);
  const dq = useDebounced(q);
  const dloc = useDebounced(loc);

  useEffect(() => {
    if (dq !== search.q || dloc !== search.location) {
      void navigate({ search: (prev) => ({ ...prev, q: dq, location: dloc }), replace: true });
    }
  }, [dq, dloc, search.q, search.location, navigate]);

  const filters = { q: search.q, intention: search.intention, location: search.location };
  const query = useInfiniteQuery({
    queryKey: ["directory", filters],
    queryFn: ({ pageParam }) => fetchDirectoryPage(filters, pageParam),
    initialPageParam: null as DirectoryCursor,
    getNextPageParam: (last) => last.next,
  });
  const members = query.data?.pages.flatMap((p) => p.members) ?? [];
  const filtered = Boolean(filters.q || filters.intention || filters.location);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <p className="section-label">Directory</p>
      <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">Faces of the family</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">Find the people you haven't met yet — by name, by place, by what they're drawn to.</p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <label className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="rounded-full pl-11" />
        </label>
        <label className="relative">
          <MapPin className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Filter by location" className="rounded-full pl-11" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {INTENTIONS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => void navigate({ search: (prev) => ({ ...prev, intention: prev.intention === t ? "" : t }) })}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              search.intention === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>
      ) : query.isError ? (
        <p className="py-24 text-center text-muted-foreground">The directory couldn't load just now. Please try again.</p>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          label={filtered ? "No matches" : "Directory"}
          title={filtered ? "No one matches that just yet" : "The family is still gathering"}
          description={filtered ? "Try a different name, place or intention." : "As members join, their faces will appear here."}
        />
      ) : (
        <>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {members.map((m) => (
              <Link key={m.id} to="/members/$memberId" params={{ memberId: m.id }} className="surface-card group flex flex-col items-center p-6 text-center transition-shadow hover:shadow-lifted">
                <MemberAvatar src={m.photo} name={m.display_name} className="size-24" />
                <p className="mt-4 font-serif text-2xl text-foreground group-hover:text-primary">{m.display_name ?? "Oka member"}</p>
                {m.location && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 text-primary" strokeWidth={1.5} />{m.location}
                  </p>
                )}
                {m.intentions.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {m.intentions.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{t}</span>
                    ))}
                    {m.intentions.length > 3 && <span className="px-1 text-xs text-muted-foreground">+{m.intentions.length - 3}</span>}
                  </div>
                )}
              </Link>
            ))}
          </div>
          {query.hasNextPage && (
            <div className="mt-10 flex justify-center">
              <Button variant="outline" className="rounded-full px-8" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                {query.isFetchingNextPage && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />} Show more members
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
