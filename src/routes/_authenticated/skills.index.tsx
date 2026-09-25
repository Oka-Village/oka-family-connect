import { CreditPill } from "@/components/oka/credit-pill";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Inbox, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/oka/empty-state";
import { SkillCard } from "@/components/oka/skill-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SKILL_CATEGORIES, SKILL_FORMATS, SKILL_FORMAT_LABELS, fetchSkillsPage, useCredits, type SkillCursor } from "@/lib/skills";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  format: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/skills/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Skills — Oka" },
      { name: "description", content: "Offer and receive gifts of skill in the credit economy." },
      { property: "og:title", content: "Skills — Oka" },
      { property: "og:description", content: "Offer and receive gifts of skill in the credit economy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SkillsPage,
});

const pill = (on: boolean) =>
  cn("rounded-full border px-4 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary");

function SkillsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q);
  useEffect(() => {
    const t = setTimeout(() => { if (q !== search.q) void navigate({ search: (p) => ({ ...p, q }), replace: true }); }, 300);
    return () => clearTimeout(t);
  }, [q, search.q, navigate]);

  const filters = { q: search.q, category: search.category, format: search.format };
  const query = useInfiniteQuery({
    queryKey: ["skills", filters],
    queryFn: ({ pageParam }) => fetchSkillsPage(filters, pageParam),
    initialPageParam: null as SkillCursor,
    getNextPageParam: (last) => last.next,
  });
  const skills = query.data?.pages.flatMap((p) => p.skills) ?? [];
  const filtered = Boolean(filters.q || filters.category || filters.format);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="section-label">Skills</p>
          <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">Gifts to give and receive</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">One hour of a shared skill is one credit. Ask for a session, or offer your own.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CreditPill />
          <Button asChild variant="outline" className="rounded-full"><Link to="/sessions"><Inbox className="size-4 text-primary" strokeWidth={1.5} />Sessions</Link></Button>
          <Button asChild className="rounded-full"><Link to="/skills/new"><Plus className="size-4" strokeWidth={1.5} />Offer a skill</Link></Button>
        </div>
      </div>

      <label className="relative mt-10 block">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills" className="rounded-full pl-11" />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {SKILL_FORMATS.map((f) => (
          <button key={f} type="button" className={pill(search.format === f)} onClick={() => void navigate({ search: (p) => ({ ...p, format: p.format === f ? "" : f }) })}>
            {SKILL_FORMAT_LABELS[f]}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {SKILL_CATEGORIES.map((c) => (
          <button key={c} type="button" className={pill(search.category === c)} onClick={() => void navigate({ search: (p) => ({ ...p, category: p.category === c ? "" : c }) })}>
            {c}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>
      ) : skills.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          label={filtered ? "No matches" : "Skills"}
          title={filtered ? "Nothing matches just yet" : "The first gifts are still being wrapped"}
          description={filtered ? "Try another category or format." : "Be the first to offer something you love to share."}
        />
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => <SkillCard key={s.id} skill={s} />)}
          </div>
          {query.hasNextPage && (
            <div className="mt-10 flex justify-center">
              <Button variant="outline" className="rounded-full px-8" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                {query.isFetchingNextPage && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
