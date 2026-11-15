import { monthId, type ExpenseId, type MembershipStatus } from "@/lib/open-accounting/allocate";

export const OPENING_CASH_CENTS = 25_000_000;
export const AFFILIATE_URL = "https://example.com/one-world-family/join/avery";
export const HISTORY_YEARS = [2025, 2026] as const;

export type MonthInput = {
  id: string;
  monthlyInvoices: number;
  annualInvoices: number;
  lifetimeInvoices: number;
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
  forecastRecognizedCents?: number;
  forecastExpenseCents?: number;
  today?: TodaySlice;
};

export type TodaySlice = {
  monthlyInvoices: number;
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

export type EarnerInput = {
  id: string;
  firstName: string;
  optedIn: boolean;
  initials: string;
  byMonth: Record<string, { referrals: number; approvedCents: number; pendingCents: number }>;
};

export type InviteCredit = {
  monthId: string;
  cents: number;
  state: "approved" | "pending";
};

export type InviteInput = {
  id: string;
  firstName: string;
  registered: string;
  status: MembershipStatus;
  membershipType: string | null;
  typeDisclosed: boolean;
  lastPayment: string | null;
  credits: InviteCredit[];
};

export type EventInput = {
  id: string;
  name: string;
  date: string;
  number: string;
  role: string;
  status: string;
  registered: number;
  verified: number;
  approvedCents: number;
  payment: "Paid" | "Approved, unpaid" | "Pending" | "Points only";
};

export type StatementInput = {
  id: string;
  date: string;
  reason: string;
  cents: number;
  kind: "credit" | "advance" | "deduction";
  related: string;
  agreed: boolean;
};

export type PayoutInput = {
  id: string;
  date: string;
  covers: string;
  cents: number;
  status: "Paid" | "Scheduled";
};

const zeroToday = (partial: Partial<TodaySlice>): TodaySlice => ({
  monthlyInvoices: 0,
  processingFeeCents: 0,
  otherRevenueCents: 0,
  expenses: {},
  newMembers: 0,
  eventsCreated: 0,
  eventsCompleted: 0,
  creditsIssued: 0,
  creditsRedeemed: 0,
  creditsExchanged: 0,
  hostingNights: 0,
  completedStays: 0,
  skillExchanges: 0,
  points: 0,
  ...partial,
});

function base(id: string, patch: Partial<MonthInput>): MonthInput {
  return {
    id,
    monthlyInvoices: 0,
    annualInvoices: 0,
    lifetimeInvoices: 0,
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
    ...patch,
  };
}

const earlyExpenses: Partial<Record<ExpenseId, number>> = {
  salaries: 350_000,
  founders: 200_000,
  operations: 25_000,
  hosting: 6_000,
  software: 8_000,
  insurance: 12_000,
  accounting: 15_000,
};

const runningExpenses: Partial<Record<ExpenseId, number>> = {
  salaries: 450_000,
  founders: 250_000,
  contractors: 40_000,
  operations: 40_000,
  hosting: 8_000,
  software: 12_000,
  insurance: 18_000,
  accounting: 20_000,
  technology: 80_000,
  support: 15_000,
};

const months2025: MonthInput[] = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return base(monthId(2025, month), {
    expenses: {
      ...earlyExpenses,
      marketing: month % 3 === 0 ? 10_000 : 0,
      legal: month === 6 ? 30_000 : 0,
    },
    budgets: { marketing: 20_000, legal: month === 6 ? 20_000 : 0 },
    depreciationCents: 10_000,
    registered: 40 + month * 2,
    trials: 3,
    homesParticipating: 2,
    skillsOffered: 5,
    newMembers: 2,
    creditsIssued: 15,
    creditsRedeemed: 4,
    creditsExchanged: 1,
  });
});

const beforeMembership: MonthInput[] = [1, 2, 3].map((month) =>
  base(monthId(2026, month), {
    expenses: {
      ...runningExpenses,
      marketing: 20_000,
      legal: month === 2 ? 25_000 : 0,
    },
    budgets: { marketing: 35_000 },
    depreciationCents: 20_000,
    registered: 64 + month * 6,
    trials: 6,
    homesParticipating: 3,
    skillsOffered: 8,
    newMembers: 6,
    eventsCreated: 1,
    creditsIssued: 30,
    creditsRedeemed: 8,
    creditsExchanged: 2,
    skillExchanges: 1,
  }),
);

