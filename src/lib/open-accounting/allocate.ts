/**
 * Draft rules for the One World Family sample prototype.
 * Totals on screen come from these functions. Sample files only store inputs.
 * Nothing here is an adopted accounting policy.
 */

export const MONTHLY_PRICE_CENTS = 2_900;
export const ANNUAL_PRICE_CENTS = 99_900;
export const LIFETIME_PRICE_CENTS = 249_900;

export const ANNUAL_RECOGNITION_MONTHS = 12;
export const LIFETIME_RECOGNITION_MONTHS = 60;

export const DRAFT_POLICY = {
  version: "v0.2",
  adopted: false,
  referralNumerator: 50,
  contributorNumerator: 25,
  denominator: 100,
  plannedReferralNumerator: 30,
  memberThreshold: 100_000,
  payoutDay: 20,
} as const;

/** Sample point settings. Points are not cash and are not a payout promise. */
export const POINT_RULES = {
  label: "Point configuration",
  perHostedEvent: 10,
  perVerifiedAttendee: 1,
  convertsToCash: false,
} as const;

export const SNAPSHOT_AT = "2026-11-08T09:40:00.000Z";
export const SNAPSHOT_LABEL = "8 November 2026, 09:40 UTC";
export const SNAPSHOT = { year: 2026, month: 11, day: 8 } as const;

export type MembershipActivity = {
  monthlyInvoices: number;
  annualInvoices: number;
  lifetimeInvoices: number;
  discountCents: number;
  refundCents: number;
  chargebackCents: number;
  taxCents: number;
  processingFeeCents: number;
};

export type Allocation = {
  referralCents: number;
  contributorCents: number;
  platformCents: number;
};

export type AccessRole = "signed-out" | "lapsed" | "trial" | "paying" | "admin";

export type RangeKind = "today" | "month" | "quarter" | "year" | "history";

export type DateRange = {
  kind: RangeKind;
  year?: number;
  start: string;
  end: string;
  label: string;
  monthIds: string[];
  previousMonthIds: string[] | null;
  snapshotMonthId: string;
  compareLabel: string | null;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function monthId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthId(id: string): { year: number; month: number } {
  const [year, month] = id.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) throw new Error(`Bad month id ${id}`);
  return { year, month };
}

export function shiftMonth(id: string, delta: number): string {
  const { year, month } = parseMonthId(id);
  const index = year * 12 + (month - 1) + delta;
  return monthId(Math.floor(index / 12), (index % 12) + 1);
}

export function eachMonth(startId: string, endId: string): string[] {
  const months: string[] = [];
  let cursor = startId;
  while (cursor <= endId) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

export function monthLabel(id: string): string {
  const { year, month } = parseMonthId(id);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function grossMembershipCents(activity: Pick<MembershipActivity, "monthlyInvoices" | "annualInvoices" | "lifetimeInvoices">): number {
  return (
    activity.monthlyInvoices * MONTHLY_PRICE_CENTS +
    activity.annualInvoices * ANNUAL_PRICE_CENTS +
    activity.lifetimeInvoices * LIFETIME_PRICE_CENTS
  );
}

/** Net membership collections. Taxes are reported beside this figure and stay out of it. */
export function eligibleCents(activity: MembershipActivity): number {
  return (
    grossMembershipCents(activity) -
    activity.discountCents -
    activity.refundCents -
    activity.chargebackCents -
    activity.processingFeeCents
  );
}

export function halfUp(amount: number, numerator: number, denominator: number): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative whole number of cents.");
  }
  return Math.floor((amount * numerator + Math.floor(denominator / 2)) / denominator);
}

/**
 * Referral and contributor pools are half-up shares of eligible revenue.
 * The platform receives the remainder so the three lines add back exactly.
 * The planned move from 50% to 30% is not applied.
 */
