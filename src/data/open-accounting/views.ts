import {
  ANNUAL_RECOGNITION_MONTHS,
  EXPENSE_CATEGORIES,
  LIFETIME_RECOGNITION_MONTHS,
  currentSnapshotLabel,
  eligibleCents,
  emptyExpenses,
  grossMembershipCents,
  growthPercent,
  monthLabel,
  presentLeaderboard,
  recognitionSchedule,
  resolveRange,
  shiftMonth,
  splitEligible,
  type DateRange,
  type ExpenseId,
  type LeaderboardRow,
  type MembershipActivity,
  type RangeKind,
} from "@/lib/open-accounting/allocate";

// These shapes used to be a static fixture in sample-ledger.ts. They are
// now filled with real numbers by src/data/open-accounting/live-ledger.ts,
// one object per real calendar month, and handed to buildAccounting below —
// the formulas here are unchanged, only where the inputs come from.
export type TodaySlice = {
  monthlyInvoices: number;
  annualInvoices: number;
  lifetimeInvoices: number;
  monthlyCashCents: number;
  annualCashCents: number;
  lifetimeCashCents: number;
  discountCents: number;
  refundCents: number;
  chargebackCents: number;
  taxCents: number;
  processingFeeCents: number;
  otherRevenueCents: number;
  expenses: Partial<Record<ExpenseId, number>>;
  newMembers: number;
  eventsCreated: number;
  eventsCompleted: number;
  creditsIssued: number;
  creditsRedeemed: number;
  creditsExchanged: number;
  hostingNights: number;
  completedStays: number;
  skillExchanges: number;
  points: number;
};

export type MonthInput = {
  id: string;
  monthlyInvoices: number;
  annualInvoices: number;
  lifetimeInvoices: number;
  monthlyCashCents: number;
  annualCashCents: number;
  lifetimeCashCents: number;
  discountCents: number;
  refundCents: number;
  chargebackCents: number;
  taxCents: number;
  processingFeeCents: number;
  otherRevenueCents: number;
  expenses: Partial<Record<ExpenseId, number>>;
  budgets: Partial<Record<ExpenseId, number>>;
  depreciationCents: number;
  interestCents: number;
  taxProvisionCents: number;
  referralApprovedCents: number;
  referralPendingCents: number;
  referralPaidCents: number;
  contributorApprovedCents: number;
  contributorPaidCents: number;
  points: number;
  newMembers: number;
  eventsCreated: number;
  eventsCompleted: number;
  creditsIssued: number;
  creditsRedeemed: number;
  creditsExchanged: number;
  hostingNights: number;
  completedStays: number;
  skillExchanges: number;
  registered: number;
  payingMonthly: number;
  payingAnnual: number;
  payingLifetime: number;
  trials: number;
  homesParticipating: number;
  skillsOffered: number;
  referralEarners: number;
  contributionEarners: number;
  payingMembersAcquired: number;
  /** DB-derived MRR from average paid amounts × active members. */
  mrrCents: number;
  forecastRecognizedCents?: number;
  forecastExpenseCents?: number;
  today?: TodaySlice;
};

export type EarnerInput = {
  id: string;
  firstName: string | null;
  optedIn: boolean;
  initials: string | null;
  byMonth: Record<string, { referrals: number; approvedCents: number; pendingCents: number }>;
};

export type OwnershipRow = { name: string; share: string; units: string; status: "Verified" | "Draft" };

export type ParticipationHome = {
  id: string;
  title: string;
  description: string | null;
  locationText: string | null;
  propertyType: string;
};

export type ParticipationSkill = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: string;
};

export type CreditReasonRow = {
  reason: string;
  issued: number;
  used: number;
};

export type MoneyFlow = {
  grossCents: number;
  discountCents: number;
  refundCents: number;
  chargebackCents: number;
  taxCents: number;
  processingFeeCents: number;
  eligibleCents: number;
  monthlyCashCents: number;
  annualCashCents: number;
  lifetimeCashCents: number;
  otherRevenueCents: number;
  cashReceiptsCents: number;
  referralApprovedCents: number;
  referralPendingCents: number;
  referralPaidCents: number;
  contributorApprovedCents: number;
  contributorPaidCents: number;
  points: number;
  newMembers: number;
  eventsCreated: number;
  eventsCompleted: number;
  creditsIssued: number;
  creditsRedeemed: number;
  creditsExchanged: number;
  hostingNights: number;
  completedStays: number;
  skillExchanges: number;
  expenses: Record<ExpenseId, number>;
  depreciationCents: number;
  interestCents: number;
  taxProvisionCents: number;
};

