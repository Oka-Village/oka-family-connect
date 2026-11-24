import { useMemo, useState, type ReactNode } from "react";

import {
  creditsForEvent,
  facilitatorName,
  loadEventPointsSample,
  type EventPointsSampleBundle,
  type StatementAdjustment,
} from "@/data/open-accounting/event-points-sample";
import {
  ACCOUNTING_TIMEZONE,
  EVENT_POINTS_RULES,
  pointsActionLabels,
  scoreReviewResponse,
  validateReviewResponse,
  type EventPointTotals,
  type EventReviewResponse,
  type FacilitatorCredit,
  type MonthStatement,
} from "@/lib/open-accounting/event-points";
import { formatCount, formatShare, formatUsd } from "@/lib/open-accounting/format";
import { monthLabel } from "@/lib/open-accounting/allocate";
import { cn } from "@/lib/utils";

type SubView = "community" | "earnings" | "review";

const REVIEW_DEMO_MEMBER = "demo-reviewer";
const REVIEW_DEMO_EVENT_ID = "dec-c1";

export function OpenAccountingEventPoints() {
  const bundle = useMemo(() => loadEventPointsSample(), []);
  const [subView, setSubView] = useState<SubView>("community");
  const [monthId, setMonthId] = useState(bundle.months.find((m) => m.monthId === "2026-11")?.monthId ?? bundle.months[0]!.monthId);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(bundle.featuredEventId);
  const [earningsFacilitatorId, setEarningsFacilitatorId] = useState(bundle.defaultEarningsFacilitatorId);
  const [finalizedOverrides, setFinalizedOverrides] = useState<Record<string, MonthStatement["status"]>>({});
  const [finalizeNote, setFinalizeNote] = useState<string | null>(null);

  const baseStatement = bundle.months.find((month) => month.monthId === monthId) ?? bundle.months[0]!;
  const statement: MonthStatement = {
    ...baseStatement,
    status: finalizedOverrides[baseStatement.monthId] ?? baseStatement.status,
  };

  const selectedEvent = resolveSelectedEvent(bundle, statement, selectedEventId);
  const leaders = statement.leaderFacilitatorIds.map((id) => facilitatorName(bundle, id)).join(", ");
  const allocatedCents = statement.allocations.reduce((sum, row) => sum + row.allocatedCents, 0);
  const monthAdjustments = bundle.adjustments.filter((row) => row.monthId === statement.monthId);

  function simulateFinalize() {
    if (statement.status === "finalized") {
      setFinalizeNote("This month is already closed. Trying again does not create a second payout.");
      return;
    }
    setFinalizedOverrides((prev) => ({ ...prev, [statement.monthId]: "finalized" }));
    setFinalizeNote(`${monthLabel(statement.monthId)} is now closed for this demo. The locked totals stay as they are.`);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-label">Prototype</p>
            <h2 className="mt-1 font-serif text-2xl">Event points & facilitator earnings</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Sample months for the proposed per-member scoring model (up to {EVENT_POINTS_RULES.maxPerMemberPerEvent}{" "}
              points) and a {EVENT_POINTS_RULES.poolPercent}% facilitator pool. An event counts in the month it ends,
              using Thailand time. Fixture and local state only — live Books, My Earnings payouts, notifications, and
              event pages are unchanged.
            </p>
          </div>
          <StatusBadge status={statement.status} />
        </div>

        <div className="mt-5 flex min-w-0 gap-2 no-scrollbar overflow-x-auto" role="tablist" aria-label="Prototype views">
          {(
            [
              ["community", "Community month"],
              ["earnings", "My Earnings demo"],
              ["review", "Review form demo"],
            ] as const
          ).map(([id, label]) => (
            <FilterButton key={id} pressed={subView === id} onClick={() => setSubView(id)}>
              {label}
            </FilterButton>
          ))}
        </div>

        {subView !== "review" && (
          <>
            <div className="mt-4 flex min-w-0 gap-2 no-scrollbar overflow-x-auto" role="group" aria-label="Sample accounting month">
              {bundle.months.map((month) => {
                const status = finalizedOverrides[month.monthId] ?? month.status;
                return (
                  <FilterButton
                    key={month.monthId}
                    pressed={month.monthId === statement.monthId}
                    onClick={() => {
                      setMonthId(month.monthId);
                      setSelectedEventId(null);
                      setFinalizeNote(null);
                    }}
                  >
                    {monthLabel(month.monthId)}
                    {status === "provisional" ? " · Provisional" : ""}
                  </FilterButton>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimate updated {formatUpdatedAt(statement.updatedAt)} · Rules {statement.rulesVersion}
              {statement.status === "provisional" ? " · Review window still open" : " · Month closed for sample"}
            </p>
          </>
        )}
      </div>

      {subView === "community" && (
        <CommunityView
          bundle={bundle}
          statement={statement}
          leaders={leaders || "—"}
          allocatedCents={allocatedCents}
          selectedEvent={selectedEvent}
          onSelectEvent={setSelectedEventId}
          adjustments={monthAdjustments}
          onFinalize={simulateFinalize}
          finalizeNote={finalizeNote}
        />
      )}

      {subView === "earnings" && (
        <EarningsDemoView
          bundle={bundle}
          statement={statement}
          facilitatorId={earningsFacilitatorId}
          onFacilitator={setEarningsFacilitatorId}
        />
      )}

      {subView === "review" && <ReviewFormDemo />}
    </div>
  );
}

function CommunityView({
  bundle,
  statement,
  leaders,
  allocatedCents,
  selectedEvent,
  onSelectEvent,
  adjustments,
  onFinalize,
  finalizeNote,
}: {
  bundle: EventPointsSampleBundle;
  statement: MonthStatement;
  leaders: string;
  allocatedCents: number;
  selectedEvent: EventPointTotals | null;
  onSelectEvent: (id: string) => void;
  adjustments: StatementAdjustment[];
  onFinalize: () => void;
  finalizeNote: string | null;
}) {
  return (
    <>
      <MonthSummary statement={statement} leaders={leaders} allocatedCents={allocatedCents} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <FacilitatorBreakdown statement={statement} nameOf={(id) => facilitatorName(bundle, id)} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <RulesPanel />
        </div>
      </div>

      <EventBrowser
        bundle={bundle}
        statement={statement}
        selectedEvent={selectedEvent}
        onSelect={onSelectEvent}
        nameOf={(id) => facilitatorName(bundle, id)}
        hostCredits={creditsForEvent(bundle, selectedEvent)}
      />

      <MonthClosePanel statement={statement} onFinalize={onFinalize} note={finalizeNote} adjustments={adjustments} />

      <EdgeCases cases={bundle.edgeCases} />
    </>
  );
}

function MonthSummary({
  statement,
  leaders,
  allocatedCents,
}: {
  statement: MonthStatement;
  leaders: string;
  allocatedCents: number;
}) {
  const figures = [
    { label: "Eligible events held", value: formatCount(statement.eligibleEventCount) },
    { label: "Total points", value: formatCount(statement.totalEventPoints) },
    { label: "Points leader", value: leaders },
    { label: "Eligible revenue", value: formatUsd(statement.eligibleRevenueCents) },
    { label: `${EVENT_POINTS_RULES.poolPercent}% facilitator pool`, value: formatUsd(statement.facilitatorPoolCents) },
    { label: "Amount allocated", value: formatUsd(allocatedCents) },
    { label: "Undistributed balance", value: formatUsd(statement.undistributedCents) },
  ];

  return (
    <Card title="Open Accounting · Month">
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className="text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">{figure.label}</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
      {statement.undistributedCents > 0 && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This sample month has no eligible points, so the pool is held undistributed. Finance still decides whether a live
          zero-point pool carries forward or waits for a manual decision.
        </p>
      )}
    </Card>
  );
}

function MonthClosePanel({
  statement,
  onFinalize,
  note,
  adjustments,
}: {
  statement: MonthStatement;
  onFinalize: () => void;
  note: string | null;
  adjustments: StatementAdjustment[];
}) {
  const isOpen = statement.status === "provisional";

  return (
    <Card title="Closing the month">
      <p className="mt-1 text-xs text-muted-foreground">Prototype demo — does not lock live payouts</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        While the month is open, numbers can still change (reviews, points, revenue). After the review window, Oka locks
        that month’s statement. Later fixes do not erase the locked statement — they show as separate notes.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="list" aria-label="Month status">
        <div
          role="listitem"
          className={cn(
            "rounded-2xl border px-4 py-3",
            isOpen ? "border-transparent bg-secondary" : "border-border bg-background",
          )}
        >
          <p className="font-medium">Open (draft)</p>
          <p className="mt-1 text-sm text-muted-foreground">Numbers can still change</p>
        </div>
        <div
          role="listitem"
          className={cn(
            "rounded-2xl border px-4 py-3",
            !isOpen ? "border-transparent bg-secondary" : "border-border bg-background",
          )}
        >
          <p className="font-medium">Closed (final)</p>
          <p className="mt-1 text-sm text-muted-foreground">Month locked for this sample</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onFinalize}
          className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {isOpen ? "Close this month (demo)" : "Try close again (demo)"}
        </button>
      </div>
      {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
      {!isOpen && !note && (
        <p className="mt-3 text-sm text-muted-foreground">
          Closing again does not create a second payout.
        </p>
      )}

      {adjustments.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">Later corrections</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Original locked totals stay; these are extra notes after close.
          </p>
          <ul className="mt-3 space-y-3">
            {adjustments.map((row) => (
              <li key={row.id} className="rounded-2xl border border-border bg-background p-4 text-sm">
                <p className="font-medium">{adjustmentTitle(row.kind)}</p>
                <p className="mt-1 text-muted-foreground">{row.reason}</p>
                {row.amountCents !== 0 && (
                  <p className="mt-2 tabular-nums">{formatUsd(row.amountCents)}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function adjustmentTitle(kind: StatementAdjustment["kind"]): string {
  switch (kind) {
    case "late_refund":
      return "Refund after close";
    case "points_correction":
      return "Attendance fix";
    case "chargeback":
      return "Chargeback after close";
  }
}

function FacilitatorBreakdown({
  statement,
  nameOf,
}: {
  statement: MonthStatement;
  nameOf: (id: string) => string;
}) {
  return (
    <Card title="Facilitator breakdown">
      <p className="mt-2 text-sm text-muted-foreground">
        Aggregate credited points and allocated share. Individual attendee responses stay in private views.
      </p>
      {statement.allocations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No facilitator allocations for this month.</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3 md:hidden">
            {statement.allocations.map((row) => (
              <li key={row.facilitatorId} className="rounded-2xl border border-border bg-background p-4 text-sm">
                <p className="font-medium">{nameOf(row.facilitatorId)}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Points</dt>
                    <dd className="tabular-nums">{formatCount(row.points)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Share</dt>
                    <dd className="tabular-nums">{formatPercent(row.shareOfPoints)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Allocated</dt>
                    <dd className="font-medium tabular-nums">{formatUsd(row.allocatedCents)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs tracking-[0.12em] text-primary uppercase">
                <tr>
                  {["Facilitator", "Credited points", "Share of points", "Amount allocated"].map((heading) => (
                    <th key={heading} className="py-2 pr-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statement.allocations.map((row) => (
                  <tr key={row.facilitatorId} className="border-t border-border">
                    <td className="py-3 pr-3 font-medium">{nameOf(row.facilitatorId)}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatCount(row.points)}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatPercent(row.shareOfPoints)}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatUsd(row.allocatedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function EventBrowser({
  bundle,
  statement,
  selectedEvent,
  onSelect,
  nameOf,
  hostCredits,
}: {
  bundle: EventPointsSampleBundle;
  statement: MonthStatement;
  selectedEvent: EventPointTotals | null;
  onSelect: (id: string) => void;
  nameOf: (id: string) => string;
  hostCredits: FacilitatorCredit[];
}) {
  const list =
    statement.monthId === "2026-11"
      ? [...statement.events, bundle.demoEvent, bundle.cohostEvent]
      : statement.events;

  return (
    <Card title="Open Accounting · Event">
      <p className="mt-2 text-sm text-muted-foreground">
        Event metrics, points by action, and facilitator credit. November also lists edge-demo and co-host samples that stay
        outside the $2,500 example totals.
      </p>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No eligible events in this sample month.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
            {list.map((event) => (
              <li key={event.eventId}>
                <button
                  type="button"
                  onClick={() => onSelect(event.eventId)}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-3 text-left text-sm",
                    selectedEvent?.eventId === event.eventId
                      ? "border-transparent bg-secondary text-secondary-foreground"
                      : "border-border text-foreground",
                  )}
                >
                  <span className="block font-medium">{event.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                    {formatCount(event.totalEventPoints)} pts
                    {event.eventId === bundle.demoEvent.eventId ? " · edge demo" : ""}
                    {event.eventId === bundle.cohostEvent.eventId ? " · co-host" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              hostCredits={hostCredits}
              nameOf={nameOf}
              shareDemos={
                selectedEvent.eventId === bundle.demoEvent.eventId ? bundle.shareActionDemos : []
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Choose an event.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function EventDetail({
  event,
  hostCredits,
  nameOf,
  shareDemos,
}: {
  event: EventPointTotals;
  hostCredits: FacilitatorCredit[];
  nameOf: (id: string) => string;
  shareDemos: EventPointsSampleBundle["shareActionDemos"];
}) {
  const metrics = [
    { label: "Unique RSVPs", value: formatCount(event.uniqueRsvps) },
    { label: "Verified attendees", value: formatCount(event.verifiedAttendees) },
    { label: "Completions", value: formatCount(event.completions) },
    { label: "Rating count", value: formatCount(event.ratingCount) },
    { label: "Average rating", value: event.averageRating === null ? "—" : event.averageRating.toFixed(1) },
    { label: "Written reviews", value: formatCount(event.writtenReviewCount) },
    { label: "Members who shared", value: formatCount(event.uniqueSharers) },
    { label: "Total event points", value: formatCount(event.totalEventPoints) },
  ];

  const byAction = [
    { label: "RSVP points", value: event.pointsByAction.rsvp },
    { label: "Attendance points", value: event.pointsByAction.attend },
    { label: "Completion points", value: event.pointsByAction.complete },
    { label: "Rating points", value: event.pointsByAction.rating },
    { label: "Written review points", value: event.pointsByAction.writtenReview },
    { label: "Share points", value: event.pointsByAction.share },
  ];

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="font-serif text-xl">{event.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Accounting month {monthLabel(event.monthId)}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-5 text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">Points by action</h4>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {byAction.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums">{formatCount(row.value)}</span>
          </li>
        ))}
      </ul>

      {hostCredits.length > 0 && (
        <>
          <h4 className="mt-5 text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">Facilitator credit</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {hostCredits.map((credit) => (
              <li key={credit.facilitatorId} className="flex items-center justify-between gap-3">
                <span>
                  {nameOf(credit.facilitatorId)}
                  <span className="text-muted-foreground"> · {credit.shareBps / 100}%</span>
                </span>
                <span className="tabular-nums">{formatCount(credit.points)} pts</span>
              </li>
            ))}
          </ul>
          {hostCredits.length > 1 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Event counted once at {formatCount(event.totalEventPoints)} points; credits split across co-hosts.
            </p>
          )}
        </>
      )}

      {shareDemos.length > 0 && (
        <>
          <h4 className="mt-5 text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">
            Unique share keys
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            One recorded share per signed-in member per event. Extra clicks do not inflate points.
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {shareDemos.map((row) => (
              <li key={row.recordedKey} className="rounded-xl border border-border px-3 py-2">
                <p className="font-mono text-xs break-all">{row.recordedKey}</p>
                <p className="mt-1 text-muted-foreground">
                  {row.attemptCount} attempt{row.attemptCount === 1 ? "" : "s"} · {row.pointsAwarded} pt awarded
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EarningsDemoView({
  bundle,
  statement,
  facilitatorId,
  onFacilitator,
}: {
  bundle: EventPointsSampleBundle;
  statement: MonthStatement;
  facilitatorId: string;
  onFacilitator: (id: string) => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const allocation = statement.allocations.find((row) => row.facilitatorId === facilitatorId);
  const advance = bundle.advances.find((row) => row.facilitatorId === facilitatorId);
  const grossCents = allocation?.allocatedCents ?? 0;
  const advanceCents = advance?.advanceCents ?? 0;
  const remainingCents = Math.max(0, grossCents - advanceCents);
  const payoutStatus = bundle.payoutStatusByFacilitator[facilitatorId] ?? "pending";

  const hostedEvents = statement.events.filter((event) => event.hostId === facilitatorId);
  const cohostExtra =
    statement.monthId === "2026-11" &&
    bundle.cohostCredits.some((credit) => credit.facilitatorId === facilitatorId)
      ? [bundle.cohostEvent]
      : [];
  const eventsForFacilitator = [
    ...hostedEvents,
    ...cohostExtra.filter((event) => !hostedEvents.some((hosted) => hosted.eventId === event.eventId)),
  ];

  const creditedPoints =
    (allocation?.points ?? 0) +
    (statement.monthId === "2026-11"
      ? bundle.cohostCredits.filter((credit) => credit.facilitatorId === facilitatorId).reduce((sum, credit) => sum + credit.points, 0)
      : 0);

  // Statement allocation only so the November $2,500 example stays exact; co-host is event-detail only.
  const displayPoints = allocation?.points ?? 0;
  const displayShare = allocation?.shareOfPoints ?? 0;

  const selectedEvent =
    eventsForFacilitator.find((event) => event.eventId === selectedEventId) ?? eventsForFacilitator[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card title="My Earnings · Month">
        <p className="mt-2 text-sm text-muted-foreground">
          Fixture view for a sample facilitator. Same statement math as Open Accounting community figures for this month.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {bundle.facilitators.map((person) => (
            <FilterButton
              key={person.id}
              pressed={person.id === facilitatorId}
              onClick={() => {
                onFacilitator(person.id);
                setSelectedEventId(null);
              }}
            >
              {person.displayName}
            </FilterButton>
          ))}
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Events hosted" value={formatCount(hostedEvents.length)} />
          <Stat label="Credited points" value={formatCount(displayPoints)} />
          <Stat label="Share of all points" value={formatPercent(displayShare)} />
          <Stat
            label={statement.status === "provisional" ? "Estimated earnings" : "Finalized earnings"}
            value={formatUsd(grossCents)}
          />
          <Stat label="Gross earnings" value={formatUsd(grossCents)} />
          <Stat label="Advance applied" value={formatUsd(advanceCents)} />
          <Stat label="Remaining payable" value={formatUsd(remainingCents)} />
          <Stat label="Payout status" value={payoutStatus} />
        </dl>
        {advance && (
          <p className="mt-4 text-sm text-muted-foreground">
            {advance.note} Gross stays visible so the facilitator can see the full value earned by their events.
          </p>
        )}
        {creditedPoints !== displayPoints && statement.monthId === "2026-11" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Co-host demo credits ({formatCount(creditedPoints - displayPoints)} pts) are shown on the event detail only so
            the November $2,500 example stays exact.
          </p>
        )}
      </Card>

      <Card title="My Earnings · Event">
        {eventsForFacilitator.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No hosted events for this facilitator in the sample month.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
              {eventsForFacilitator.map((event) => (
                <li key={event.eventId}>
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(event.eventId)}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left text-sm",
                      selectedEvent?.eventId === event.eventId
                        ? "border-transparent bg-secondary text-secondary-foreground"
                        : "border-border text-foreground",
                    )}
                  >
                    <span className="block font-medium">{event.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                      {formatCount(event.totalEventPoints)} pts
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selectedEvent ? (
              <EventDetail
                event={selectedEvent}
                hostCredits={creditsForEvent(bundle, selectedEvent).filter(
                  (credit) =>
                    credit.facilitatorId === facilitatorId || selectedEvent.eventId === bundle.cohostEvent.eventId,
                )}
                nameOf={(id) => facilitatorName(bundle, id)}
                shareDemos={[]}
              />
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

const REVIEW_DEMO_SAVED: EventReviewResponse = {
  eventId: REVIEW_DEMO_EVENT_ID,
  memberId: REVIEW_DEMO_MEMBER,
  selfReportedAttended: true,
  completed: true,
  rating: 4,
  comment: "Felt welcomed and clear.",
  shared: true,
  rsvp: true,
};

/** Earlier 3-star answer without share — for Previous saved demo. */
const REVIEW_DEMO_PREVIOUS_POINTS = 11;

function ReviewFormDemo() {
  const verifiedAttended = true;
  const [saved, setSaved] = useState<EventReviewResponse | null>(REVIEW_DEMO_SAVED);
  const [previousPoints, setPreviousPoints] = useState<number | null>(REVIEW_DEMO_PREVIOUS_POINTS);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventReviewResponse>({ ...REVIEW_DEMO_SAVED });

  const liveScore = scoreReviewResponse(draft, {
    verifiedAttended,
    creditedFacilitatorIds: ["C"],
  });

  function save() {
    const problem = validateReviewResponse(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setPreviousPoints(
      saved ? scoreReviewResponse(saved, { verifiedAttended, creditedFacilitatorIds: ["C"] }).totalPoints : null,
    );
    setSaved({ ...draft, comment: draft.comment.trim() });
    setError(null);
  }

  const savedScore = saved
    ? scoreReviewResponse(saved, { verifiedAttended, creditedFacilitatorIds: ["C"] })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Card title="After the event — feedback form">
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          After an event ends, members get a form (bell and email would open it later). This page is a demo only — no real
          message is sent. One answer per member; editing updates the same answer and recalculates points.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Trying as: Year-End Listening · {REVIEW_DEMO_MEMBER}</p>

        <div className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">1. Were you there?</legend>
            <div className="mt-2 flex gap-2">
              <FilterButton
                pressed={draft.selfReportedAttended === true}
                onClick={() => setDraft((d) => ({ ...d, selfReportedAttended: true }))}
              >
                Yes
              </FilterButton>
              <FilterButton
                pressed={draft.selfReportedAttended === false}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    selfReportedAttended: false,
                    completed: null,
                    rating: null,
                    comment: "",
                  }))
                }
              >
                No
              </FilterButton>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              No ends the form. Your answer here is separate from what staff marked for attendance.
            </p>
          </fieldset>

          {draft.selfReportedAttended === true && (
            <>
              <fieldset>
                <legend className="text-sm font-medium">2. Did you finish the session?</legend>
                <div className="mt-2 flex gap-2">
                  <FilterButton
                    pressed={draft.completed === true}
                    onClick={() => setDraft((d) => ({ ...d, completed: true }))}
                  >
                    Yes
                  </FilterButton>
                  <FilterButton
                    pressed={draft.completed === false}
                    onClick={() => setDraft((d) => ({ ...d, completed: false }))}
                  >
                    No
                  </FilterButton>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium">3. Stars (optional)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FilterButton
                      key={star}
                      pressed={draft.rating === star}
                      onClick={() => setDraft((d) => ({ ...d, rating: star }))}
                    >
                      {star}★
                    </FilterButton>
                  ))}
                  <FilterButton
                    pressed={draft.rating === null}
                    onClick={() => setDraft((d) => ({ ...d, rating: null }))}
                  >
                    Clear
                  </FilterButton>
                </div>
              </fieldset>

              <label className="block text-sm font-medium">
                4. Note to the facilitator (optional)
                <textarea
                  className="mt-2 min-h-24 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  value={draft.comment}
                  onChange={(event) => setDraft((d) => ({ ...d, comment: event.target.value }))}
                  placeholder="If you write a note, pick stars too"
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.shared}
                  onChange={(event) => setDraft((d) => ({ ...d, shared: event.target.checked }))}
                />
                5. I shared this event
              </label>
            </>
          )}

          {draft.selfReportedAttended === false && (
            <p className="text-sm text-muted-foreground">You chose No, so the form stops here. Your answer can still be saved.</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            {saved ? "Update my answer" : "Save my answer"}
          </button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>

      <Card title="Points for this answer">
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Current draft" value={formatCount(liveScore.totalPoints)} />
          <Stat label="Saved answer" value={savedScore ? formatCount(savedScore.totalPoints) : "—"} />
          <Stat label="Previous saved" value={previousPoints === null ? "—" : formatCount(previousPoints)} />
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Updating replaces the same answer. Points are recalculated — you do not get a second award.
        </p>
      </Card>
    </div>
  );
}

function RulesPanel() {
  const rows = pointsActionLabels();
  return (
    <Card title="Point rules">
      <p className="mt-2 text-sm text-muted-foreground">
        Maximum {EVENT_POINTS_RULES.maxPerMemberPerEvent} points per member per event. Host and credited co-host actions
        score zero.
      </p>
      <ul className="mt-4 space-y-3 text-sm">
        {rows.map((row) => (
          <li key={row.type} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
            <span>{row.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{row.points}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Rating awards stars − 1. A written comment needs a star rating and always earns the review point. Review window
        prototype: {EVENT_POINTS_RULES.reviewWindowDaysAfterMonthEnd} days after the event month ends.
      </p>
    </Card>
  );
}

function EdgeCases({ cases }: { cases: { id: string; title: string; detail: string }[] }) {
  return (
    <Card title="Launch-check scenarios">
      <p className="mt-2 text-sm text-muted-foreground">
        Covered in the sample data and scoring tests. Open November’s Participation Patterns and co-host demos for the
        interactive mix.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {cases.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-background p-4">
            <p className="font-medium">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            {item.id === "attendance-claim" && (
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Waiting</span> — not checked yet
                </li>
                <li>
                  <span className="font-medium text-foreground">Approved</span> — counts as attended
                </li>
                <li>
                  <span className="font-medium text-foreground">Not approved</span> — no attendance points
                </li>
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function resolveSelectedEvent(
  bundle: EventPointsSampleBundle,
  statement: MonthStatement,
  selectedEventId: string | null,
): EventPointTotals | null {
  if (selectedEventId === bundle.demoEvent.eventId) return bundle.demoEvent;
  if (selectedEventId === bundle.cohostEvent.eventId) return bundle.cohostEvent;
  return statement.events.find((event) => event.eventId === selectedEventId) ?? statement.events[0] ?? null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-[0.12em] text-foreground/60 uppercase">{label}</dt>
      <dd className="mt-1 font-serif text-2xl tabular-nums capitalize">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: MonthStatement["status"] }) {
  return (
    <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">
      {status === "provisional" ? "Provisional" : "Finalized"}
    </span>
  );
}

function FilterButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm",
        pressed ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5">
      <h2 className="font-serif text-2xl">{title}</h2>
      {children}
    </article>
  );
}

function formatPercent(share: number): string {
  return formatShare(Math.round(share * 1_000), 1_000);
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ACCOUNTING_TIMEZONE,
  });
}