export function splitEligible(eligible: number): Allocation {
  if (!Number.isInteger(eligible) || eligible < 0) {
    throw new Error("Eligible revenue must be a non-negative whole number of cents.");
  }
  const { referralNumerator, contributorNumerator, denominator } = DRAFT_POLICY;
  const referralCents = halfUp(eligible, referralNumerator, denominator);
  const contributorCents = halfUp(eligible, contributorNumerator, denominator);
  const platformCents = eligible - referralCents - contributorCents;
  if (platformCents < 0) throw new Error("Allocation exceeded eligible revenue.");
  return { referralCents, contributorCents, platformCents };
}

export const THRESHOLD_NOTE =
  "A move from 50% to 30% at 100,000 members is planned and not in effect. What counts toward that threshold is still a business decision.";

/** Always the current draft rate. The 100,000-member change is not in force. */
export function activeReferralNumerator(_memberCount: number): number {
  return DRAFT_POLICY.referralNumerator;
}

export function contributionPoints(hostedEvents: number, verifiedAttendees: number): number {
  if (!Number.isInteger(hostedEvents) || hostedEvents < 0 || !Number.isInteger(verifiedAttendees) || verifiedAttendees < 0) {
    throw new Error("Point inputs must be non-negative whole numbers.");
  }
  return hostedEvents * POINT_RULES.perHostedEvent + verifiedAttendees * POINT_RULES.perVerifiedAttendee;
}

/** Cash attributed to an event is the approved amount only. Points do not convert. */
export function eventEarningsCents(approvedCents: number): number {
  if (!Number.isInteger(approvedCents) || approvedCents < 0) {
    throw new Error("Approved earnings must be a non-negative whole number of cents.");
  }
  return approvedCents;
}

export function recognitionSchedule(priceCents: number, months: number): number[] {
  if (!Number.isInteger(priceCents) || priceCents < 0 || !Number.isInteger(months) || months <= 0) {
    throw new Error("Recognition needs a non-negative price and at least one month.");
  }
  const base = Math.floor(priceCents / months);
  const extra = priceCents % months;
  return Array.from({ length: months }, (_, index) => base + (index < extra ? 1 : 0));
}

export type BalanceInput = {
  approvedEarningsCents: number;
  creditsCents: number;
  advancesCents: number;
  deductionsCents: number;
  previousPayoutsCents: number;
};

export type BalanceView = {
  cents: number;
  tone: "available" | "offset" | "even";
  title: string;
};

/** Approved earnings + credits − advances − deductions − previous payouts. */
export function netBalance(input: BalanceInput): BalanceView {
  const cents =
    input.approvedEarningsCents + input.creditsCents - input.advancesCents - input.deductionsCents - input.previousPayoutsCents;
  if (cents < 0) {
    return { cents, tone: "offset", title: "Balance to offset" };
  }
  if (cents > 0) {
    return { cents, tone: "available", title: "Available for payout" };
  }
  return { cents, tone: "even", title: "Nothing available for payout" };
}

export function payoutDateForEarnedMonth(year: number, month: number): { iso: string; label: string } {
  const payoutMonth = month === 12 ? 1 : month + 1;
  const payoutYear = month === 12 ? year + 1 : year;
  const iso = `${payoutYear}-${String(payoutMonth).padStart(2, "0")}-${String(DRAFT_POLICY.payoutDay).padStart(2, "0")}`;
  return { iso, label: `${DRAFT_POLICY.payoutDay} ${MONTH_NAMES[payoutMonth - 1]} ${payoutYear}` };
}

/** The next 20th, and the calendar month it pays. Uses the fixed snapshot, not the computer clock. */
export function nextPayout(snapshot: { year: number; month: number; day: number } = SNAPSHOT): {
  iso: string;
  label: string;
  coversMonthId: string;
  coversLabel: string;
} {
  const dueThisMonth = snapshot.day < DRAFT_POLICY.payoutDay;
  const covers = dueThisMonth
    ? shiftMonth(monthId(snapshot.year, snapshot.month), -1)
    : monthId(snapshot.year, snapshot.month);
  const { year, month } = parseMonthId(covers);
  const payout = payoutDateForEarnedMonth(year, month);
  return { ...payout, coversMonthId: covers, coversLabel: monthLabel(covers) };
}

