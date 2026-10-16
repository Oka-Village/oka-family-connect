import { ImageIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { currentKey, periodLabel, useTheme, type ThemeKind } from "@/lib/themes";

function ThemeCard({ kind }: { kind: ThemeKind }) {
  const { data, isLoading, isError } = useTheme(kind);
  const label = kind === "month" ? "This month" : "This week";
  return (
    <article className="surface-card flex flex-col overflow-hidden sm:flex-row">
      <div className="aspect-[4/3] shrink-0 bg-secondary sm:aspect-auto sm:w-44">
        {isLoading ? <Skeleton className="size-full rounded-none" /> : data?.imageUrl ? (
          <img src={data.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center"><ImageIcon className="size-7 text-primary/50" strokeWidth={1.5} aria-hidden /></div>
        )}
      </div>
      <div className="flex min-h-[176px] flex-1 flex-col gap-2 p-6">
        <p className="section-label">{label} · {periodLabel(kind, currentKey(kind))}</p>
        {isLoading ? (
          <><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /></>
        ) : data ? (
          <>
            <h3 className="font-serif text-3xl leading-tight text-foreground">{data.title}</h3>
            {data.body && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{data.body}</p>}
          </>
        ) : (
          <p className="font-serif text-xl italic text-muted-foreground">{isError ? "The theme couldn't load just now." : `No theme set for ${kind === "month" ? "this month" : "this week"} yet. Something gentle is on its way.`}</p>
        )}
      </div>
    </article>
  );
}

export function HomeThemes() {
  return (
    <section aria-labelledby="themes-heading" className="flex flex-col gap-5">
      <h2 id="themes-heading" className="section-label">Themes</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <ThemeCard kind="month" />
        <ThemeCard kind="week" />
      </div>
    </section>
  );
}
