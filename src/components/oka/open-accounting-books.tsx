import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { Bars, Donut, chartColors } from "@/components/oka/open-accounting-charts";
import { fetchAccountingData, historyYears } from "@/data/open-accounting/live-ledger";
import { buildAccounting, type AccountingView, type LedgerRow } from "@/data/open-accounting/views";
import { DRAFT_POLICY, THRESHOLD_NOTE, growthPercent, type RangeKind } from "@/lib/open-accounting/allocate";
import { formatCount, formatGrowth, formatIsoDate, formatShare, formatSigned, formatUsd } from "@/lib/open-accounting/format";
import { cn } from "@/lib/utils";

const growthMetrics = [
  { id: "members", label: "Total members", money: false },
  { id: "paying", label: "Paying members", money: false },
  { id: "revenue", label: "Membership revenue", money: true },
  { id: "mrr", label: "Monthly recurring revenue", money: true },
  { id: "growth", label: "Revenue growth", money: false },
  { id: "expenses", label: "Expenses", money: true },
  { id: "net", label: "Net result", money: true },
] as const;

type GrowthId = (typeof growthMetrics)[number]["id"];

export function OpenAccountingBooks() {
  const data = useQuery({ queryKey: ["open-accounting", "data"], queryFn: fetchAccountingData, staleTime: 60_000 });
  const stale = false;
  const [kind, setKind] = useState<RangeKind>("month");
  const [year, setYear] = useState<number | undefined>(undefined);
  const [metric, setMetric] = useState<GrowthId>("members");
  const [ledgerType, setLedgerType] = useState("All");
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [ledgerPage, setLedgerPage] = useState(0);
  const years = useMemo(() => (data.data ? historyYears(data.data.months) : []), [data.data]);
  const view = useMemo(() => {
    if (!data.data) return null;
    const selectedYear = kind === "history" ? year ?? years[years.length - 1] : undefined;
    return buildAccounting(kind, selectedYear, data.data);
  }, [data.data, kind, year, years]);

  if (data.isLoading || !view) {
    return <p className="text-muted-foreground">Loading real accounting data…</p>;
  }
  if (data.isError) {
    return <p className="text-destructive">Could not load Open Accounting data. Try again shortly.</p>;
  }

  function select(next: RangeKind, historyYear?: number) {
    setKind(next);
    if (historyYear) setYear(historyYear);
    setLedgerPage(0);
    setLedgerType("All");
    setLedgerQuery("");
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
        <div className="sticky top-0 z-20 -mx-1 border-b border-border bg-background/95 px-1 py-3 backdrop-blur lg:top-19">
          <div className="flex min-w-0 gap-2 no-scrollbar overflow-x-auto" role="group" aria-label="Reporting range">
            {(
              [
                ["today", "Today"],
                ["month", "This Month"],
                ["quarter", "This Quarter"],
                ["year", "This Year"],
              ] as const
            ).map(([id, label]) => (
              <FilterButton key={id} pressed={kind === id} onClick={() => select(id)}>
                {label}
              </FilterButton>
            ))}
            {years.map((option) => (
              <FilterButton key={option} pressed={kind === "history" && year === option} onClick={() => select("history", option)}>
                {option}
              </FilterButton>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              {view.range.label}
              {stale ? " · Stale snapshot" : ""}
            </p>
            <StripeCheckNote check={data.data?.stripeCheck} />
            <a href="#details" className="text-primary underline decoration-primary/40 underline-offset-4">
              Details
            </a>
          </div>
        </div>

        <Overview view={view} stale={stale} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Allocation view={view} />
          </div>
          <div className="min-w-0">
            <Growth view={view} metric={metric} onMetric={setMetric} />
          </div>
        </div>

        <Glance view={view} />

        <div className="grid gap-6 lg:grid-cols-3">
          <ReferralPerformance view={view} />
          <ContributionPerformance view={view} />
          <Earners view={view} />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ExpenseSnapshot view={view} />
          <CompanySnapshot view={view} />
          <Distributions view={view} />
        </div>

        <Ownership view={view} />

        <Participation view={view} />

        <section id="details" className="flex min-w-0 scroll-mt-36 flex-col gap-6 lg:scroll-mt-52">
          <h2 className="font-serif text-3xl">Details</h2>
          <Expenses view={view} />
          <Profit view={view} />
          <Ledger
          rows={view.ledger}
          type={ledgerType}
          query={ledgerQuery}
          page={ledgerPage}
          onType={(value) => {
            setLedgerType(value);
            setLedgerPage(0);
          }}
          onQuery={(value) => {
            setLedgerQuery(value);
            setLedgerPage(0);
          }}
          onPage={setLedgerPage}
        />
          <Controls view={view} />
        </section>
    </div>
  );
}

function Card({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-serif text-2xl">{title}</h2>
        {extra}
      </div>
      {children}
    </article>
  );
}

function Overview({ view, stale }: { view: AccountingView; stale: boolean }) {
  const membershipCash = view.flow.monthlyCashCents + view.flow.annualCashCents + view.flow.lifetimeCashCents;
  const glance = [
    { name: "Membership income", cents: membershipCash, color: chartColors.terracotta },
    { name: "Referral", cents: view.allocation.referralCents, color: chartColors.sage },
    { name: "Contributor", cents: view.allocation.contributorCents, color: chartColors.golden },
    { name: "Platform", cents: view.allocation.platformCents, color: chartColors.sand },
    { name: "Expenses", cents: view.operatingCents, color: chartColors.ink },
  ];
  const kpis: { label: string; value: string; paid?: number; growth: number | null }[] = [
    { label: "Membership income", value: formatUsd(membershipCash), growth: null },
    {
      label: "Referral allocated",
      value: formatUsd(view.allocation.referralCents),
      paid: view.flow.referralPaidCents,
      growth: view.moneyGrowth.referral,
    },
    {
      label: "Contributor allocated",
      value: formatUsd(view.allocation.contributorCents),
      paid: view.flow.contributorPaidCents,
      growth: view.moneyGrowth.contributor,
    },
    { label: "Platform allocation", value: formatUsd(view.allocation.platformCents), growth: view.moneyGrowth.platform },
    { label: "Operating expenses", value: formatUsd(view.operatingCents), growth: view.moneyGrowth.expenses },
  ];

  return (
    <Card title="Overview">
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Membership cash, share pools, and expenses for {view.range.label}.
      </p>
      <div className="mt-4 min-w-0">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">Money at a glance</p>
        <div className="mt-2 grid items-center gap-6 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <Donut
            slices={glance}
            center={formatUsd(membershipCash)}
            label="Money at a glance for this range"
            empty="No money movement in this range."
          />
          <ul className="grid w-fit max-w-full grid-cols-[auto_auto] items-baseline gap-x-6 gap-y-3" aria-label="Money at a glance amounts">
            {glance.map((slice) => (
              <li key={slice.name} className="contents">
                <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="truncate">{slice.name}</span>
                </span>
                <span className="text-right text-sm font-medium tabular-nums text-foreground">{formatUsd(slice.cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="min-w-0 rounded-2xl border border-border bg-background/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">{kpi.label}</p>
              {stale && <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">Stale</span>}
            </div>
            <p className="mt-2 font-serif text-2xl tabular-nums">{kpi.value}</p>
            {kpi.paid !== undefined && <p className="mt-1 text-xs text-muted-foreground">Paid {formatUsd(kpi.paid)}</p>}
            {kpi.growth !== null && view.range.compareLabel && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Delta value={kpi.growth} /> vs {view.range.compareLabel}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Allocation({ view }: { view: AccountingView }) {
  const platformShare = DRAFT_POLICY.denominator - DRAFT_POLICY.referralNumerator - DRAFT_POLICY.contributorNumerator;
  const slices = [
    { name: `${DRAFT_POLICY.referralNumerator}% — Referral allocation`, cents: view.allocation.referralCents, color: chartColors.terracotta },
    { name: `${DRAFT_POLICY.contributorNumerator}% — Contributor allocation`, cents: view.allocation.contributorCents, color: chartColors.sage },
    { name: `${platformShare}% — Platform allocation`, cents: view.allocation.platformCents, color: chartColors.golden },
  ];
  return (
    <Card
      title="Allocation"
      extra={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">Estimated</span>
          
        </span>
      }
    >
      <Donut
        slices={slices}
        center={formatUsd(view.flow.eligibleCents)}
        label="Eligible membership revenue split into three pools"
        empty="No eligible membership revenue in this range, so there is nothing to allocate."
      />
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <Share
          color={chartColors.terracotta}
          label={`${DRAFT_POLICY.referralNumerator}% — Referral allocation`}
          part={view.allocation.referralCents}
          whole={view.flow.eligibleCents}
          paid={view.flow.referralPaidCents}
        />
        <Share
          color={chartColors.sage}
          label={`${DRAFT_POLICY.contributorNumerator}% — Contributor allocation`}
          part={view.allocation.contributorCents}
          whole={view.flow.eligibleCents}
          paid={view.flow.contributorPaidCents}
        />
        <Share
          color={chartColors.golden}
          label={`${platformShare}% — Platform allocation`}
          part={view.allocation.platformCents}
          whole={view.flow.eligibleCents}
        />
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        These percentages are the proposed split of eligible membership revenue, after discounts, refunds, chargebacks, and processing fees. They are not a split of all gross cash received.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{THRESHOLD_NOTE}</p>
    </Card>
  );
}

function Growth({ view, metric, onMetric }: { view: AccountingView; metric: GrowthId; onMetric: (metric: GrowthId) => void }) {
  const selected = growthMetrics.find((item) => item.id === metric)!;
  const data = growthData(view, metric);
  return (
    <Card
      title="Community growth"
      extra={
        <select
          aria-label="Chart metric"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
          value={metric}
          onChange={(event) => onMetric(event.target.value as GrowthId)}
        >
          {growthMetrics.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      }
    >
      {data.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Revenue growth needs an earlier month inside this range.</p>
      ) : (
        <Bars data={data} name={selected.label} color={chartColors.terracotta} money={selected.money} label={`${selected.label} for the selected range`} />
      )}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{view.runway.note}</p>
      {view.runway.months !== null && <p className="mt-1 text-sm text-muted-foreground">{view.runway.months} months of cash.</p>}
    </Card>
  );
}

function Glance({ view }: { view: AccountingView }) {
  const figures: { label: string; value: string; growth: number | null }[] = [
    { label: "Registered members", value: formatCount(view.community.registered), growth: view.community.growth.registered },
    { label: "Paying members", value: formatCount(view.community.paying), growth: view.community.growth.paying },
    { label: "Trial members", value: formatCount(view.community.trials), growth: view.community.growth.trials },
    { label: "Active members", value: formatCount(view.community.active), growth: null },
    { label: "New members", value: formatCount(view.community.newMembers), growth: view.community.growth.newMembers },
    { label: "Events created", value: formatCount(view.community.eventsCreated), growth: view.community.growth.eventsCreated },
    { label: "Events completed", value: formatCount(view.community.eventsCompleted), growth: null },
    { label: "Credits issued", value: formatCount(view.community.creditsIssued), growth: null },
    { label: "Referral earners", value: formatCount(view.community.referralEarners), growth: null },
    { label: "Contribution earners", value: formatCount(view.community.contributionEarners), growth: null },
  ];
  return (
    <Card title="Community">
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="text-xs tracking-[0.12em] text-foreground/60 uppercase">{figure.label}</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums">{figure.value}</dd>
            {figure.growth !== null && view.range.compareLabel && (
              <p className="text-sm text-foreground/60">
                <Delta value={figure.growth} />
              </p>
            )}
          </div>
        ))}
      </dl>
    </Card>
  );
}

function ReferralPerformance({ view }: { view: AccountingView }) {
  return (
    <Card title="Referral performance">
      <p className="mt-3 font-serif text-3xl tabular-nums">{formatUsd(view.allocation.referralCents)}</p>
      <p className="mt-1 text-sm text-muted-foreground">Allocated in {view.range.label}.</p>
      <p className="mt-1 text-sm text-muted-foreground">Paid {formatUsd(view.flow.referralPaidCents)}</p>
      {view.moneyGrowth.referral !== null && view.range.compareLabel && (
        <p className="mt-2 text-sm text-muted-foreground">
          <Delta value={view.moneyGrowth.referral} /> vs {view.range.compareLabel}
        </p>
      )}
      <dl className="mt-4 grid gap-3">
        {view.windows.map((window) => (
          <div key={window.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{window.label}</dt>
            <dd className="font-medium tabular-nums">{formatUsd(window.referralAllocatedCents)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Unpaid referral liability</dt>
          <dd className="font-medium tabular-nums">{formatUsd(view.liabilities.referralUnpaidCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Members earning referrals</dt>
          <dd className="font-medium tabular-nums">{formatCount(view.community.referralEarners)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Paying members acquired</dt>
          <dd className="font-medium tabular-nums">{formatCount(view.payingMembersAcquired)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-foreground/60">The unpaid liability is cumulative through the current snapshot.</p>
      <Bars
        data={view.series.map((point) => ({ label: point.label, value: point.referralCents }))}
        name="Referral pool"
        color={chartColors.terracotta}
        money
        label="Referral allocation by month"
      />
    </Card>
  );
}

function ContributionPerformance({ view }: { view: AccountingView }) {
  const unallocated = view.allocation.contributorCents - view.flow.contributorApprovedCents;
  return (
    <Card title="Contribution performance">
      <p className="mt-3 font-serif text-3xl tabular-nums">{formatUsd(view.allocation.contributorCents)}</p>
      <p className="mt-1 text-sm text-muted-foreground">Allocated in {view.range.label}. Points are not cash.</p>
      <dl className="mt-4 grid gap-3">
        {view.windows.map((window) => (
          <div key={window.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{window.label}</dt>
            <dd className="font-medium tabular-nums">{formatUsd(window.contributorAllocatedCents)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Approved</dt>
          <dd className="font-medium tabular-nums">{formatUsd(view.flow.contributorApprovedCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="font-medium tabular-nums">{formatUsd(view.flow.contributorPaidCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Unallocated</dt>
          <dd className="font-medium tabular-nums">{formatUsd(unallocated)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Eligible contributors</dt>
          <dd className="font-medium tabular-nums">{formatCount(view.community.contributionEarners)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Completed events</dt>
          <dd className="font-medium tabular-nums">{formatCount(view.community.eventsCompleted)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Contribution points</dt>
          <dd className="font-medium tabular-nums">{formatCount(view.flow.points)}</dd>
        </div>
      </dl>
      <Bars
        data={view.series.map((point) => ({ label: point.label, value: point.points }))}
        name="Points"
        color={chartColors.sage}
        money={false}
        label="Contribution points by month"
      />
    </Card>
  );
}

function Earners({ view }: { view: AccountingView }) {
  const hasEarners = view.leaderboard.length > 0;
  return (
    <Card
      title="Referral earners"
    >
      {hasEarners ? (
        <ol className="mt-4 grid gap-3">
          {view.leaderboard.map((row) => (
            <li key={row.rank} className="flex min-w-0 items-center gap-3 border-b border-border pb-3 text-sm last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium" aria-hidden="true">
                {row.initials ?? ""}
              </span>
              <span className="min-w-0">
                <span className="block">
                  <span className="text-muted-foreground">{row.rank}. </span>
                  {row.displayName}
                </span>
                <span className="text-foreground/60">{formatCount(row.referralCount)} referrals</span>
              </span>
              <span className="ml-auto shrink-0 tabular-nums">{formatUsd(row.earningsCents)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          No approved referral earnings in this range. 
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-foreground/60">First names of people who opted in. Everyone else is listed as an anonymous member.</p>
    </Card>
  );
}

function ExpenseSnapshot({ view }: { view: AccountingView }) {
  const operating = view.expenseLines
    .filter((line) => !line.bridge && line.actualCents > 0)
    .sort((left, right) => right.actualCents - left.actualCents);
  const colors = [chartColors.terracotta, chartColors.sage, chartColors.golden, chartColors.ink];
  const slices = operating.slice(0, 4).map((line, index) => ({ name: line.label, cents: line.actualCents, color: colors[index]! }));
  const other = operating.slice(4).reduce((total, line) => total + line.actualCents, 0);
  if (other > 0) slices.push({ name: "Other", cents: other, color: chartColors.sand });
  return (
    <Card title="Expenses">
      <Donut slices={slices} center={formatUsd(view.operatingCents)} label="Operating expenses by category" empty="No operating expenses in this range." />
      <p className="mt-3 text-sm text-muted-foreground">Operating total {formatUsd(view.operatingCents)}</p>
      {view.moneyGrowth.expenses !== null && view.range.compareLabel && (
        <p className="mt-1 text-sm text-muted-foreground">
          <Delta value={view.moneyGrowth.expenses} /> vs {view.range.compareLabel}
        </p>
      )}
    </Card>
  );
}

function CompanySnapshot({ view }: { view: AccountingView }) {
  const margin = view.recognized.totalCents === 0 ? "—" : `${Math.round((view.performance.ebitdaCents / view.recognized.totalCents) * 1000) / 10}%`;
  const rows = [
    ["Recognized revenue", formatUsd(view.recognized.totalCents)],
    ["Operating expenses", formatUsd(view.operatingCents)],
    ["EBITDA", formatSigned(view.performance.ebitdaCents)],
    ["Margin", margin],
    ["Closing cash", formatUsd(view.cash.closingCents)],
  ] as const;
  return (
    <Card title="Company">
      <dl className="mt-4 grid gap-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-serif text-xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Ownership({ view }: { view: AccountingView }) {
  const verified = view.ownership.filter((row) => row.status === "Verified");
  const issuedUnits = verified.reduce((total, row) => total + Number(row.units.replaceAll(",", "")), 0);
  return (
    <section id="ownership" className="rounded-2xl border border-border bg-card p-5"><h2 className="font-serif text-2xl">Company Ownership & Capitalization</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Only verified, legally finalized records count as current ownership. Equity grants and investment terms stay as an approved summary.
      </p>
      <p className="mt-5 text-xs font-medium tracking-[0.14em] text-primary uppercase">Total issued equity</p>
      <p className="mt-2 font-serif text-4xl tabular-nums">{formatCount(issuedUnits)} units</p>
      <p className="mt-1 text-sm text-muted-foreground">Counted from verified rows only.</p>

      <h3 className="mt-8 font-medium">Current ownership</h3>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {verified.map((row) => (
          <li key={row.name} className="min-w-0 rounded-2xl border border-border bg-muted/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{row.name}</p>
              <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">{row.status}</span>
            </div>
            <p className="mt-3 font-serif text-3xl tabular-nums">{row.share}</p>
            <p className="mt-1 text-sm text-muted-foreground">{row.units} units</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Distributions({ view }: { view: AccountingView }) {
  return (
    <Card title="Dividends">
      {view.dividends.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          No dividend has been declared. Forecast profit is not a distribution. 
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 text-sm">
          {view.dividends.map((row) => (
            <li key={row.id}>{formatUsd(row.cents)}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function truncateText(value: string | null | undefined, max = 140): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function reasonLabel(reason: string): string {
  return reason.replaceAll("_", " ");
}

function Participation({ view }: { view: AccountingView }) {
  const credits = [
    ["Issued", formatCount(view.community.creditsIssued)],
    ["Used", formatCount(view.flow.creditsRedeemed)],
  ] as const;
  const { homes, skills, creditReasons } = view.participation;
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <article className="min-w-0 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-2xl">Credits</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4">
          {credits.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs tracking-[0.12em] text-foreground/60 uppercase">{label}</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">A community credit is not cash and not a dollar liability.</p>
        {creditReasons.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No credit activity.</p>
        ) : (
          <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto text-sm">
            {creditReasons.map((row) => (
              <li key={row.reason} className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                <p className="font-medium capitalize text-foreground">{reasonLabel(row.reason)}</p>
                <p className="mt-1 text-muted-foreground">
                  Issued {formatCount(row.issued)} · Used {formatCount(row.used)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
      <article className="min-w-0 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-2xl">Homes</h2>
        <p className="mt-3 font-serif text-3xl tabular-nums">{formatCount(view.community.homes)}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {formatCount(view.community.hostingNights)} hosting nights and {formatCount(view.community.completedStays)} completed stays in this range.
        </p>
        {homes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No published homes yet.</p>
        ) : (
          <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto text-sm">
            {homes.map((home) => {
              const description = truncateText(home.description);
              return (
                <li key={home.id} className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                  <p className="font-medium text-foreground">{home.title}</p>
                  {home.locationText ? <p className="mt-1 text-xs text-muted-foreground">{home.locationText}</p> : null}
                  {description ? <p className="mt-1 leading-relaxed text-muted-foreground">{description}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </article>
      <article className="min-w-0 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-2xl">Skills</h2>
        <p className="mt-3 font-serif text-3xl tabular-nums">{formatCount(view.community.skillsOffered)}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{formatCount(view.community.skillExchanges)} exchanges in this range. Not cash earnings.</p>
        {skills.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No published skills yet.</p>
        ) : (
          <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto text-sm">
            {skills.map((skill) => {
              const description = truncateText(skill.description);
              const meta = [skill.category, skill.format?.replaceAll("_", " ")].filter(Boolean).join(" · ");
              return (
                <li key={skill.id} className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                  <p className="font-medium text-foreground">{skill.title}</p>
                  {meta ? <p className="mt-1 text-xs capitalize text-muted-foreground">{meta}</p> : null}
                  {description ? <p className="mt-1 leading-relaxed text-muted-foreground">{description}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}


function Expenses({ view }: { view: AccountingView }) {
  return (
    <section id="expenses" className="rounded-2xl border border-border bg-card p-5"><h2 className="font-serif text-2xl">Company expenses</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The same dates as the rest of this page. Processing fees and refunds are listed so they can be seen, and they are marked because they already reduced revenue.
        {view.flow.eligibleCents === 0 && view.operatingCents > 0 ? " This range is before membership income." : ""}
        {view.range.kind === "today" ? " Budgets are monthly, so Today has no budget comparison." : ""}
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Mini label="Operating expenses" value={formatUsd(view.operatingCents)} />
        <Mini label="Fixed" value={formatUsd(view.fixedCents)} />
        <Mini label="Variable" value={formatUsd(view.variableCents)} />
      </dl>
      <h3 className="mt-6 font-medium">Expenses by category</h3>
      <Bars
        data={[...view.expenseLines]
          .filter((line) => line.actualCents > 0)
          .sort((left, right) => right.actualCents - left.actualCents)
          .map((line) => ({ label: line.label.split(" ")[0] ?? line.label, value: line.actualCents }))}
        name="Actual"
        color={chartColors.sage}
        money
        label="Expenses by category"
      />
      <h3 className="mt-6 font-medium">Monthly expense trend</h3>
      <Bars
        data={view.series.map((point) => ({ label: point.label, value: point.expenseCents }))}
        name="Operating expenses"
        color={chartColors.terracotta}
        money
        label="Monthly expense trend"
      />
      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {view.expenseLines.map((line) => (
          <li key={line.id} className="rounded-2xl border border-border bg-background p-4 text-sm">
            <p className="font-medium break-words">
              {line.label}
              {line.bridge ? " · Already in the revenue bridge" : ""}
            </p>
            <p className="text-xs text-muted-foreground capitalize">{line.kind}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Actual</dt><dd>{formatUsd(line.actualCents)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Budget</dt><dd>{view.range.kind === "today" ? "—" : formatUsd(line.budgetCents)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Variance</dt><dd>{view.range.kind === "today" ? "—" : formatSigned(line.budgetCents - line.actualCents)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden max-w-full overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs tracking-[0.12em] text-primary uppercase">
            <tr>
              {["Category", "Kind", "Actual", "Budget", "Variance"].map((heading) => (
                <th key={heading} className="py-2 pr-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.expenseLines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="py-3 pr-3">
                  {line.label}
                  {line.bridge ? " · Already in the revenue bridge" : ""}
                </td>
                <td className="py-3 pr-3 capitalize">{line.kind}</td>
                <td className="py-3 pr-3">{formatUsd(line.actualCents)}</td>
                <td className="py-3 pr-3">{view.range.kind === "today" ? "—" : formatUsd(line.budgetCents)}</td>
                <td className="py-3 pr-3">{view.range.kind === "today" ? "—" : formatSigned(line.budgetCents - line.actualCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.range.kind !== "today" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Budget for operating costs {formatUsd(view.budgetOperatingCents)}. Actual operating costs {formatUsd(view.operatingCents)}.
        </p>
      )}
    </section>
  );
}

function Profit({ view }: { view: AccountingView }) {
  const rows = [
    ["Monthly memberships, recognized", formatUsd(view.recognized.monthlyCents)],
    ["Annual memberships, recognized", formatUsd(view.recognized.annualCents)],
    ["Lifetime memberships, recognized", formatUsd(view.recognized.lifetimeCents)],
    ["Other revenue", formatUsd(view.recognized.otherCents)],
    ["Total recognized revenue", formatUsd(view.recognized.totalCents)],
    ["Membership cash receipts", formatUsd(view.flow.monthlyCashCents + view.flow.annualCashCents + view.flow.lifetimeCashCents)],
    ["Cost of services", formatSigned(-view.performance.costOfServicesCents)],
    ["Gross profit", formatSigned(view.performance.grossProfitCents)],
    ["Payroll and contractors", formatSigned(-view.performance.payrollCents)],
    ["Technology", formatSigned(-view.performance.technologyCents)],
    ["Marketing", formatSigned(-view.performance.marketingCents)],
    ["Administration", formatSigned(-view.performance.administrationCents)],
    ["Referral rewards paid", formatSigned(-view.performance.referralPaidCents)],
    ["Contributor rewards paid", formatSigned(-view.performance.contributorPaidCents)],
    ["Other operating costs", formatSigned(-view.performance.otherCents)],
    ["Payment processing fees", formatSigned(-view.performance.processingFeeCents)],
    ["EBITDA", formatSigned(view.performance.ebitdaCents)],
    ["Depreciation and amortization", formatSigned(-view.performance.depreciationCents)],
    ["Interest", formatSigned(-view.performance.interestCents)],
    ["Taxes", formatSigned(-view.performance.taxCents)],
    ["Net profit or loss", formatSigned(view.performance.netCents)],
  ];
  return (
    <section id="profit" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-2xl">Profit and loss</h2>
        <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">Actual</span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Annual and lifetime cash is recognized over {12} and {60} months. Cash received and revenue earned are different lines. The 50/25/25
        split is not deducted again here. Refunds and chargebacks already reduced membership cash.
      </p>
      <dl className="mt-4 divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-3 text-sm">
            <dt>{label}</dt>
            <dd className="font-serif text-2xl tabular-nums">{value}</dd>
          </div>
        ))}
        {view.performance.forecastRecognizedCents !== null && (
          <div className="flex items-baseline justify-between gap-4 py-3 text-sm">
            <dt>Forecast recognized revenue · not actual</dt>
            <dd className="font-serif text-2xl">{formatUsd(view.performance.forecastRecognizedCents)}</dd>
          </div>
        )}
        {view.performance.forecastExpenseCents !== null && (
          <div className="flex items-baseline justify-between gap-4 py-3 text-sm">
            <dt>Forecast expenses · not actual</dt>
            <dd className="font-serif text-2xl">{formatUsd(view.performance.forecastExpenseCents)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Mini label="Opening cash" value={formatUsd(view.cash.openingCents)} />
        <Mini label="Cash movement" value={formatSigned(view.cash.receiptsCents - view.cash.outflowsCents)} />
        <Mini label="Closing cash" value={formatUsd(view.cash.closingCents)} />
      </div>
    </section>
  );
}

function growthData(view: AccountingView, metric: GrowthId): { label: string; value: number }[] {
  if (metric === "growth") {
    return view.series.slice(1).flatMap((point, index) => {
      const previous = view.series[index]?.eligibleCents ?? null;
      const percent = growthPercent(point.eligibleCents, previous);
      if (percent === null) return [];
      return [{ label: point.label, value: percent }];
    });
  }
  return view.series.map((point) => {
    const value = {
      members: point.members,
      paying: point.paying,
      revenue: point.eligibleCents,
      mrr: point.mrrCents,
      expenses: point.expenseCents,
      net: point.netCents,
      growth: 0,
    }[metric];
    return { label: point.label, value };
  });
}

function Ledger({
  rows,
  type,
  query,
  page,
  onType,
  onQuery,
  onPage,
}: {
  rows: LedgerRow[];
  type: string;
  query: string;
  page: number;
  onType: (value: string) => void;
  onQuery: (value: string) => void;
  onPage: (page: number) => void;
}) {
  const types = useMemo(() => ["All", ...new Set(rows.map((row) => row.type))], [rows]);
  const filtered = rows.filter((row) => {
    const matchesType = type === "All" || row.type === type;
    const haystack = `${row.reference} ${row.category} ${row.type}`.toLowerCase();
    return matchesType && haystack.includes(query.trim().toLowerCase());
  });
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <section id="ledger" className="rounded-2xl border border-border bg-card p-5"><h2 className="font-serif text-2xl">Transaction ledger</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Aggregated rows. No card numbers, bank details, or another member’s balance. A correction stays beside the original row.{" "}
        
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 text-sm">
          Type
          <select
            className="mt-1 block rounded-full border border-border bg-background px-4 py-2"
            value={type}
            onChange={(event) => onType(event.target.value)}
          >
            {types.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Search
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="mt-1 block rounded-full border border-border bg-background px-4 py-2"
            placeholder="Reference or category"
          />
        </label>
      </div>
      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {visible.length === 0 && <li className="py-4 text-sm text-muted-foreground">No transactions in this filter.</li>}
        {visible.map((row) => (
          <li key={row.id} className="rounded-2xl border border-border bg-background p-4 text-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="font-medium">{row.type}</p>
                <p className="text-xs text-muted-foreground">{formatIsoDate(row.date)} · {row.category}</p>
              </div>
              <p className="shrink-0 font-medium">{formatSigned(row.netCents)}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Gross</dt><dd>{formatSigned(row.grossCents)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Fees</dt><dd>{formatSigned(row.feeCents)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Allocation</dt><dd>{row.allocation}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Settlement</dt><dd>{row.settlement} · {row.source}</dd></div>
            </dl>
            <p className="mt-2 truncate text-xs text-muted-foreground">Ref {row.reference}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden max-w-full overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs tracking-[0.12em] text-primary uppercase">
            <tr>
              {["Date", "Type", "Reference", "Category", "Gross", "Fees", "Net", "Allocation", "Settlement", "Source"].map((heading) => (
                <th key={heading} className="py-2 pr-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="py-4 text-muted-foreground">
                  No transactions in this filter.
                </td>
              </tr>
            )}
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="py-3 pr-3">{formatIsoDate(row.date)}</td>
                <td className="py-3 pr-3">{row.type}</td>
                <td className="py-3 pr-3">{row.reference}</td>
                <td className="py-3 pr-3">{row.category}</td>
                <td className="py-3 pr-3">{formatSigned(row.grossCents)}</td>
                <td className="py-3 pr-3">{formatSigned(row.feeCents)}</td>
                <td className="py-3 pr-3">{formatSigned(row.netCents)}</td>
                <td className="py-3 pr-3">{row.allocation}</td>
                <td className="py-3 pr-3">{row.settlement}</td>
                <td className="py-3 pr-3">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <button type="button" className={cn("rounded-full bg-secondary px-4 py-2 ")} disabled={safePage === 0} onClick={() => onPage(safePage - 1)}>
          Previous
        </button>
        <p>
          Page {safePage + 1} of {pages}
        </p>
        <button
          type="button"
          className={cn("rounded-full bg-secondary px-4 py-2 ")}
          disabled={safePage >= pages - 1}
          onClick={() => onPage(safePage + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

function Controls({ view }: { view: AccountingView }) {
  const glossary = [
    ["Estimated", "A calculated allocation. It can change when a policy is adopted."],
    ["Approved", "An amount accepted and not yet paid."],
    ["Paid", "Cash recorded as disbursed."],
    ["Advance", "Cash paid ahead of an approved earning, to be offset later."],
    ["Deduction", "An agreed reduction of the member balance."],
    ["Deferred", "Cash collected for a membership that is not yet recognized as revenue."],
    ["Community credit", "A participation count. Not a dollar and not a financial liability."],
    ["Reconciled", "Tied to a source report by finance. Nothing on this screen is reconciled."],
  ];
  return (
    <section id="controls" className="rounded-2xl border border-border bg-card p-5"><h2 className="font-serif text-2xl">Financial controls and glossary</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Estimated, approved, and published stay separate. No statement has a publication date.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Mini label="Membership receipts" value="Not reconciled" />
        <Mini label="Expenses" value="Reviewed expense sheet" />
        <Mini label="Deferred revenue" value={formatUsd(view.deferred.totalCents)} />
        <Mini label="Unpaid referral liability" value={formatUsd(view.liabilities.referralUnpaidCents)} />
        <Mini label="Unpaid contributor liability" value={formatUsd(view.liabilities.contributorUnpaidCents)} />
        <Mini label="Accounts payable" value={formatUsd(view.liabilities.payableCents)} />
        <Mini label="Accounts receivable" value={formatUsd(view.liabilities.receivableCents)} />
        <Mini label="Tax provision in this range" value={formatUsd(view.flow.taxProvisionCents)} />
        <Mini label="Refunds and chargebacks" value={formatUsd(view.flow.refundCents + view.flow.chargebackCents)} />
        <Mini label="Publication date" value="Not published" />
      </dl>
      <div className="mt-6 grid gap-3">
        {glossary.map(([term, meaning]) => (
          <div key={term} className="rounded-2xl border border-border px-4 py-3">
            <p className="font-medium">{term}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{meaning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilterButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("shrink-0 rounded-full px-4 py-2 text-sm", pressed ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}
    >
      {children}
    </button>
  );
}

function Share({ color, label, part, whole, paid }: { color: string; label: string; part: number; whole: number; paid?: number }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: color }} />
      <span>
        <span className="block font-medium">
          {label} {formatShare(part, whole)} · {formatUsd(part)}
        </span>
        {paid !== undefined && <span className="text-muted-foreground">Paid in this range {formatUsd(paid)}</span>}
      </span>
    </li>
  );
}

function Delta({ value }: { value: number | null }) {
  const text = formatGrowth(value);
  if (!text || value === null) return null;
  return (
    <span className="text-sm text-muted-foreground">
      {value > 0 ? "↑" : value < 0 ? "↓" : ""} {text}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">{label}</dt>
      <dd className="mt-1 font-serif text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function StripeCheckNote({ check }: { check: { checkedAt: string | null; unmatched: number; ok: boolean } | undefined }) {
  if (!check) return null;
  const time = check.checkedAt
    ? new Date(check.checkedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;
  if (!check.ok) {
    return <p className="text-xs">Stripe check unavailable{time ? ` · last matched ${time}` : ""} · showing recorded figures</p>;
  }
  return (
    <p className="text-xs">
      Matched with Stripe{time ? ` · ${time}` : ""}
      {check.unmatched > 0 ? ` · ${check.unmatched} payment${check.unmatched === 1 ? "" : "s"} need a member match` : ""}
    </p>
  );
}