export function canViewEarnings(role: AccessRole): boolean {
  return role !== "signed-out";
}

export function canViewOpenAccounting(role: AccessRole): boolean {
  return role === "trial" || role === "paying" || role === "admin";
}

export function canViewAdmin(role: AccessRole): boolean {
  return role === "admin";
}

export type MembershipStatus = "free-trial" | "active-paid" | "expired-trial" | "cancelled";

export function canFollowUp(status: MembershipStatus): boolean {
  return status === "free-trial" || status === "expired-trial";
}

export function statusLabel(status: MembershipStatus): string {
  switch (status) {
    case "free-trial":
      return "Free Trial";
    case "active-paid":
      return "Active Paid";
    case "expired-trial":
      return "Expired Trial";
    case "cancelled":
      return "Cancelled";
  }
}

const DATA_START = "2025-01";
const DATA_END = monthId(SNAPSHOT.year, SNAPSHOT.month);

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveRange(kind: RangeKind, year?: number): DateRange {
  const current = monthId(SNAPSHOT.year, SNAPSHOT.month);
  if (kind === "today") {
    return {
      kind,
      start: `${current}-${String(SNAPSHOT.day).padStart(2, "0")}`,
      end: `${current}-${String(SNAPSHOT.day).padStart(2, "0")}`,
      label: `${SNAPSHOT.day} ${MONTH_NAMES[SNAPSHOT.month - 1]} ${SNAPSHOT.year}`,
      monthIds: [current],
      previousMonthIds: null,
      snapshotMonthId: current,
      compareLabel: null,
    };
  }
  if (kind === "month") {
    const previous = shiftMonth(current, -1);
    return {
      kind,
      start: `${current}-01`,
      end: `${current}-${String(lastDay(SNAPSHOT.year, SNAPSHOT.month)).padStart(2, "0")}`,
      label: `${monthLabel(current)} · 1–${lastDay(SNAPSHOT.year, SNAPSHOT.month)}, through ${SNAPSHOT.day} ${MONTH_NAMES[SNAPSHOT.month - 1]}`,
      monthIds: [current],
      previousMonthIds: [previous],
      snapshotMonthId: current,
      compareLabel: monthLabel(previous),
    };
  }
  if (kind === "quarter") {
    const quarterIndex = Math.floor((SNAPSHOT.month - 1) / 3);
    const startMonth = quarterIndex * 3 + 1;
    const start = monthId(SNAPSHOT.year, startMonth);
    const end = monthId(SNAPSHOT.year, startMonth + 2);
    const monthIds = eachMonth(start, current);
    const previousStart = shiftMonth(start, -3);
    const previousEnd = shiftMonth(start, -1);
    return {
      kind,
      start: `${start}-01`,
      end: `${end}-31`,
      label: `Q${quarterIndex + 1} ${SNAPSHOT.year} · ${monthLabel(start)}–${monthLabel(end)}, through ${SNAPSHOT_LABEL}`,
      monthIds,
      previousMonthIds: eachMonth(previousStart, previousEnd),
      snapshotMonthId: current,
      compareLabel: `Q${quarterIndex === 0 ? 4 : quarterIndex} ${quarterIndex === 0 ? SNAPSHOT.year - 1 : SNAPSHOT.year}`,
    };
  }
  if (kind === "year" || kind === "history") {
    const selected = kind === "history" ? year : SNAPSHOT.year;
    if (!selected) throw new Error("Historical year is required.");
    const start = monthId(selected, 1);
    const last = selected === SNAPSHOT.year ? current : monthId(selected, 12);
    if (start > DATA_END || last < DATA_START) throw new Error("Year is outside the sample.");
    const previousYear = selected - 1;
    const previousStart = monthId(previousYear, 1);
    const hasPrevious = previousStart >= DATA_START;
    return {
      kind,
      year: selected,
      start: `${start}-01`,
      end:
        selected === SNAPSHOT.year
          ? `${current}-${String(SNAPSHOT.day).padStart(2, "0")}`
          : `${last}-${String(lastDay(selected, 12)).padStart(2, "0")}`,
      label: selected === SNAPSHOT.year ? `${selected} through ${SNAPSHOT.day} ${MONTH_NAMES[SNAPSHOT.month - 1]}` : String(selected),
      monthIds: eachMonth(start, last),
      previousMonthIds: hasPrevious ? eachMonth(previousStart, monthId(previousYear, 12)) : null,
      snapshotMonthId: last,
      compareLabel: hasPrevious ? String(previousYear) : null,
    };
  }
  throw new Error(`Unknown range ${kind}`);
}