export const MONTHS: MonthInput[] = [
  ...months2025,
  ...beforeMembership,
  base("2026-04", {
    monthlyInvoices: 10,
    processingFeeCents: 400,
    expenses: { ...runningExpenses, marketing: 25_000 },
    budgets: { marketing: 40_000 },
    depreciationCents: 20_000,
    referralApprovedCents: 2_000,
    points: 20,
    newMembers: 12,
    eventsCreated: 2,
    eventsCompleted: 1,
    creditsIssued: 40,
    creditsRedeemed: 10,
    creditsExchanged: 3,
    hostingNights: 2,
    completedStays: 1,
    skillExchanges: 1,
    registered: 92,
    payingMonthly: 10,
    trials: 8,
    homesParticipating: 3,
    skillsOffered: 9,
    referralEarners: 2,
    contributionEarners: 1,
  }),
  base("2026-05", {
    monthlyInvoices: 16,
    processingFeeCents: 600,
    expenses: { ...runningExpenses, travel: 8_000 },
    budgets: { travel: 5_000 },
    depreciationCents: 20_000,
    referralApprovedCents: 4_000,
    points: 36,
    newMembers: 14,
    eventsCreated: 2,
    eventsCompleted: 2,
    creditsIssued: 48,
    creditsRedeemed: 12,
    creditsExchanged: 4,
    hostingNights: 3,
    completedStays: 1,
    skillExchanges: 2,
    registered: 110,
    payingMonthly: 18,
    trials: 9,
    homesParticipating: 4,
    skillsOffered: 10,
    referralEarners: 3,
    contributionEarners: 2,
  }),
  base("2026-06", {
    monthlyInvoices: 20,
    lifetimeInvoices: 1,
    processingFeeCents: 7_500,
    otherRevenueCents: 15_000,
    expenses: { ...runningExpenses, professional: 20_000 },
    depreciationCents: 20_000,
    taxProvisionCents: 5_000,
    referralApprovedCents: 6_000,
    points: 48,
    newMembers: 16,
    eventsCreated: 3,
    eventsCompleted: 2,
    creditsIssued: 55,
    creditsRedeemed: 14,
    creditsExchanged: 4,
    hostingNights: 4,
    completedStays: 2,
    skillExchanges: 2,
    registered: 130,
    payingMonthly: 28,
    payingLifetime: 1,
    trials: 10,
    homesParticipating: 4,
    skillsOffered: 11,
    referralEarners: 4,
    contributionEarners: 3,
  }),
  base("2026-07", {
    monthlyInvoices: 24,
    processingFeeCents: 1_000,
    expenses: runningExpenses,
    depreciationCents: 20_000,
    referralApprovedCents: 8_000,
    points: 40,
    newMembers: 18,
    eventsCreated: 2,
    eventsCompleted: 2,
    creditsIssued: 60,
    creditsRedeemed: 16,
    creditsExchanged: 5,
    hostingNights: 4,
    completedStays: 2,
    skillExchanges: 2,
    registered: 148,
    payingMonthly: 36,
    payingLifetime: 1,
    trials: 11,
    homesParticipating: 4,
    skillsOffered: 12,
    referralEarners: 5,
    contributionEarners: 3,
  }),
  base("2026-08", {
    monthlyInvoices: 30,
    discountCents: 2_900,
    processingFeeCents: 1_200,
    expenses: runningExpenses,
    depreciationCents: 20_000,
    referralApprovedCents: 9_000,
    referralPaidCents: 5_000,
    points: 80,
    newMembers: 16,
    eventsCreated: 3,
    eventsCompleted: 3,
    creditsIssued: 70,
    creditsRedeemed: 18,
    creditsExchanged: 6,
    hostingNights: 5,
    completedStays: 2,
    skillExchanges: 3,
    registered: 164,
    payingMonthly: 44,
    payingLifetime: 1,
    trials: 12,
    homesParticipating: 5,
    skillsOffered: 12,
    referralEarners: 5,
    contributionEarners: 4,
  }),
  base("2026-09", {
    monthlyInvoices: 36,
    processingFeeCents: 3_200,
    expenses: { ...runningExpenses, marketing: 30_000 },
    budgets: { marketing: 25_000 },
    depreciationCents: 20_000,
    referralApprovedCents: 12_000,
    referralPaidCents: 6_000,
    contributorApprovedCents: 15_000,
    points: 120,
    newMembers: 18,
    eventsCreated: 4,
    eventsCompleted: 4,
    creditsIssued: 80,
    creditsRedeemed: 22,
    creditsExchanged: 7,
    hostingNights: 6,
    completedStays: 3,
    skillExchanges: 3,
    registered: 182,
    payingMonthly: 52,
    payingLifetime: 1,
    trials: 12,
    homesParticipating: 5,
    skillsOffered: 13,
    referralEarners: 6,
    contributionEarners: 5,
  }),
  base("2026-10", {
    monthlyInvoices: 40,
    annualInvoices: 1,
    discountCents: 2_900,
    processingFeeCents: 4_000,
    otherRevenueCents: 30_000,
    expenses: { ...runningExpenses, marketing: 15_000, facilitator: 12_000 },
    budgets: { marketing: 40_000, facilitator: 10_000 },
    depreciationCents: 20_000,
    referralApprovedCents: 24_000,
    referralPaidCents: 10_000,
    contributorApprovedCents: 30_000,
    contributorPaidCents: 18_000,
    points: 140,
    newMembers: 20,
    eventsCreated: 4,
    eventsCompleted: 4,
    creditsIssued: 90,
    creditsRedeemed: 24,
    creditsExchanged: 8,
    hostingNights: 7,
    completedStays: 3,
    skillExchanges: 4,
    registered: 198,
    payingMonthly: 60,
    payingAnnual: 4,
    payingLifetime: 1,
    trials: 13,
    homesParticipating: 5,
    skillsOffered: 14,
    referralEarners: 7,
    contributionEarners: 6,
  }),
  base("2026-11", {
    monthlyInvoices: 12,
    processingFeeCents: 1_200,
    expenses: { ...runningExpenses, marketing: 5_000 },
    budgets: { marketing: 40_000 },
    depreciationCents: 8_000,
    referralPendingCents: 4_000,
    points: 30,
    newMembers: 8,
    eventsCreated: 2,
    eventsCompleted: 1,
    creditsIssued: 24,
    creditsRedeemed: 6,
    creditsExchanged: 2,
    hostingNights: 2,
    completedStays: 1,
    skillExchanges: 1,
    registered: 210,
    payingMonthly: 64,
    payingAnnual: 4,
    payingLifetime: 1,
    trials: 14,
    homesParticipating: 5,
    skillsOffered: 14,
    referralEarners: 7,
    contributionEarners: 6,
    forecastRecognizedCents: 180_000,
    forecastExpenseCents: 900_000,
    today: zeroToday({
      monthlyInvoices: 2,
      processingFeeCents: 200,
      expenses: { software: 2_000 },
      newMembers: 1,
      creditsIssued: 2,
    }),
  }),
];