export type LedgerRow = {
  id: string;
  date: string;
  type: string;
  reference: string;
  category: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  allocation: string;
  settlement: string;
  source: string;
};

export type AccountingView = {
  range: DateRange;
  updatedLabel: string;
  flow: MoneyFlow;
  recognized: { monthlyCents: number; annualCents: number; lifetimeCents: number; otherCents: number; totalCents: number };
  allocation: { referralCents: number; contributorCents: number; platformCents: number };
  moneyGrowth: {
    eligible: number | null;
    referral: number | null;
    contributor: number | null;
    platform: number | null;
    expenses: number | null;
    ebitda: number | null;
    net: number | null;
  };
  expenseLines: {
    id: ExpenseId;
    label: string;
    kind: "fixed" | "variable";
    actualCents: number;
    budgetCents: number;
    bridge: boolean;
  }[];
  operatingCents: number;
  budgetOperatingCents: number;
  fixedCents: number;
  variableCents: number;
  performance: {
    recognizedCents: number;
    costOfServicesCents: number;
    grossProfitCents: number;
    payrollCents: number;
    technologyCents: number;
    marketingCents: number;
    administrationCents: number;
    otherCents: number;
    referralPaidCents: number;
    contributorPaidCents: number;
    operatingCents: number;
    processingFeeCents: number;
    ebitdaCents: number;
    depreciationCents: number;
    interestCents: number;
    taxCents: number;
    netCents: number;
    forecastRecognizedCents: number | null;
    forecastExpenseCents: number | null;
  };
  cash: { openingCents: number; receiptsCents: number; outflowsCents: number; closingCents: number };
  runway: { months: number | null; note: string };
  deferred: { annualCents: number; lifetimeCents: number; totalCents: number };
  liabilities: { referralUnpaidCents: number; contributorUnpaidCents: number; payableCents: number; receivableCents: number };
  community: {
    registered: number;
    paying: number;
    payingMonthly: number;
    payingAnnual: number;
    payingLifetime: number;
    trials: number;
    active: number;
    newMembers: number;
    eventsCreated: number;
    eventsCompleted: number;
    creditsIssued: number;
    creditsOutstanding: number;
    creditsExchanged: number;
    referralEarners: number;
    contributionEarners: number;
    homes: number;
    hostingNights: number;
    completedStays: number;
    skillsOffered: number;
    skillExchanges: number;
    growth: {
      registered: number | null;
      paying: number | null;
      trials: number | null;
      newMembers: number | null;
      eventsCreated: number | null;
    };
  };
  windows: {
    label: string;
    referralAllocatedCents: number;
    referralPaidCents: number;
    contributorAllocatedCents: number;
    contributorPaidCents: number;
  }[];
  series: {
    id: string;
    label: string;
    eligibleCents: number;
    membershipCashCents: number;
    recognizedCents: number;
    expenseCents: number;
    ebitdaCents: number;
    netCents: number;
    members: number;
    paying: number;
    mrrCents: number;
    points: number;
    referralCents: number;
    contributorCents: number;
  }[];
  leaderboard: LeaderboardRow[];
  ledger: LedgerRow[];
  ownership: OwnershipRow[];
  dividends: { id: string; cents: number }[];
  payingMembersAcquired: number;
  participation: {
    homes: ParticipationHome[];
    skills: ParticipationSkill[];
    creditReasons: CreditReasonRow[];
  };
};

/** Real data handed in from src/data/open-accounting/live-ledger.ts. */
export type AccountingData = {
  months: MonthInput[];
  earners: EarnerInput[];
  ledger: LedgerRow[];
  ownership: OwnershipRow[];
  /** Cash on hand at the start of the earliest tracked month, from company_financial_snapshots. */
  openingCashCents: number;
  homes: ParticipationHome[];
  skills: ParticipationSkill[];
  creditReasons: CreditReasonRow[];
};

const COST_IDS: ExpenseId[] = ["facilitator", "support", "travel"];
const PAYROLL_IDS: ExpenseId[] = ["salaries", "contractors", "founders"];
const TECH_IDS: ExpenseId[] = ["technology", "hosting", "software"];
const ADMIN_IDS: ExpenseId[] = ["operations", "legal", "accounting", "taxCompliance", "insurance", "professional"];

