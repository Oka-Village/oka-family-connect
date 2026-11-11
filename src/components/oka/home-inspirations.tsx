import { Skeleton } from "@/components/ui/skeleton";
import { dailyQuote } from "@/lib/home-content";
import { FULL_ACCESS_OPENS_AT } from "@/lib/member-access";
import { currentKey, periodLabel, useTheme } from "@/lib/themes";

function MonthlyThemeBanner() {
  const { data, isLoading, isError } = useTheme("month");
  const daysUntilOpen = Math.max(0, Math.ceil((Date.parse(FULL_ACCESS_OPENS_AT) - Date.now()) / 86_400_000));
  const label = data?.title
    ? `This month · ${data.title}`
    : `This month · ${periodLabel("month", currentKey("month"))}`;

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-sage-light/40 p-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="sm:max-w-xs sm:border-r sm:border-sand sm:pr-8">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-40 bg-sage/20" />
            <Skeleton className="h-4 w-56 bg-sage/20" />
          </div>
        ) : (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sage-ink">{label}</p>
            <p className="mt-2 text-sm text-sage-ink">
              {data?.body
                ? data.body
                : isError
                  ? "The theme couldn't load just now."
                  : "Something gentle is on its way."}
            </p>
          </>
        )}
      </div>
      <p className="text-sage-ink">
        <span className="font-number text-5xl font-light text-sage">{daysUntilOpen}</span>
        <span className="ml-3 text-sm">days until the whole home opens on December 1</span>
      </p>
    </section>
  );
}

function QuoteOfDay() {
  const { quote, author } = dailyQuote();
  return (
    <article className="surface-card flex h-full flex-col p-6 md:p-8">
      <p className="section-label">Quote of the Day</p>
      <p className="mt-5 flex-1 font-serif text-[22px] italic leading-[1.35] text-foreground md:text-[26px]">“{quote}”</p>
      <p className="mt-5 text-sm text-muted-foreground">— {author}</p>
    </article>
  );
}

function WeeklyThemeCard() {
  const { data, isLoading, isError } = useTheme("week");
  return (
    <article className="surface-card flex h-full flex-col p-6 md:p-8">
      <p className="section-label">Weekly Theme</p>
      {isLoading ? (
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full max-w-[560px]" />
        </div>
      ) : data ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{periodLabel("week", currentKey("week"))}</p>
          <h3 className="mt-3 font-serif text-[28px] leading-tight text-foreground md:text-[32px]">{data.title}</h3>
          {data.body ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">{data.body}</p> : null}
        </>
      ) : (
        <p className="mt-4 font-serif text-xl italic text-muted-foreground">
          {isError ? "The theme couldn't load just now." : "No theme set for this week yet. Something gentle is on its way."}
        </p>
      )}
    </article>
  );
}

/** Monthly banner, then Quote of the Day beside Weekly Theme. */
export function HomeInspirations() {
  return (
    <section aria-label="Today's inspirations" className="flex flex-col gap-8 md:gap-10">
      <MonthlyThemeBanner />
      <div className="grid gap-4 md:grid-cols-2">
        <QuoteOfDay />
        <WeeklyThemeCard />
      </div>
    </section>
  );
}