export const EARNERS: EarnerInput[] = [
  {
    id: "avery",
    firstName: "Avery",
    optedIn: true,
    initials: "AV",
    byMonth: {
      "2026-07": { referrals: 1, approvedCents: 2_900, pendingCents: 0 },
      "2026-08": { referrals: 1, approvedCents: 2_900, pendingCents: 0 },
      "2026-09": { referrals: 1, approvedCents: 2_900, pendingCents: 0 },
      "2026-10": { referrals: 2, approvedCents: 8_700, pendingCents: 0 },
      "2026-11": { referrals: 1, approvedCents: 0, pendingCents: 1_450 },
    },
  },
  {
    id: "mina",
    firstName: "Mina",
    optedIn: true,
    initials: "MI",
    byMonth: {
      "2026-04": { referrals: 1, approvedCents: 1_200, pendingCents: 0 },
      "2026-05": { referrals: 1, approvedCents: 1_500, pendingCents: 0 },
      "2026-06": { referrals: 1, approvedCents: 1_800, pendingCents: 0 },
      "2026-07": { referrals: 1, approvedCents: 2_000, pendingCents: 0 },
      "2026-08": { referrals: 1, approvedCents: 2_200, pendingCents: 0 },
      "2026-09": { referrals: 2, approvedCents: 3_400, pendingCents: 0 },
      "2026-10": { referrals: 2, approvedCents: 5_000, pendingCents: 0 },
      "2026-11": { referrals: 0, approvedCents: 0, pendingCents: 800 },
    },
  },
  {
    id: "leo",
    firstName: "Leo",
    optedIn: true,
    initials: "LE",
    byMonth: {
      "2026-05": { referrals: 1, approvedCents: 1_000, pendingCents: 0 },
      "2026-06": { referrals: 1, approvedCents: 1_400, pendingCents: 0 },
      "2026-07": { referrals: 1, approvedCents: 1_500, pendingCents: 0 },
      "2026-08": { referrals: 1, approvedCents: 1_600, pendingCents: 0 },
      "2026-09": { referrals: 1, approvedCents: 2_200, pendingCents: 0 },
      "2026-10": { referrals: 1, approvedCents: 3_300, pendingCents: 0 },
      "2026-11": { referrals: 0, approvedCents: 0, pendingCents: 600 },
    },
  },
  {
    id: "sasha",
    firstName: "Sasha",
    optedIn: false,
    initials: "SA",
    byMonth: {
      "2026-04": { referrals: 1, approvedCents: 800, pendingCents: 0 },
      "2026-06": { referrals: 2, approvedCents: 2_800, pendingCents: 0 },
      "2026-07": { referrals: 1, approvedCents: 1_000, pendingCents: 0 },
      "2026-08": { referrals: 1, approvedCents: 1_400, pendingCents: 0 },
      "2026-09": { referrals: 1, approvedCents: 2_000, pendingCents: 0 },
      "2026-10": { referrals: 2, approvedCents: 4_500, pendingCents: 0 },
      "2026-11": { referrals: 1, approvedCents: 0, pendingCents: 700 },
    },
  },
  {
    id: "priya",
    firstName: "Priya",
    optedIn: false,
    initials: "PR",
    byMonth: {
      "2026-05": { referrals: 1, approvedCents: 1_500, pendingCents: 0 },
      "2026-07": { referrals: 1, approvedCents: 600, pendingCents: 0 },
      "2026-08": { referrals: 1, approvedCents: 900, pendingCents: 0 },
      "2026-09": { referrals: 1, approvedCents: 1_500, pendingCents: 0 },
      "2026-10": { referrals: 1, approvedCents: 2_500, pendingCents: 0 },
      "2026-11": { referrals: 0, approvedCents: 0, pendingCents: 450 },
    },
  },
];

