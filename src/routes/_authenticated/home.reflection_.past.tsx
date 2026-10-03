import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { SpaceShell, pillOutline, pillPrimary } from "@/components/oka/postcard";
import { useDeleteReflection, useReflections, type Reflection } from "@/hooks/use-reflections";

export const Route = createFileRoute("/_authenticated/home/reflection_/past")({
  head: () => ({ meta: [
    { title: "Past reflections — Oka" },
    { name: "description", content: "Your private reflections, newest first." },
    { property: "og:title", content: "Past reflections — Oka" },
    { property: "og:description", content: "Your private reflections, newest first." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PastReflectionsPage,
});

function PastReflectionsPage() {
  const { data, isLoading, isError, refetch } = useReflections();
  return (
    <SpaceShell label="Past reflections · Private">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/home/reflection" className="text-sm text-primary underline-offset-4 hover:underline">← Back to today's question</Link>
        {isLoading ? (
          <div className="mt-6 space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-sand/50" />)}</div>
        ) : isError ? (
          <div className="mt-6 rounded-2xl bg-card p-6 text-center shadow-sm">
            <p className="text-muted-foreground">We couldn't load your reflections.</p>
            <button type="button" className={`${pillPrimary} mt-4`} onClick={() => void refetch()}>Try again</button>
          </div>
        ) : !data?.length ? (
          <p className="mt-10 text-center font-serif text-2xl italic text-muted-foreground">Nothing here yet. Your reflections stay private.</p>
        ) : (
          <>
            <p className="mt-4 text-[13px] text-muted-foreground">{data.length} {data.length === 1 ? "reflection" : "reflections"} saved. Private.</p>
            <ul className="mt-4 space-y-4">{data.map((r) => <ReflectionItem key={r.id} r={r} />)}</ul>
          </>
        )}
      </div>
    </SpaceShell>
  );
}

function ReflectionItem({ r }: { r: Reflection }) {
  const del = useDeleteReflection();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const date = new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <li className="rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{date}</p>
        {!confirming && (
          <button type="button" aria-label="Delete reflection" className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
      <p className="mt-2 font-serif text-2xl leading-tight text-foreground">{r.question_text}</p>
      <p className="mt-3 whitespace-pre-wrap text-foreground/85">{r.body}</p>
      {confirming && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sand pt-4">
          <span className="text-sm text-muted-foreground">Delete this reflection for good?</span>
          <button type="button" className={`${pillPrimary} bg-destructive hover:bg-destructive/90`} disabled={del.isPending}
            onClick={() => { setError(false); del.mutate(r.id, { onError: () => setError(true) }); }}>
            {del.isPending ? "Deleting…" : "Delete"}
          </button>
          <button type="button" className={pillOutline} onClick={() => setConfirming(false)}>Keep it</button>
          {error && <span role="alert" className="text-sm text-destructive">Couldn't delete. Please try again.</span>}
        </div>
      )}
    </li>
  );
}
