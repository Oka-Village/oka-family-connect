import {
  ANNUAL_PRICE_CENTS,
  ANNUAL_RECOGNITION_MONTHS,
  EXPENSE_CATEGORIES,
  LIFETIME_PRICE_CENTS,
  LIFETIME_RECOGNITION_MONTHS,
  MONTHLY_PRICE_CENTS,
  SNAPSHOT_LABEL,
  contributionPoints,
  eligibleCents,
  emptyExpenses,
  eventEarningsCents,
  grossMembershipCents,
  growthPercent,
  monthLabel,
  netBalance,
  nextPayout,
  parseMonthId,
  presentLeaderboard,
  recognitionSchedule,
  resolveRange,
  shiftMonth,
  splitEligible,
  type BalanceView,
  type DateRange,
  type ExpenseId,
  type LeaderboardRow,
  type MembershipActivity,
  type RangeKind,
} from "@/lib/open-accounting/allocate";
import {
  ACCOUNTS_PAYABLE_CENTS,
  ACCOUNTS_RECEIVABLE_CENTS,
  AFFILIATE_URL,
  DIVIDENDS,
  EARNERS,
  EVENTS,
  INVITES,
  MONTHS,
  OPENING_CASH_CENTS,
  OWNERSHIP,
  PAYMENT_METHOD,
  PAYOUTS,
  STATEMENT,
  type EventInput,
  type InviteInput,
  type MonthInput,
} from "./sample-ledger";

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
  ownership: typeof OWNERSHIP;
  dividends: typeof DIVIDENDS;
  payingMembersAcquired: number;
};

export type MemberAccount = {
  affiliateUrl: string;
  referralCents: number;
  contributionCents: number;
  earnedCents: number;
  adjustmentCents: number;
  paidCents: number;
  pendingCents: number;
  approvedUnpaidCents: number;
  balance: BalanceView;
  nextPayout: ReturnType<typeof nextPayout>;
  paymentMethod: string;
  statement: typeof STATEMENT;
  payouts: typeof PAYOUTS;
  events: (EventInput & { points: number; earningsCents: number })[];
  invites: InviteInput[];
  exceptions: string[];
};

const STRIPE_SOURCE = "Stripe stand-in";
const SHEET_SOURCE = "Reviewed expense sheet";

const COST_IDS: ExpenseId[] = ["facilitator", "support", "travel"];
const PAYROLL_IDS: ExpenseId[] = ["salaries", "contractors", "founders"];
const TECH_IDS: ExpenseId[] = ["technology", "hosting", "software"];
const ADMIN_IDS: ExpenseId[] = ["operations", "legal", "accounting", "taxCompliance", "insurance", "professional"];

function monthById(id: string): MonthInput {
  const month = MONTHS.find((item) => item.id === id);
  if (!month) throw new Error(`Missing sample month ${id}`);
  return month;
}