export const INVITES: InviteInput[] = [
  {
    id: "quinn",
    firstName: "Quinn",
    registered: "2026-07-04",
    status: "cancelled",
    membershipType: "Monthly",
    typeDisclosed: true,
    lastPayment: "2026-08-05",
    credits: [
      { monthId: "2026-07", cents: 2_900, state: "approved" },
      { monthId: "2026-08", cents: 2_900, state: "approved" },
    ],
  },
  {
    id: "rio",
    firstName: "Rio",
    registered: "2026-08-20",
    status: "expired-trial",
    membershipType: null,
    typeDisclosed: false,
    lastPayment: null,
    credits: [],
  },
  {
    id: "nora",
    firstName: "Nora",
    registered: "2026-09-02",
    status: "active-paid",
    membershipType: "Monthly",
    typeDisclosed: true,
    lastPayment: "2026-10-03",
    credits: [
      { monthId: "2026-09", cents: 2_900, state: "approved" },
      { monthId: "2026-10", cents: 2_900, state: "approved" },
      { monthId: "2026-11", cents: 1_450, state: "pending" },
    ],
  },
  {
    id: "jules",
    firstName: "Jules",
    registered: "2026-10-11",
    status: "active-paid",
    membershipType: "Annual",
    typeDisclosed: true,
    lastPayment: "2026-10-11",
    credits: [{ monthId: "2026-10", cents: 5_800, state: "approved" }],
  },
  {
    id: "sam",
    firstName: "Sam",
    registered: "2026-10-18",
    status: "free-trial",
    membershipType: null,
    typeDisclosed: false,
    lastPayment: null,
    credits: [],
  },
  {
    id: "kai",
    firstName: "Kai",
    registered: "2026-11-03",
    status: "free-trial",
    membershipType: null,
    typeDisclosed: false,
    lastPayment: null,
    credits: [],
  },
];