function blankMonth(id: string): MonthInput {
  return {
    id,
    monthlyInvoices: 0,
    annualInvoices: 0,
    lifetimeInvoices: 0,
    monthlyCashCents: 0,
    annualCashCents: 0,
    lifetimeCashCents: 0,
    discountCents: 0,
    refundCents: 0,
    chargebackCents: 0,
    taxCents: 0,
    processingFeeCents: 0,
    otherRevenueCents: 0,
    expenses: {},
    budgets: {},
    depreciationCents: 0,
    interestCents: 0,
    taxProvisionCents: 0,
    referralApprovedCents: 0,
    referralPendingCents: 0,
    referralPaidCents: 0,
    contributorApprovedCents: 0,
    contributorPaidCents: 0,
    points: 0,
    newMembers: 0,
    eventsCreated: 0,
    eventsCompleted: 0,
    creditsIssued: 0,
    creditsRedeemed: 0,
    creditsExchanged: 0,
    hostingNights: 0,
    completedStays: 0,
    skillExchanges: 0,
    registered: 0,
    payingMonthly: 0,
    payingAnnual: 0,
    payingLifetime: 0,
    trials: 0,
    homesParticipating: 0,
    skillsOffered: 0,
    referralEarners: 0,
    contributionEarners: 0,
    payingMembersAcquired: 0,
    mrrCents: 0,
  };
}

function activityOf(month: MonthInput, todayOnly: boolean): MembershipActivity {
  if (todayOnly) {
    const today = month.today;
    return {
      monthlyInvoices: today?.monthlyInvoices ?? 0,
      annualInvoices: today?.annualInvoices ?? 0,
      lifetimeInvoices: today?.lifetimeInvoices ?? 0,
      monthlyCashCents: today?.monthlyCashCents ?? 0,
      annualCashCents: today?.annualCashCents ?? 0,
      lifetimeCashCents: today?.lifetimeCashCents ?? 0,
      discountCents: today?.discountCents ?? 0,
      refundCents: today?.refundCents ?? 0,
      chargebackCents: today?.chargebackCents ?? 0,
      taxCents: today?.taxCents ?? 0,
      processingFeeCents: today?.processingFeeCents ?? 0,
    };
  }
  return {
    monthlyInvoices: month.monthlyInvoices,
    annualInvoices: month.annualInvoices,
    lifetimeInvoices: month.lifetimeInvoices,
    monthlyCashCents: month.monthlyCashCents,
    annualCashCents: month.annualCashCents,
    lifetimeCashCents: month.lifetimeCashCents,
    discountCents: month.discountCents,
    refundCents: month.refundCents,
    chargebackCents: month.chargebackCents,
    taxCents: month.taxCents,
    processingFeeCents: month.processingFeeCents,
  };
}

function expenseMap(month: MonthInput, todayOnly: boolean): Record<ExpenseId, number> {
  const map = emptyExpenses();
  const source = todayOnly ? (month.today?.expenses ?? {}) : month.expenses;
  for (const category of EXPENSE_CATEGORIES) {
    map[category.id] = source[category.id] ?? 0;
  }
  if (todayOnly) {
    map.processing = month.today?.processingFeeCents ?? 0;
    return map;
  }
  map.processing = month.processingFeeCents;
  map.refunds = month.refundCents + month.chargebackCents;
  map.referralPaid = month.referralPaidCents;
  map.contributorPaid = month.contributorPaidCents;
  return map;
}

function sumIds(map: Record<ExpenseId, number>, ids: ExpenseId[]): number {
  return ids.reduce((total, id) => total + map[id], 0);
}

