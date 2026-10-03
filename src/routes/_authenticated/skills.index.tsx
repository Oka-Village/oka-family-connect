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
import { SKILL_CATEGORIES, SKILL_FORMATS, SKILL_FORMAT_LABELS, fetchSkillsPage, type SkillCursor } from "@/lib/skills";
import { cn } from "@/lib/utils";
import { DealtHand } from "@/components/oka/dealt-hand";
import { formatDuration, type SkillRow } from "@/lib/skills";

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

  const fanCard = (s: SkillRow & { photo?: string | null; hostPhoto?: string | null }, front: boolean) => <Link to="/skills/$skillId" params={{ skillId: s.id }} className={cn("flex h-full flex-col p-6", s.category === "Wellbeing" || s.category === "Nature" ? "bg-sage-light" : s.category === "Music" || s.category === "Creative" ? "bg-golden-tint" : "bg-terracotta-tint")}><p className="text-[.65rem] uppercase tracking-[.2em] text-brown-label">{s.category ?? "Shared skill"} · {SKILL_FORMAT_LABELS[s.format]}</p><h3 className="mt-6 text-3xl leading-[1.05] text-foreground">{s.title}</h3><p className="mt-4 text-xs text-muted-foreground">{s.owner?.display_name ?? "Oka member"} · {formatDuration(s.duration_minutes)}</p>{front && <><p className="mt-5 line-clamp-2 text-sm leading-relaxed text-brown-muted">{s.description}</p><span className="mt-auto w-fit rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground">Request a session</span></>}</Link>;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6 lg:px-10 lg:py-8">
      {skills.length > 0 && <DealtHand items={skills} itemKey={(s) => s.id} label="Skills · dealt for you" title={<>Three things<br />to learn this week</>} description="One hour, one credit. Each one taught by someone in the family." secondaryAction={<Button asChild variant="secondary" className="rounded-full px-6"><Link to="/skills/new"><Plus strokeWidth={1.5} />Offer a skill</Link></Button>} renderCard={fanCard} />}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="section-label">All skills</p><div className="flex items-center gap-3"><CreditPill /><Button asChild variant="outline" className="rounded-full"><Link to="/sessions"><Inbox strokeWidth={1.5} />Sessions</Link></Button></div></div>

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