export function growthPercent(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type LeaderboardInput = {
  firstName: string | null;
  optedIn: boolean;
  initials: string | null;
  referralCount: number;
  earningsCents: number;
};

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  initials: string | null;
  referralCount: number;
  earningsCents: number;
  named: boolean;
};

export function presentLeaderboard(rows: LeaderboardInput[]): LeaderboardRow[] {
  return [...rows]
    .sort((left, right) => right.earningsCents - left.earningsCents || right.referralCount - left.referralCount)
    .map((row, index) => ({
      rank: index + 1,
      displayName: row.optedIn && row.firstName ? row.firstName : "Anonymous member",
      initials: row.optedIn ? row.initials : null,
      referralCount: row.referralCount,
      earningsCents: row.earningsCents,
      named: Boolean(row.optedIn && row.firstName),
    }));
}

export const EXPENSE_CATEGORIES = [
  { id: "salaries", label: "Full-time employee salaries", kind: "fixed", bridge: false },
  { id: "contractors", label: "Contractors and freelancers", kind: "variable", bridge: false },
  { id: "founders", label: "Founder compensation", kind: "fixed", bridge: false },
  { id: "operations", label: "Operations and administration", kind: "fixed", bridge: false },
  { id: "legal", label: "Legal services", kind: "variable", bridge: false },
  { id: "accounting", label: "Accounting and bookkeeping", kind: "fixed", bridge: false },
  { id: "taxCompliance", label: "Tax and regulatory compliance", kind: "variable", bridge: false },
  { id: "technology", label: "Technology development", kind: "variable", bridge: false },
  { id: "hosting", label: "Hosting and infrastructure", kind: "fixed", bridge: false },
  { id: "software", label: "Software tools and subscriptions", kind: "fixed", bridge: false },
  { id: "marketing", label: "Marketing and advertising", kind: "variable", bridge: false },
  { id: "facilitator", label: "Facilitator advances and production expenses", kind: "variable", bridge: false },
  { id: "processing", label: "Payment processing fees", kind: "variable", bridge: true },
  { id: "support", label: "Customer support", kind: "variable", bridge: false },
  { id: "insurance", label: "Insurance", kind: "fixed", bridge: false },
  { id: "travel", label: "Travel and business development", kind: "variable", bridge: false },
  { id: "professional", label: "Professional services", kind: "variable", bridge: false },
  { id: "refunds", label: "Refunds and chargebacks", kind: "variable", bridge: true },
  { id: "referralPaid", label: "Referral rewards paid", kind: "variable", bridge: false },
  { id: "contributorPaid", label: "Contributor rewards paid", kind: "variable", bridge: false },
  { id: "other", label: "Other operating expenses", kind: "variable", bridge: false },
] as const;

export type ExpenseId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function emptyExpenses(): Record<ExpenseId, number> {
  return Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category.id, 0])) as Record<ExpenseId, number>;
}
