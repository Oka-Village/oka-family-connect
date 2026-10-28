import { Postcard } from "@/components/oka/postcard";
import { Skeleton } from "@/components/ui/skeleton";
import { dailyQuote } from "@/lib/home-content";
import { currentKey, periodLabel, useTheme, type ThemeKind } from "@/lib/themes";

function QuoteOfDay() {
  const { quote, author } = dailyQuote();
  return (
    <Postcard rotate={-1.2} tape="terracotta" tapeRotate={-3} className="px-6 pb-9 pt-5 md:px-10 md:pb-11">
      <p className="section-label">Quote of the Day</p>
      <p className="mt-5 max-w-[780px] font-serif text-[26px] italic leading-[1.35] text-foreground md:text-[34px]">“{quote}”</p>
      <p className="mt-5 text-sm text-postcard-label">— {author}</p>
    </Postcard>
  );
}

function ThemeOfDay({ kind }: { kind: ThemeKind }) {
  const { data, isLoading, isError } = useTheme(kind);
  const heading = kind === "month" ? "Monthly Theme" : "Weekly Theme";
  return (
    <Postcard rotate={kind === "month" ? 1.1 : -1.4} tape={kind === "month" ? "sand" : "sage"} tapeRotate={kind === "month" ? 3 : -2} className="px-6 pb-9 pt-5 md:px-10 md:pb-11">
      <p className="section-label">{heading}</p>
      {isLoading ? (
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full max-w-[560px]" />
        </div>
      ) : data ? (
        <>
          <p className="mt-2 text-sm text-postcard-label">{periodLabel(kind, currentKey(kind))}</p>
          <h3 className="mt-3 max-w-[720px] font-serif text-[28px] leading-tight text-foreground md:text-[32px]">{data.title}</h3>
          {data.body && <p className="mt-3 max-w-[640px] text-sm leading-relaxed text-muted-foreground md:text-[15px]">{data.body}</p>}
        </>
      ) : (
        <p className="mt-4 max-w-[640px] font-serif text-xl italic text-muted-foreground">
          {isError ? "The theme couldn't load just now." : `No theme set for ${kind === "month" ? "this month" : "this week"} yet. Something gentle is on its way.`}
        </p>
      )}
    </Postcard>
  );
}

/** The three daily inspirations at the top of Home, in fixed order. */
export function HomeInspirations() {
  return (
    <section aria-label="Today's inspirations" className="flex flex-col gap-10 md:gap-12">
      <QuoteOfDay />
      <ThemeOfDay kind="week" />
      <ThemeOfDay kind="month" />
    </section>
  );
}