export const EVENTS: EventInput[] = [
  {
    id: "evt-104",
    name: "Morning circle",
    date: "2026-08-12",
    number: "104",
    role: "Host",
    status: "Completed",
    registered: 18,
    verified: 12,
    approvedCents: 0,
    payment: "Points only",
  },
  {
    id: "evt-118",
    name: "Story workshop",
    date: "2026-09-20",
    number: "118",
    role: "Host",
    status: "Completed",
    registered: 24,
    verified: 20,
    approvedCents: 15_000,
    payment: "Paid",
  },
  {
    id: "evt-131",
    name: "Harvest salon",
    date: "2026-10-16",
    number: "131",
    role: "Facilitator",
    status: "Completed",
    registered: 30,
    verified: 22,
    approvedCents: 20_000,
    payment: "Approved, unpaid",
  },
  {
    id: "evt-140",
    name: "Open studio",
    date: "2026-11-04",
    number: "140",
    role: "Host",
    status: "Completed",
    registered: 8,
    verified: 6,
    approvedCents: 0,
    payment: "Pending",
  },
];

export const STATEMENT: StatementInput[] = [
  {
    id: "cr-204",
    date: "2026-08-02",
    reason: "Welcome credit",
    cents: 2_500,
    kind: "credit",
    related: "CR-204",
    agreed: true,
  },
  {
    id: "adv-118",
    date: "2026-09-15",
    reason: "Advance for facilitating the story workshop",
    cents: 10_000,
    kind: "advance",
    related: "ADV-118",
    agreed: true,
  },
  {
    id: "mem-442",
    date: "2026-10-01",
    reason: "Complimentary monthly membership, agreed in advance",
    cents: 2_900,
    kind: "deduction",
    related: "MEM-442",
    agreed: true,
  },
  {
    id: "ref-19",
    date: "2026-10-22",
    reason: "Refund-related adjustment on a referred membership",
    cents: 1_000,
    kind: "deduction",
    related: "REF-19",
    agreed: true,
  },
];

export const PAYOUTS: PayoutInput[] = [
  { id: "pay-jul", date: "2026-08-20", covers: "July 2026", cents: 2_900, status: "Paid" },
  { id: "pay-aug", date: "2026-09-20", covers: "August 2026", cents: 2_900, status: "Paid" },
  { id: "pay-sep", date: "2026-10-20", covers: "September 2026", cents: 17_900, status: "Paid" },
  { id: "pay-oct", date: "2026-11-20", covers: "October 2026", cents: 17_300, status: "Scheduled" },
];

export const OWNERSHIP = [
  { name: "Founding members", share: "70%", units: "700,000", status: "Verified" as const },
  { name: "Investor equity", share: "20%", units: "200,000", status: "Verified" as const },
  { name: "Reserved for employees and incentives", share: "10%", units: "100,000", status: "Verified" as const },
];

export const DIVIDENDS: { id: string; cents: number }[] = [];

export const ACCOUNTS_PAYABLE_CENTS = 75_000;
export const ACCOUNTS_RECEIVABLE_CENTS = 0;

export const FOLLOW_UP_MESSAGE =
  "Your invitation to One World Family is still open. When you are ready, you can join from the link I sent. There is no payment due unless you choose a membership.";

export const PAYMENT_METHOD = "Bank transfer on file";