function flowOf(month: MonthInput, todayOnly: boolean): MoneyFlow {
  const activity = activityOf(month, todayOnly);
  const expenses = expenseMap(month, todayOnly);
  const monthlyCashCents = activity.monthlyCashCents - activity.discountCents - activity.refundCents - activity.chargebackCents;
  const annualCashCents = activity.annualCashCents;
  const lifetimeCashCents = activity.lifetimeCashCents;
  const otherRevenueCents = todayOnly ? (month.today?.otherRevenueCents ?? 0) : month.otherRevenueCents;
  const today = month.today;
  return {
    grossCents: grossMembershipCents(activity),
    discountCents: activity.discountCents,
    refundCents: activity.refundCents,
    chargebackCents: activity.chargebackCents,
    taxCents: activity.taxCents,
    processingFeeCents: activity.processingFeeCents,
    eligibleCents: eligibleCents(activity),
    monthlyCashCents,
    annualCashCents,
    lifetimeCashCents,
    otherRevenueCents,
    cashReceiptsCents: monthlyCashCents + annualCashCents + lifetimeCashCents + otherRevenueCents,
    referralApprovedCents: todayOnly ? 0 : month.referralApprovedCents,
    referralPendingCents: todayOnly ? 0 : month.referralPendingCents,
    referralPaidCents: todayOnly ? 0 : month.referralPaidCents,
    contributorApprovedCents: todayOnly ? 0 : month.contributorApprovedCents,
    contributorPaidCents: todayOnly ? 0 : month.contributorPaidCents,
    points: todayOnly ? (today?.points ?? 0) : month.points,
    newMembers: todayOnly ? (today?.newMembers ?? 0) : month.newMembers,
    eventsCreated: todayOnly ? (today?.eventsCreated ?? 0) : month.eventsCreated,
    eventsCompleted: todayOnly ? (today?.eventsCompleted ?? 0) : month.eventsCompleted,
    creditsIssued: todayOnly ? (today?.creditsIssued ?? 0) : month.creditsIssued,
    creditsRedeemed: todayOnly ? (today?.creditsRedeemed ?? 0) : month.creditsRedeemed,
    creditsExchanged: todayOnly ? (today?.creditsExchanged ?? 0) : month.creditsExchanged,
    hostingNights: todayOnly ? (today?.hostingNights ?? 0) : month.hostingNights,
    completedStays: todayOnly ? (today?.completedStays ?? 0) : month.completedStays,
    skillExchanges: todayOnly ? (today?.skillExchanges ?? 0) : month.skillExchanges,
    expenses,
    depreciationCents: todayOnly ? 0 : month.depreciationCents,
    interestCents: todayOnly ? 0 : month.interestCents,
    taxProvisionCents: todayOnly ? 0 : month.taxProvisionCents,
  };
}

function addFlow(total: MoneyFlow, part: MoneyFlow): MoneyFlow {
  const expenses = emptyExpenses();
  for (const category of EXPENSE_CATEGORIES) expenses[category.id] = total.expenses[category.id] + part.expenses[category.id];
  return {
    grossCents: total.grossCents + part.grossCents,
    discountCents: total.discountCents + part.discountCents,
    refundCents: total.refundCents + part.refundCents,
    chargebackCents: total.chargebackCents + part.chargebackCents,
    taxCents: total.taxCents + part.taxCents,
    processingFeeCents: total.processingFeeCents + part.processingFeeCents,
    eligibleCents: total.eligibleCents + part.eligibleCents,
    monthlyCashCents: total.monthlyCashCents + part.monthlyCashCents,
    annualCashCents: total.annualCashCents + part.annualCashCents,
    lifetimeCashCents: total.lifetimeCashCents + part.lifetimeCashCents,
    otherRevenueCents: total.otherRevenueCents + part.otherRevenueCents,
    cashReceiptsCents: total.cashReceiptsCents + part.cashReceiptsCents,
    referralApprovedCents: total.referralApprovedCents + part.referralApprovedCents,
    referralPendingCents: total.referralPendingCents + part.referralPendingCents,
    referralPaidCents: total.referralPaidCents + part.referralPaidCents,
    contributorApprovedCents: total.contributorApprovedCents + part.contributorApprovedCents,
    contributorPaidCents: total.contributorPaidCents + part.contributorPaidCents,
    points: total.points + part.points,
    newMembers: total.newMembers + part.newMembers,
    eventsCreated: total.eventsCreated + part.eventsCreated,
    eventsCompleted: total.eventsCompleted + part.eventsCompleted,
    creditsIssued: total.creditsIssued + part.creditsIssued,
    creditsRedeemed: total.creditsRedeemed + part.creditsRedeemed,
    creditsExchanged: total.creditsExchanged + part.creditsExchanged,
    hostingNights: total.hostingNights + part.hostingNights,
    completedStays: total.completedStays + part.completedStays,
    skillExchanges: total.skillExchanges + part.skillExchanges,
    expenses,
    depreciationCents: total.depreciationCents + part.depreciationCents,
    interestCents: total.interestCents + part.interestCents,
    taxProvisionCents: total.taxProvisionCents + part.taxProvisionCents,
  };
}

function blankFlow(): MoneyFlow {
  return flowOf(blankMonth("blank"), false);
}