function activityOf(month: MonthInput, todayOnly: boolean): MembershipActivity {
  if (todayOnly) {
    const today = month.today;
    return {
      monthlyInvoices: today?.monthlyInvoices ?? 0,
      annualInvoices: 0,
      lifetimeInvoices: 0,
      discountCents: 0,
      refundCents: 0,
      chargebackCents: 0,
      taxCents: 0,
      processingFeeCents: today?.processingFeeCents ?? 0,
    };
  }
  return {
    monthlyInvoices: month.monthlyInvoices,
    annualInvoices: month.annualInvoices,
    lifetimeInvoices: month.lifetimeInvoices,
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
  const monthlyCashCents =
    activity.monthlyInvoices * MONTHLY_PRICE_CENTS - activity.discountCents - activity.refundCents - activity.chargebackCents;
  const annualCashCents = activity.annualInvoices * ANNUAL_PRICE_CENTS;
  const lifetimeCashCents = activity.lifetimeInvoices * LIFETIME_PRICE_CENTS;
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
  return flowOf(monthById("2025-01"), true);
}

function cashOut(flow: MoneyFlow): number {
  const operating = EXPENSE_CATEGORIES.filter((category) => !category.bridge).reduce((sum, category) => sum + flow.expenses[category.id], 0);
  return flow.processingFeeCents + operating + flow.depreciationCents + flow.interestCents + flow.taxProvisionCents;
}

const FULL_FLOWS = new Map(MONTHS.map((month) => [month.id, flowOf(month, false)]));

const CASH_LADDER = (() => {
  let cursor = OPENING_CASH_CENTS;
  const opening = new Map<string, number>();
  const closing = new Map<string, number>();
  for (const month of MONTHS) {
    opening.set(month.id, cursor);
    const flow = FULL_FLOWS.get(month.id)!;
    cursor += flow.cashReceiptsCents - cashOut(flow);
    closing.set(month.id, cursor);
  }
  return { opening, closing };
})();

function recognizedIn(monthIds: string[], todayOnly: boolean): AccountingView["recognized"] {
  const ids = new Set(monthIds);
  let monthlyCents = 0;
  let annualCents = 0;
  let lifetimeCents = 0;
  let otherCents = 0;
  for (const month of MONTHS) {
    if (ids.has(month.id)) {
      const flow = flowOf(month, todayOnly && month.id === "2026-11");
      monthlyCents += flow.monthlyCashCents;
      otherCents += flow.otherRevenueCents;
    }
    if (todayOnly) continue;
    recognitionSchedule(month.annualInvoices * ANNUAL_PRICE_CENTS, ANNUAL_RECOGNITION_MONTHS).forEach((cents, offset) => {
      if (ids.has(shiftMonth(month.id, offset))) annualCents += cents;
    });
    recognitionSchedule(month.lifetimeInvoices * LIFETIME_PRICE_CENTS, LIFETIME_RECOGNITION_MONTHS).forEach((cents, offset) => {
      if (ids.has(shiftMonth(month.id, offset))) lifetimeCents += cents;
    });
  }
  return { monthlyCents, annualCents, lifetimeCents, otherCents, totalCents: monthlyCents + annualCents + lifetimeCents + otherCents };
}

function deferredAsOf(snapshotMonthId: string) {
  let annualCents = 0;
  let lifetimeCents = 0;
  for (const month of MONTHS) {
    recognitionSchedule(month.annualInvoices * ANNUAL_PRICE_CENTS, ANNUAL_RECOGNITION_MONTHS).forEach((cents, offset) => {
      if (shiftMonth(month.id, offset) > snapshotMonthId) annualCents += cents;
    });
    recognitionSchedule(month.lifetimeInvoices * LIFETIME_PRICE_CENTS, LIFETIME_RECOGNITION_MONTHS).forEach((cents, offset) => {
      if (shiftMonth(month.id, offset) > snapshotMonthId) lifetimeCents += cents;
    });
  }
  return { annualCents, lifetimeCents, totalCents: annualCents + lifetimeCents };
}

function outstandingCredits(snapshotMonthId: string): number {
  return MONTHS.reduce((total, month) => {
    if (month.id > snapshotMonthId) return total;
    return total + month.creditsIssued - month.creditsRedeemed;
  }, 0);
}

function cumulativeThrough(snapshotMonthId: string) {
  return MONTHS.reduce(
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

function budgetFor(month: MonthInput, id: ExpenseId, actual: number, kind: "fixed" | "variable", bridge: boolean): number {
  if (month.budgets[id] !== undefined) return month.budgets[id] ?? 0;
  if (bridge || id === "referralPaid" || id === "contributorPaid" || actual === 0 || kind === "fixed") return actual;
  return Math.round(actual * 1.1);
}

function sumFlows(monthIds: string[], todayOnly: boolean): MoneyFlow {
  return monthIds.reduce((total, id) => addFlow(total, flowOf(monthById(id), todayOnly && id === "2026-11")), blankFlow());
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
  const prior = MONTHS.filter((month) => month.id < snapshotMonthId).slice(-3);
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
  const months = Math.round((closingCents / -average) * 10) / 10;
  return { months, note: "Closing cash divided by the average cash decrease of the three prior months." };
}

function pushLedger(rows: LedgerRow[], row: LedgerRow) {
  rows.push(row);
}

function buildLedger(): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const month of MONTHS) {
    const flow = FULL_FLOWS.get(month.id)!;
    if (month.id === "2026-11") {
      const todayInvoices = month.today?.monthlyInvoices ?? 0;
      const restInvoices = month.monthlyInvoices - todayInvoices;
      const todayFee = month.today?.processingFeeCents ?? 0;
      pushLedger(rows, receiptRow("2026-11-04", "MBR-2026-11-A", restInvoices * MONTHLY_PRICE_CENTS, month.processingFeeCents - todayFee));
      pushLedger(rows, receiptRow("2026-11-08", "MBR-2026-11-B", todayInvoices * MONTHLY_PRICE_CENTS, todayFee));
    } else if (flow.monthlyCashCents + flow.annualCashCents + flow.lifetimeCashCents !== 0) {
      pushLedger(
        rows,
        receiptRow(
          `${month.id}-15`,
          `MBR-${month.id}`,
          flow.monthlyCashCents + flow.annualCashCents + flow.lifetimeCashCents,
          month.id === "2026-10" ? 4_500 : flow.processingFeeCents,
        ),
      );
    }
    if (month.id === "2026-10") {
      pushLedger(rows, {
        id: "FEE-2026-10-R",
        date: "2026-10-21",
        type: "Correction",
        reference: "FEE-2026-10-R",
        category: "Payment processing fees",
        grossCents: -500,
        feeCents: -500,
        netCents: -500,
        allocation: "Reduces the original fee",
        settlement: "Correction — original row kept",
        source: STRIPE_SOURCE,
      });
    }
    if (flow.otherRevenueCents !== 0) {
      pushLedger(rows, {
        id: `OTH-${month.id}`,
        date: `${month.id}-15`,
        type: "Other revenue",
        reference: `OTH-${month.id}`,
        category: "Events and workshops",
        grossCents: flow.otherRevenueCents,
        feeCents: 0,
        netCents: flow.otherRevenueCents,
        allocation: "Outside the 50/25/25 base",
        settlement: "Recorded",
        source: SHEET_SOURCE,
      });
    }
    if (flow.refundCents + flow.chargebackCents !== 0) {
      const amount = flow.refundCents + flow.chargebackCents;
      pushLedger(rows, {
        id: `REF-${month.id}`,
        date: `${month.id}-18`,
        type: "Refund",
        reference: `REF-${month.id}`,
        category: "Refunds and chargebacks",
        grossCents: -amount,
        feeCents: 0,
        netCents: -amount,
        allocation: "Reduces eligible revenue",
        settlement: "Recorded",
        source: STRIPE_SOURCE,
      });
    }
    for (const category of EXPENSE_CATEGORIES) {
      if (category.bridge || category.id === "referralPaid" || category.id === "contributorPaid") continue;
      const actual = month.expenses[category.id] ?? 0;
      if (actual === 0) continue;
      if (month.id === "2026-11" && category.id === "software" && month.today?.expenses.software) {
        const todayPart = month.today.expenses.software;
        pushLedger(rows, expenseRow("2026-11-08", "EXP-2026-11-SW-D", category.label, todayPart));
        pushLedger(rows, expenseRow("2026-11-06", "EXP-2026-11-SW", category.label, actual - todayPart));
        continue;
      }
      const expenseDate = month.id === "2026-11" ? "2026-11-06" : `${month.id}-15`;
      pushLedger(rows, expenseRow(expenseDate, `EXP-${month.id}-${category.id}`, category.label, actual));
    }
    if (month.referralPaidCents !== 0) {
      pushLedger(rows, payoutRow(`${month.id}-20`, `RWD-R-${month.id}`, "Referral rewards paid", month.referralPaidCents));
    }
    if (month.contributorPaidCents !== 0) {
      pushLedger(rows, payoutRow(`${month.id}-20`, `RWD-C-${month.id}`, "Contributor rewards paid", month.contributorPaidCents));
    }
  }
  return rows;
}

function receiptRow(date: string, reference: string, grossCents: number, feeCents: number): LedgerRow {
  return {
    id: reference,
    date,
    type: "Membership receipt",
    reference,
    category: "Membership income",
    grossCents,
    feeCents,
    netCents: grossCents - feeCents,
    allocation: "Eligible revenue",
    settlement: "Recorded",
    source: STRIPE_SOURCE,
  };
}

function expenseRow(date: string, reference: string, category: string, cents: number): LedgerRow {
  return {
    id: reference,
    date,
    type: "Expense",
    reference,
    category,
    grossCents: cents,
    feeCents: 0,
    netCents: cents,
    allocation: "Operating cost",
    settlement: "Recorded",
    source: SHEET_SOURCE,
  };
}

function payoutRow(date: string, reference: string, category: string, cents: number): LedgerRow {
  return {
    id: reference,
    date,
    type: "Reward payout",
    reference,
    category,
    grossCents: cents,
    feeCents: 0,
    netCents: cents,
    allocation: category.startsWith("Referral") ? "Inside referral pool" : "Inside contributor pool",
    settlement: "Paid",
    source: SHEET_SOURCE,
  };
}

const LEDGER = buildLedger();

function seriesPoint(month: MonthInput, todayOnly: boolean): AccountingView["series"][number] {
  const flow = flowOf(month, todayOnly);
  const recognized = recognizedIn([month.id], todayOnly);
  const operating = EXPENSE_CATEGORIES.filter((category) => !category.bridge).reduce((sum, category) => sum + flow.expenses[category.id], 0);
  const ebitda = recognized.totalCents - operating - flow.processingFeeCents;
  const net = ebitda - flow.depreciationCents - flow.interestCents - flow.taxProvisionCents;
  const paying = month.payingMonthly + month.payingAnnual + month.payingLifetime;
  const allocation = splitEligible(flow.eligibleCents);
  return {
    id: month.id,
    label: todayOnly ? "8 Nov" : monthLabel(month.id).slice(0, 3),
    eligibleCents: flow.eligibleCents,
    membershipCashCents: flow.monthlyCashCents + flow.annualCashCents + flow.lifetimeCashCents,
    recognizedCents: recognized.totalCents,
    expenseCents: operating,
    ebitdaCents: ebitda,
    netCents: net,
    members: month.registered,
    paying,
    mrrCents: month.payingMonthly * MONTHLY_PRICE_CENTS + month.payingAnnual * (ANNUAL_PRICE_CENTS / ANNUAL_RECOGNITION_MONTHS),
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

export function buildAccounting(kind: RangeKind, year?: number): AccountingView {
  const range = resolveRange(kind, year);
  const todayOnly = kind === "today";
  const flow = sumFlows(range.monthIds, todayOnly);
  const recognized = recognizedIn(range.monthIds, todayOnly);
  const allocation = splitEligible(flow.eligibleCents);
  const previousFlow = range.previousMonthIds ? sumFlows(range.previousMonthIds, false) : null;
  const previousHeadline = previousFlow && range.previousMonthIds ? headline(previousFlow, recognizedIn(range.previousMonthIds, false).totalCents) : null;
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
          (total, id) => total + budgetFor(monthById(id), category.id, FULL_FLOWS.get(id)!.expenses[category.id], category.kind, category.bridge),
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
  let openingCents = CASH_LADDER.opening.get(first)!;
  let closingCents = CASH_LADDER.closing.get(last)!;
  if (todayOnly) {
    const full = FULL_FLOWS.get("2026-11")!;
    const today = flowOf(monthById("2026-11"), true);
    openingCents = CASH_LADDER.opening.get("2026-11")! + (full.cashReceiptsCents - today.cashReceiptsCents) - (cashOut(full) - cashOut(today));
    closingCents = openingCents + today.cashReceiptsCents - cashOut(today);
  }

  const cumulative = cumulativeThrough(range.snapshotMonthId);
  const forecastMonths = range.monthIds.map((id) => monthById(id)).filter((month) => month.forecastRecognizedCents !== undefined);
  const leaderboard = presentLeaderboard(
    EARNERS.map((earner) => {
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

  const acquired = INVITES.filter((invite) => {
    const registeredMonth = invite.registered.slice(0, 7);
    return range.monthIds.includes(registeredMonth) && !todayOnly && (invite.status === "active-paid" || invite.status === "cancelled");
  }).length;

  return {
    range,
    updatedLabel: SNAPSHOT_LABEL,
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
      payableCents: ACCOUNTS_PAYABLE_CENTS,
      receivableCents: ACCOUNTS_RECEIVABLE_CENTS,
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
      { label: "November 2026", ...windowTotals(["2026-11"]) },
      { label: "Q4 2026", ...windowTotals(["2026-10", "2026-11"]) },
      { label: "2026 to date", ...windowTotals(MONTHS.filter((month) => month.id.startsWith("2026")).map((month) => month.id)) },
      { label: "Lifetime", ...windowTotals(MONTHS.map((month) => month.id)) },
    ],
    series: range.monthIds.map((id) => seriesPoint(monthById(id), todayOnly && id === "2026-11")),
    leaderboard,
    ledger: LEDGER.filter((row) => row.date >= range.start && row.date <= range.end),
    ownership: OWNERSHIP,
    dividends: DIVIDENDS,
    payingMembersAcquired: acquired,
  };
}

function becamePaying(status: InviteInput["status"]): boolean {
  return status === "active-paid" || status === "cancelled";
}

export function memberMonthIds(): string[] {
  return MONTHS.map((month) => month.id);
}

export function memberMonth(id: string) {
  const { year } = parseMonthId(id);
  const yearIds = MONTHS.filter((month) => month.id.startsWith(String(year))).map((month) => month.id);
  const invited = INVITES.filter((invite) => invite.registered.slice(0, 7) === id);
  const earnedCents = INVITES.reduce(
    (total, invite) => total + invite.credits.filter((credit) => credit.monthId === id && credit.state === "approved").reduce((sum, credit) => sum + credit.cents, 0),
    0,
  );
  const pendingCents = INVITES.reduce(
    (total, invite) => total + invite.credits.filter((credit) => credit.monthId === id && credit.state === "pending").reduce((sum, credit) => sum + credit.cents, 0),
    0,
  );
  const priorActiveCents = INVITES.reduce((total, invite) => {
    if (invite.status !== "active-paid" || invite.registered.slice(0, 7) >= id) return total;
    return total + invite.credits.filter((credit) => credit.monthId === id && credit.state === "approved").reduce((sum, credit) => sum + credit.cents, 0);
  }, 0);
  const payingCount = invited.filter((invite) => becamePaying(invite.status)).length;
  return {
    id,
    label: monthLabel(id),
    invited,
    invitedCount: invited.length,
    payingCount,
    conversion: invited.length === 0 ? null : Math.round((payingCount / invited.length) * 1000) / 10,
    earnedCents,
    priorActiveCents,
    pendingCents,
    yearSeries: yearIds.map((month) => ({
      id: month,
      label: monthLabel(month).slice(0, 3),
      invited: INVITES.filter((invite) => invite.registered.slice(0, 7) === month).length,
      earnedCents: INVITES.reduce(
        (total, invite) =>
          total + invite.credits.filter((credit) => credit.monthId === month && credit.state === "approved").reduce((sum, credit) => sum + credit.cents, 0),
        0,
      ),
    })),
  };
}

export function spanFor(anchor: string, grain: "month" | "quarter" | "year"): string[] {
  const { year, month } = parseMonthId(anchor);
  const dataEnd = MONTHS[MONTHS.length - 1]!.id;
  if (grain === "month") return [anchor];
  if (grain === "year") {
    const end = monthIdEnd(year, dataEnd);
    return MONTHS.filter((item) => item.id >= `${year}-01` && item.id <= end).map((item) => item.id);
  }
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, "0")}`;
  const endMonth = startMonth + 2;
  const end = `${year}-${String(endMonth).padStart(2, "0")}`;
  return MONTHS.filter((item) => item.id >= start && item.id <= end && item.id <= dataEnd).map((item) => item.id);
}

function monthIdEnd(year: number, dataEnd: string): string {
  const december = `${year}-12`;
  return december < dataEnd ? december : dataEnd.startsWith(String(year)) ? dataEnd : december;
}

export function buildMemberAccount(): MemberAccount {
  const events = EVENTS.map((event) => ({
    ...event,
    points: contributionPoints(1, event.verified),
    earningsCents: eventEarningsCents(event.approvedCents),
  }));
  const referralCents = INVITES.reduce(
    (total, invite) => total + invite.credits.filter((credit) => credit.state === "approved").reduce((sum, credit) => sum + credit.cents, 0),
    0,
  );
  const contributionCents = events.reduce((total, event) => total + event.earningsCents, 0);
  const creditsCents = STATEMENT.filter((row) => row.kind === "credit").reduce((total, row) => total + row.cents, 0);
  const advancesCents = STATEMENT.filter((row) => row.kind === "advance").reduce((total, row) => total + row.cents, 0);
  const deductionsCents = STATEMENT.filter((row) => row.kind === "deduction").reduce((total, row) => total + row.cents, 0);
  const paidCents = PAYOUTS.filter((payout) => payout.status === "Paid").reduce((total, payout) => total + payout.cents, 0);
  const pendingCents = INVITES.reduce(
    (total, invite) => total + invite.credits.filter((credit) => credit.state === "pending").reduce((sum, credit) => sum + credit.cents, 0),
    0,
  );
  const balance = netBalance({
    approvedEarningsCents: referralCents + contributionCents,
    creditsCents,
    advancesCents,
    deductionsCents,
    previousPayoutsCents: paidCents,
  });
  return {
    affiliateUrl: AFFILIATE_URL,
    referralCents,
    contributionCents,
    earnedCents: referralCents + contributionCents,
    adjustmentCents: creditsCents - advancesCents - deductionsCents,
    paidCents,
    pendingCents,
    approvedUnpaidCents: referralCents + contributionCents - paidCents,
    balance,
    nextPayout: nextPayout(),
    paymentMethod: PAYMENT_METHOD,
    statement: STATEMENT,
    payouts: PAYOUTS,
    events,
    invites: INVITES,
    exceptions: [
      "November earnings are still open. Pending referral credit is not in the 20 November payout.",
      "No payout threshold is set.",
      "The refund-related adjustment is already in the balance. It is not deducted a second time.",
    ],
  };
}

function assertSample() {
  let referralApproved = 0;
  let referralPaid = 0;
  let contributorApproved = 0;
  let contributorPaid = 0;
  for (const month of MONTHS) {
    const approved = EARNERS.reduce((total, earner) => total + (earner.byMonth[month.id]?.approvedCents ?? 0), 0);
    const pending = EARNERS.reduce((total, earner) => total + (earner.byMonth[month.id]?.pendingCents ?? 0), 0);
    if (approved !== month.referralApprovedCents) throw new Error(`${month.id} referral credits do not match the pool inputs.`);
    if (pending !== month.referralPendingCents) throw new Error(`${month.id} pending credits do not match.`);
    const split = splitEligible(FULL_FLOWS.get(month.id)!.eligibleCents);
    if (approved + pending > split.referralCents) throw new Error(`${month.id} referral credits exceed the pool.`);
    if (month.contributorApprovedCents > split.contributorCents) throw new Error(`${month.id} contributor approvals exceed the pool.`);
    referralApproved += approved;
    referralPaid += month.referralPaidCents;
    contributorApproved += month.contributorApprovedCents;
    contributorPaid += month.contributorPaidCents;
    if (referralPaid > referralApproved || contributorPaid > contributorApproved) throw new Error(`${month.id} paid more than had been approved.`);
    if (month.today) {
      if (month.today.monthlyInvoices > month.monthlyInvoices || month.today.processingFeeCents > month.processingFeeCents) {
        throw new Error("Today is larger than the month.");
      }
      for (const [id, amount] of Object.entries(month.today.expenses)) {
        if ((amount ?? 0) > (month.expenses[id as ExpenseId] ?? 0)) throw new Error("Today's expense exceeds the month.");
      }
    }
  }
  const avery = EARNERS.find((earner) => earner.id === "avery");
  if (!avery) throw new Error("Avery is missing.");
  for (const [id, entry] of Object.entries(avery.byMonth)) {
    const approved = INVITES.reduce(
      (total, invite) => total + invite.credits.filter((credit) => credit.monthId === id && credit.state === "approved").reduce((sum, credit) => sum + credit.cents, 0),
      0,
    );
    const pending = INVITES.reduce(
      (total, invite) => total + invite.credits.filter((credit) => credit.monthId === id && credit.state === "pending").reduce((sum, credit) => sum + credit.cents, 0),
      0,
    );
    if (approved !== entry.approvedCents || pending !== entry.pendingCents) throw new Error(`Avery's ${id} credits drifted.`);
  }
  const complimentary = STATEMENT.filter((row) => row.reason.toLowerCase().includes("complimentary"));
  if (complimentary.length !== 1 || complimentary.some((row) => !row.agreed)) throw new Error("Complimentary deduction must be agreed.");
  const account = buildMemberAccount();
  const scheduled = PAYOUTS.find((payout) => payout.status === "Scheduled");
  if (!scheduled || scheduled.cents !== account.balance.cents) throw new Error("Scheduled payout does not match the available balance.");
  if (DIVIDENDS.length !== 0) throw new Error("Dividends stay empty until one is declared.");
  const octoberMonth = FULL_FLOWS.get("2026-10")!;
  if (octoberMonth.eligibleCents !== 209_000) throw new Error("October eligible revenue drifted.");
  const morning = account.events.find((event) => event.number === "104");
  if (!morning || morning.points !== 22 || morning.earningsCents !== 0) throw new Error("Points were converted into cash.");
}

assertSample();
