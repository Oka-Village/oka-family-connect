import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Activity = { occurred_at: string; actor_id: string | null; actor_name: string | null; action: string; detail: string | null };
const PAGE = 100;

/** Admin-only feed of every member's activity, read through the admin_activity_log function. */
export function ActivitySection() {
  const [term, setTerm] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["admin", "activity"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("admin_activity_log", pageParam ? { _before: pageParam, _limit: PAGE } : { _limit: PAGE });
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]?.occurred_at : undefined),
  });

  const rows = useMemo(() => {
    const all = q.data?.pages.flat() ?? [];
    const t = term.trim().toLowerCase();
    if (!t) return all;
    return all.filter((r) => [r.actor_name, r.action, r.detail].some((v) => v?.toLowerCase().includes(t)));
  }, [q.data, term]);

  return (
    <section className="mt-10">
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Filter by member, action or detail" className="rounded-full pl-10" />
      </div>
      {q.isLoading && <p className="mt-6 text-muted-foreground">Loading activity…</p>}
      {q.isError && (
        <p className="mt-6 text-muted-foreground">
          Couldn't load activity. <button className="underline" onClick={() => q.refetch()}>Try again</button>
        </p>
      )}
      {q.data && rows.length === 0 && <p className="mt-6 text-muted-foreground">No activity matches.</p>}
      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
        {rows.map((r, i) => (
          <li key={`${r.occurred_at}-${i}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <time className="w-36 shrink-0 text-xs text-muted-foreground">
              {new Date(r.occurred_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </time>
            {r.actor_id ? (
              <Link to="/members/$memberId" params={{ memberId: r.actor_id }} className="font-medium text-foreground hover:underline">
                {r.actor_name || "Unnamed member"}
              </Link>
            ) : <span className="font-medium text-foreground">Someone</span>}
            <span className="text-foreground">{r.action}</span>
            {r.detail && <span className="text-muted-foreground">{r.detail}</span>}
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="rounded-full" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {q.isFetchingNextPage ? "Loading…" : "Load older activity"}
          </Button>
        </div>
      )}
    </section>
  );
}