function cashOut(flow: MoneyFlow): number {
  const operating = EXPENSE_CATEGORIES.filter((category) => !category.bridge).reduce((sum, category) => sum + flow.expenses[category.id], 0);
  return flow.processingFeeCents + operating + flow.depreciationCents + flow.interestCents + flow.taxProvisionCents;
}

function budgetFor(month: MonthInput, id: ExpenseId, actual: number, kind: "fixed" | "variable", bridge: boolean): number {
  if (month.budgets[id] !== undefined) return month.budgets[id] ?? 0;
  if (bridge || id === "referralPaid" || id === "contributorPaid" || actual === 0 || kind === "fixed") return actual;
  return Math.round(actual * 1.1);
}

function seriesPoint(allMonths: MonthInput[], month: MonthInput, todayOnly: boolean): AccountingView["series"][number] {
  const flow = flowOf(month, todayOnly);
  const recognized = recognizedForMonths(allMonths, [month.id], todayOnly);
  const operating = EXPENSE_CATEGORIES.filter((category) => !category.bridge).reduce((sum, category) => sum + flow.expenses[category.id], 0);
  const ebitda = recognized.totalCents - operating - flow.processingFeeCents;
  const net = ebitda - flow.depreciationCents - flow.interestCents - flow.taxProvisionCents;
  const paying = month.payingMonthly + month.payingAnnual + month.payingLifetime;
  const allocation = splitEligible(flow.eligibleCents);
  return {
    id: month.id,
    label: todayOnly ? "Today" : monthLabel(month.id).slice(0, 3),
    eligibleCents: flow.eligibleCents,
    membershipCashCents: flow.monthlyCashCents + flow.annualCashCents + flow.lifetimeCashCents,
    recognizedCents: recognized.totalCents,
    expenseCents: operating,
    ebitdaCents: ebitda,
    netCents: net,
    members: month.registered,
    paying,
    mrrCents: month.mrrCents,
    points: flow.points,
    referralCents: allocation.referralCents,
    contributorCents: allocation.contributorCents,
  };
}

function headline(flow: MoneyFlow, recognizedCents: number) {
  const operatingCents = EXPENSE_CATEGORIES.filter((category) => !category.bridge).reduce((sum, category) => sum + flow.expenses[category.id], 0);
  const ebitdaCents = recognizedCents - operatingCents - flow.processingFeeCents;
  return {
    eligibleCents: flow.eligibleCents,
    operatingCents,
    ebitdaCents,
    netCents: ebitdaCents - flow.depreciationCents - flow.interestCents - flow.taxProvisionCents,
    ...splitEligible(flow.eligibleCents),
  };
}

/** Recognized revenue needs every month that has ever sold an annual/lifetime
 * membership, since that revenue amortizes forward — not just the months in
 * range. `allMonths` carries the full fetched history for that; `monthIds`
 * is the window being reported. */
function recognizedForMonths(allMonths: MonthInput[], monthIds: string[], todayOnly: boolean): AccountingView["recognized"] {
  const ids = new Set(monthIds);
  let monthlyCents = 0;
  let annualCents = 0;
  let lifetimeCents = 0;
  let otherCents = 0;
  for (const month of allMonths) {
    if (ids.has(month.id)) {
      const flow = flowOf(month, todayOnly && month.id === allMonths[allMonths.length - 1]?.id);
      monthlyCents += flow.monthlyCashCents;
      otherCents += flow.otherRevenueCents;
    }
    if (todayOnly) continue;
    recognitionSchedule(month.annualCashCents, ANNUAL_RECOGNITION_MONTHS).forEach((cents, offset) => {
      if (ids.has(shiftMonth(month.id, offset))) annualCents += cents;
    });
    recognitionSchedule(month.lifetimeCashCents, LIFETIME_RECOGNITION_MONTHS).forEach((cents, offset) => {
      if (ids.has(shiftMonth(month.id, offset))) lifetimeCents += cents;
    });
  }
  return { monthlyCents, annualCents, lifetimeCents, otherCents, totalCents: monthlyCents + annualCents + lifetimeCents + otherCents };
}

export function buildAccounting(kind: RangeKind, year: number | undefined, data: AccountingData): AccountingView {
  const months = data.months;
  const byId = new Map(months.map((month) => [month.id, month]));
  const monthById = (id: string): MonthInput => byId.get(id) ?? blankMonth(id);

  const range = resolveRange(kind, year);
  const todayOnly = kind === "today";
  const latestMonthId = months[months.length - 1]?.id;

  const flowOfId = (id: string, forceTodayOnly: boolean) => flowOf(monthById(id), forceTodayOnly && id === latestMonthId);
  const FULL_FLOWS = new Map(months.map((month) => [month.id, flowOf(month, false)]));

  function sumFlows(monthIds: string[], today: boolean): MoneyFlow {
    return monthIds.reduce((total, id) => addFlow(total, flowOfId(id, today)), blankFlow());
  }

  const CASH_LADDER = (() => {
    let cursor = data.openingCashCents;
    const opening = new Map<string, number>();
    const closing = new Map<string, number>();
    for (const month of months) {
      opening.set(month.id, cursor);
      const flow = FULL_FLOWS.get(month.id)!;
      cursor += flow.cashReceiptsCents - cashOut(flow);
      closing.set(month.id, cursor);
    }
    return { opening, closing };
  })();

  function deferredAsOf(snapshotMonthId: string) {
    let annualCents = 0;
    let lifetimeCents = 0;
    for (const month of months) {
      recognitionSchedule(month.annualCashCents, ANNUAL_RECOGNITION_MONTHS).forEach((cents, offset) => {
        if (shiftMonth(month.id, offset) > snapshotMonthId) annualCents += cents;
      });
      recognitionSchedule(month.lifetimeCashCents, LIFETIME_RECOGNITION_MONTHS).forEach((cents, offset) => {
        if (shiftMonth(month.id, offset) > snapshotMonthId) lifetimeCents += cents;
      });
    }
    return { annualCents, lifetimeCents, totalCents: annualCents + lifetimeCents };
  }

  function outstandingCredits(snapshotMonthId: string): number {
    return months.reduce((total, month) => {
      if (month.id > snapshotMonthId) return total;
      return total + month.creditsIssued - month.creditsRedeemed;
    }, 0);
  }

  function cumulativeThrough(snapshotMonthId: string) {
    return months.reduce(
      (total, month) => {
        if (month.id > snapshotMonthId) return total;
        total.referralApproved += month.referralApprovedCents;
        total.referralPaid += month.referralPaidCents;
        total.contributorApproved += month.contributorApprovedCents;
        total.contributorPaid += month.contributorPaidCents;
        return total;
      },
      { referralApproved: 0, referralPaid: 0, contributorApproved: 0, contributorPaid: 0 },
    );
  }

  function windowTotals(monthIds: string[]) {
    const flow = sumFlows(monthIds, false);
    const allocation = splitEligible(flow.eligibleCents);
    return {
      referralAllocatedCents: allocation.referralCents,
      referralPaidCents: flow.referralPaidCents,
      contributorAllocatedCents: allocation.contributorCents,
      contributorPaidCents: flow.contributorPaidCents,
    };
  }

  function runwayFor(snapshotMonthId: string, closingCents: number): AccountingView["runway"] {
    const prior = months.filter((month) => month.id < snapshotMonthId).slice(-3);
    if (prior.length < 3) {
      return { months: null, note: "Fewer than three earlier months, so runway is not estimated." };
    }
    const average =
      prior.reduce((total, month) => {
        const flow = FULL_FLOWS.get(month.id)!;
        return total + flow.cashReceiptsCents - cashOut(flow);
      }, 0) / prior.length;
    if (average >= 0) {
      return { months: null, note: "Recent months are not burning cash, so a runway countdown is not shown." };
    }
    const runwayMonths = Math.round((closingCents / -average) * 10) / 10;
    return { months: runwayMonths, note: "Closing cash divided by the average cash decrease of the three prior months." };
  }

  const flow = sumFlows(range.monthIds, todayOnly);
  const recognized = recognizedForMonths(months, range.monthIds, todayOnly);
  const allocation = splitEligible(flow.eligibleCents);
  const previousFlow = range.previousMonthIds ? sumFlows(range.previousMonthIds, false) : null;
  const previousHeadline =
    previousFlow && range.previousMonthIds ? headline(previousFlow, recognizedForMonths(months, range.previousMonthIds, false).totalCents) : null;
  const currentOperating = EXPENSE_CATEGORIES.filter((category) => !category.bridge).reduce((sum, category) => sum + flow.expenses[category.id], 0);
  const currentEbitda = recognized.totalCents - currentOperating - flow.processingFeeCents;
  const moneyGrowth = {
    eligible: growthPercent(flow.eligibleCents, previousHeadline?.eligibleCents ?? null),
    referral: growthPercent(allocation.referralCents, previousHeadline?.referralCents ?? null),
    contributor: growthPercent(allocation.contributorCents, previousHeadline?.contributorCents ?? null),
    platform: growthPercent(allocation.platformCents, previousHeadline?.platformCents ?? null),
    expenses: growthPercent(currentOperating, previousHeadline?.operatingCents ?? null),
    ebitda: growthPercent(currentEbitda, previousHeadline?.ebitdaCents ?? null),
    net: growthPercent(
      currentEbitda - flow.depreciationCents - flow.interestCents - flow.taxProvisionCents,
      previousHeadline?.netCents ?? null,
    ),
  };
  const snapshot = monthById(range.snapshotMonthId);
  const previousSnapshot = range.previousMonthIds ? monthById(range.previousMonthIds[range.previousMonthIds.length - 1]!) : null;
  const paying = snapshot.payingMonthly + snapshot.payingAnnual + snapshot.payingLifetime;
  const previousPaying = previousSnapshot
    ? previousSnapshot.payingMonthly + previousSnapshot.payingAnnual + previousSnapshot.payingLifetime
    : null;

  const expenseLines = EXPENSE_CATEGORIES.map((category) => {
    const actualCents = flow.expenses[category.id];
    const budgetCents = todayOnly
      ? 0
      : range.monthIds.reduce(
          (total, id) => total + budgetFor(monthById(id), category.id, FULL_FLOWS.get(id)?.expenses[category.id] ?? 0, category.kind, category.bridge),
          0,
        );
    return { id: category.id, label: category.label, kind: category.kind, actualCents, budgetCents, bridge: category.bridge };
  });
  const operatingCents = expenseLines.filter((line) => !line.bridge).reduce((total, line) => total + line.actualCents, 0);
  const budgetOperatingCents = expenseLines.filter((line) => !line.bridge).reduce((total, line) => total + line.budgetCents, 0);
  const fixedCents = expenseLines.filter((line) => line.kind === "fixed" && !line.bridge).reduce((total, line) => total + line.actualCents, 0);
  const variableCents = expenseLines.filter((line) => line.kind === "variable" && !line.bridge).reduce((total, line) => total + line.actualCents, 0);
  const costOfServicesCents = sumIds(flow.expenses, COST_IDS);
  const payrollCents = sumIds(flow.expenses, PAYROLL_IDS);
  const technologyCents = sumIds(flow.expenses, TECH_IDS);
  const administrationCents = sumIds(flow.expenses, ADMIN_IDS);
  const operatingForProfit = operatingCents - costOfServicesCents;
  const ebitdaCents = recognized.totalCents - costOfServicesCents - operatingForProfit - flow.processingFeeCents;
  const netCents = ebitdaCents - flow.depreciationCents - flow.interestCents - flow.taxProvisionCents;

  const first = range.monthIds[0]!;
  const last = range.monthIds[range.monthIds.length - 1]!;
  let openingCents = CASH_LADDER.opening.get(first) ?? data.openingCashCents;
  let closingCents = CASH_LADDER.closing.get(last) ?? data.openingCashCents;
  if (todayOnly && latestMonthId) {
    const full = FULL_FLOWS.get(latestMonthId)!;
    const today = flowOf(monthById(latestMonthId), true);
    openingCents = (CASH_LADDER.opening.get(latestMonthId) ?? data.openingCashCents) + (full.cashReceiptsCents - today.cashReceiptsCents) - (cashOut(full) - cashOut(today));
    closingCents = openingCents + today.cashReceiptsCents - cashOut(today);
  }

  const cumulative = cumulativeThrough(range.snapshotMonthId);
  const forecastMonths = range.monthIds.map((id) => monthById(id)).filter((month) => month.forecastRecognizedCents !== undefined);
  const leaderboard = presentLeaderboard(
    data.earners.map((earner) => {
      const totals = range.monthIds.reduce(
        (total, id) => {
          if (todayOnly) return total;
          const entry = earner.byMonth[id];
          if (!entry) return total;
          return { referrals: total.referrals + entry.referrals, approvedCents: total.approvedCents + entry.approvedCents };
        },
        { referrals: 0, approvedCents: 0 },
      );
      return {
        firstName: earner.firstName,
        optedIn: earner.optedIn,
        initials: earner.initials,
        referralCount: totals.referrals,
        earningsCents: totals.approvedCents,
      };
    }),
  ).filter((row) => row.earningsCents > 0);

  const acquired = todayOnly ? 0 : range.monthIds.reduce((total, id) => total + monthById(id).payingMembersAcquired, 0);

  return {
    range,
    updatedLabel: currentSnapshotLabel(),
    flow,
    recognized,
    allocation,
    moneyGrowth,
    expenseLines,
    operatingCents,
    budgetOperatingCents,
    fixedCents,
    variableCents,
    performance: {
      recognizedCents: recognized.totalCents,
      costOfServicesCents,
      grossProfitCents: recognized.totalCents - costOfServicesCents,
      payrollCents,
      technologyCents,
      marketingCents: flow.expenses.marketing,
      administrationCents,
      otherCents: flow.expenses.other,
      referralPaidCents: flow.referralPaidCents,
      contributorPaidCents: flow.contributorPaidCents,
      operatingCents: operatingForProfit,
      processingFeeCents: flow.processingFeeCents,
      ebitdaCents,
      depreciationCents: flow.depreciationCents,
      interestCents: flow.interestCents,
      taxCents: flow.taxProvisionCents,
      netCents,
      forecastRecognizedCents: forecastMonths.length ? forecastMonths.reduce((total, month) => total + (month.forecastRecognizedCents ?? 0), 0) : null,
      forecastExpenseCents: forecastMonths.length ? forecastMonths.reduce((total, month) => total + (month.forecastExpenseCents ?? 0), 0) : null,
    },
    cash: {
      openingCents,
      receiptsCents: flow.cashReceiptsCents,
      outflowsCents: cashOut(flow),
      closingCents,
    },
    runway: runwayFor(range.snapshotMonthId, closingCents),
    deferred: deferredAsOf(range.snapshotMonthId),
    liabilities: {
      referralUnpaidCents: cumulative.referralApproved - cumulative.referralPaid,
      contributorUnpaidCents: cumulative.contributorApproved - cumulative.contributorPaid,
      // No separate accounts-payable/receivable subledger exists in this app yet.
      payableCents: 0,
      receivableCents: 0,
    },
    community: {
      registered: snapshot.registered,
      paying,
      payingMonthly: snapshot.payingMonthly,
      payingAnnual: snapshot.payingAnnual,
      payingLifetime: snapshot.payingLifetime,
      trials: snapshot.trials,
      active: paying + snapshot.trials,
      newMembers: flow.newMembers,
      eventsCreated: flow.eventsCreated,
      eventsCompleted: flow.eventsCompleted,
      creditsIssued: flow.creditsIssued,
      creditsOutstanding: outstandingCredits(range.snapshotMonthId),
      creditsExchanged: flow.creditsExchanged,
      referralEarners: snapshot.referralEarners,
      contributionEarners: snapshot.contributionEarners,
      homes: snapshot.homesParticipating,
      hostingNights: flow.hostingNights,
      completedStays: flow.completedStays,
      skillsOffered: snapshot.skillsOffered,
      skillExchanges: flow.skillExchanges,
      growth: {
        registered: growthPercent(snapshot.registered, previousSnapshot?.registered ?? null),
        paying: growthPercent(paying, previousPaying),
        trials: growthPercent(snapshot.trials, previousSnapshot?.trials ?? null),
        newMembers: growthPercent(flow.newMembers, previousFlow?.newMembers ?? null),
        eventsCreated: growthPercent(flow.eventsCreated, previousFlow?.eventsCreated ?? null),
      },
    },
    windows: [
      { label: monthLabel(latestMonthId ?? range.snapshotMonthId), ...windowTotals(latestMonthId ? [latestMonthId] : []) },
      { label: `Last 3 months`, ...windowTotals(months.slice(-3).map((month) => month.id)) },
      {
        label: `${range.snapshotMonthId.slice(0, 4)} to date`,
        ...windowTotals(months.filter((month) => month.id.startsWith(range.snapshotMonthId.slice(0, 4))).map((month) => month.id)),
      },
      { label: "Lifetime", ...windowTotals(months.map((month) => month.id)) },
    ],
    series: range.monthIds.map((id) => seriesPoint(months, monthById(id), todayOnly && id === latestMonthId)),
    leaderboard,
    ledger: data.ledger.filter((row) => row.date >= range.start && row.date <= range.end),
    ownership: data.ownership,
    dividends: [],
    payingMembersAcquired: acquired,
    participation: {
      homes: data.homes,
      skills: data.skills,
      creditReasons: data.creditReasons,
    },
  };
}
