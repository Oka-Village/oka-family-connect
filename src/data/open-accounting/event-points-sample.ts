/**
 * Deterministic Event Points prototype fixture.
 * Points and allocations are sample-only until live action tables exist.
 */

import {
  actionKey,
  buildMonthStatement,
  creditEventToFacilitators,
  summarizeEventPoints,
  type EventEligibility,
  type EventPointTotals,
  type FacilitatorCredit,
  type MemberEventSignals,
  type MonthStatement,
} from "@/lib/open-accounting/event-points";

export type FacilitatorProfile = {
  id: string;
  displayName: string;
};

export type EdgeCaseDemo = {
  id: string;
  title: string;
  detail: string;
};

export type AttendanceClaimRow = {
  id: string;
  eventId: string;
  eventTitle: string;
  memberId: string;
  memberLabel: string;
  claimedAt: string;
  status: "pending" | "approved" | "rejected";
  reviewer: string | null;
  reason: string | null;
};

export type StatementAdjustment = {
  id: string;
  monthId: string;
  kind: "late_refund" | "points_correction" | "chargeback";
  reason: string;
  amountCents: number;
  preservesOriginalStatement: true;
};

export type FacilitatorAdvance = {
  facilitatorId: string;
  advanceCents: number;
  note: string;
};

export type ShareActionDemo = {
  eventId: string;
  memberId: string;
  attemptCount: number;
  recordedKey: string;
  pointsAwarded: number;
};

export type EventPointsSampleBundle = {
  months: MonthStatement[];
  facilitators: FacilitatorProfile[];
  edgeCases: EdgeCaseDemo[];
  featuredEventId: string;
  demoEvent: EventPointTotals;
  /** Co-host 75/25 demo — scored for UI; not rolled into the $2,500 November totals. */
  cohostEvent: EventPointTotals;
  cohostCredits: FacilitatorCredit[];
  cohostEligibility: EventEligibility;
  /** Host share map for events that need non-100% credit display. */
  eventHostShares: Record<string, FacilitatorCredit[]>;
  attendanceClaims: AttendanceClaimRow[];
  adjustments: StatementAdjustment[];
  advances: FacilitatorAdvance[];
  shareActionDemos: ShareActionDemo[];
  /** Default facilitator for My Earnings demo. */
  defaultEarningsFacilitatorId: string;
  payoutStatusByFacilitator: Record<string, "scheduled" | "processing" | "paid" | "pending">;
};

const FACILITATORS: FacilitatorProfile[] = [
  { id: "A", displayName: "Facilitator A" },
  { id: "B", displayName: "Facilitator B" },
  { id: "C", displayName: "Facilitator C" },
  { id: "D", displayName: "Facilitator D" },
];

function fullMember(eventId: string, memberId: string, overrides: Partial<MemberEventSignals> = {}): MemberEventSignals {
  return {
    eventId,
    memberId,
    rsvp: true,
    attended: true,
    completed: true,
    rating: 5,
    writtenReview: true,
    shared: true,
    ...overrides,
  };
}

function addFullMembers(signals: MemberEventSignals[], eventId: string, count: number, prefix: string) {
  for (let i = 0; i < count; i += 1) {
    signals.push(fullMember(eventId, `${prefix}-${i}`));
  }
}

/** November 2026 — matches the spec example ($10,000 → $2,500 pool; A–D splits). */
function novemberSample(): { events: EventEligibility[]; signals: MemberEventSignals[]; featuredEventId: string } {
  const events: EventEligibility[] = [
    { id: "nov-a1", title: "Sunrise Sharing Circle", endsAt: "2026-11-05T03:00:00.000Z", status: "completed", hostId: "A" },
    { id: "nov-a2", title: "Breath & Belonging", endsAt: "2026-11-08T04:00:00.000Z", status: "completed", hostId: "A" },
    { id: "nov-a3", title: "Family Story Night", endsAt: "2026-11-12T12:00:00.000Z", status: "completed", hostId: "A" },
    { id: "nov-a4", title: "Gratitude Walk", endsAt: "2026-11-20T05:00:00.000Z", status: "completed", hostId: "A" },
    { id: "nov-b1", title: "Deep Listening Lab", endsAt: "2026-11-06T09:00:00.000Z", status: "completed", hostId: "B" },
    { id: "nov-b2", title: "Conflict as Care", endsAt: "2026-11-18T10:00:00.000Z", status: "completed", hostId: "B" },
    { id: "nov-c1", title: "Music for Kinship", endsAt: "2026-11-07T11:00:00.000Z", status: "completed", hostId: "C" },
    { id: "nov-c2", title: "Kitchen Table Talk", endsAt: "2026-11-14T12:00:00.000Z", status: "completed", hostId: "C" },
    { id: "nov-c3", title: "Evening Stillness", endsAt: "2026-11-22T13:00:00.000Z", status: "completed", hostId: "C" },
    { id: "nov-d1", title: "New Member Welcome", endsAt: "2026-11-09T06:00:00.000Z", status: "completed", hostId: "D" },
    { id: "nov-cancel", title: "Canceled Practice (excluded)", endsAt: "2026-11-11T08:00:00.000Z", status: "cancelled", hostId: "A" },
    { id: "nov-draft", title: "Draft Circle (excluded)", endsAt: "2026-11-16T08:00:00.000Z", status: "draft", hostId: "B" },
  ];

  const signals: MemberEventSignals[] = [];
  addFullMembers(signals, "nov-a1", 8, "a1");
  addFullMembers(signals, "nov-a2", 8, "a2");
  addFullMembers(signals, "nov-a3", 8, "a3");
  addFullMembers(signals, "nov-a4", 8, "a4");
  addFullMembers(signals, "nov-b1", 12, "b1");
  addFullMembers(signals, "nov-b2", 12, "b2");
  addFullMembers(signals, "nov-c1", 6, "c1");
  addFullMembers(signals, "nov-c2", 5, "c2");
  addFullMembers(signals, "nov-c3", 5, "c3");
  addFullMembers(signals, "nov-d1", 8, "d1");
  signals.push(fullMember("nov-cancel", "cancel-member-1"));

  return { events, signals, featuredEventId: "nov-b1" };
}

function buildDemoEvent(): { totals: EventPointTotals; shareDemos: ShareActionDemo[] } {
  const event: EventEligibility = {
    id: "nov-showcase",
    title: "Participation Patterns (demo)",
    endsAt: "2026-11-25T10:00:00.000Z",
    status: "completed",
    hostId: "B",
  };
  const signals: MemberEventSignals[] = [
    fullMember(event.id, "demo-noshow", {
      attended: false,
      completed: false,
      rating: null,
      writtenReview: false,
      shared: false,
    }),
    fullMember(event.id, "demo-walkin", {
      rsvp: false,
      attended: true,
      completed: true,
      rating: 5,
      writtenReview: true,
      shared: false,
    }),
    fullMember(event.id, "demo-partial", {
      rsvp: true,
      attended: true,
      completed: false,
      rating: 4,
      writtenReview: true,
      shared: false,
    }),
    fullMember(event.id, "demo-1star", {
      rsvp: true,
      attended: true,
      completed: false,
      rating: 1,
      writtenReview: true,
      shared: false,
    }),
    fullMember(event.id, "demo-edit", {
      rsvp: true,
      attended: true,
      completed: true,
      rating: 3,
      writtenReview: false,
      shared: false,
    }),
    fullMember(event.id, "demo-edit", {
      rsvp: true,
      attended: true,
      completed: true,
      rating: 5,
      writtenReview: true,
      shared: true,
    }),
    fullMember(event.id, "demo-share", {
      rsvp: true,
      attended: false,
      completed: false,
      rating: null,
      writtenReview: false,
      shared: true,
    }),
    fullMember(event.id, "demo-share", {
      rsvp: true,
      attended: false,
      completed: false,
      rating: null,
      writtenReview: false,
      shared: true,
    }),
    fullMember(event.id, "B"),
  ];

  const shareDemos: ShareActionDemo[] = [
    {
      eventId: event.id,
      memberId: "demo-share",
      attemptCount: 2,
      recordedKey: actionKey(event.id, "demo-share", "share"),
      pointsAwarded: 1,
    },
    {
      eventId: event.id,
      memberId: "demo-edit",
      attemptCount: 1,
      recordedKey: actionKey(event.id, "demo-edit", "share"),
      pointsAwarded: 1,
    },
  ];

  return { totals: summarizeEventPoints(event, signals), shareDemos };
}

/** 120-point event with 75% / 25% co-host split → 90 + 30 credits. */
function buildCohostDemo(): {
  eligibility: EventEligibility;
  totals: EventPointTotals;
  credits: FacilitatorCredit[];
} {
  const eligibility: EventEligibility = {
    id: "nov-cohost",
    title: "Shared Hosting Circle (75/25 demo)",
    endsAt: "2026-11-28T09:00:00.000Z",
    status: "completed",
    hostId: "A",
    hostShares: [
      { facilitatorId: "A", shareBps: 7500 },
      { facilitatorId: "B", shareBps: 2500 },
    ],
  };
  const signals: MemberEventSignals[] = [];
  addFullMembers(signals, eligibility.id, 8, "coh");
  const totals = summarizeEventPoints(eligibility, signals);
  const credits = creditEventToFacilitators(totals, eligibility);
  return { eligibility, totals, credits };
}

function octoberZeroPoint(): { events: EventEligibility[]; signals: MemberEventSignals[] } {
  return {
    events: [
      {
        id: "oct-empty",
        title: "Quiet Month Gathering",
        endsAt: "2026-10-18T10:00:00.000Z",
        status: "completed",
        hostId: "A",
      },
    ],
    signals: [],
  };
}

function decemberProvisional(): { events: EventEligibility[]; signals: MemberEventSignals[] } {
  const events: EventEligibility[] = [
    {
      id: "dec-c1",
      title: "Year-End Listening",
      endsAt: "2026-12-03T11:00:00.000Z",
      status: "completed",
      hostId: "C",
    },
  ];
  const signals: MemberEventSignals[] = [];
  addFullMembers(signals, "dec-c1", 4, "dec-c");
  signals.push(
    fullMember("dec-c1", "late-reviewer", {
      rsvp: true,
      attended: true,
      completed: true,
      rating: 5,
      writtenReview: true,
      shared: false,
    }),
  );
  return { events, signals };
}

const ATTENDANCE_CLAIMS: AttendanceClaimRow[] = [
  {
    id: "claim-1",
    eventId: "nov-b1",
    eventTitle: "Deep Listening Lab",
    memberId: "walkin-claim-1",
    memberLabel: "Member W.",
    claimedAt: "2026-11-06T12:00:00.000Z",
    status: "pending",
    reviewer: null,
    reason: null,
  },
  {
    id: "claim-2",
    eventId: "nov-b2",
    eventTitle: "Conflict as Care",
    memberId: "partial-claim-2",
    memberLabel: "Member P.",
    claimedAt: "2026-11-18T14:30:00.000Z",
    status: "approved",
    reviewer: "Staff Maya",
    reason: "Host confirmed walk-in on attendance sheet.",
  },
  {
    id: "claim-3",
    eventId: "nov-a3",
    eventTitle: "Family Story Night",
    memberId: "reject-claim-3",
    memberLabel: "Member R.",
    claimedAt: "2026-11-13T08:00:00.000Z",
    status: "rejected",
    reviewer: "Staff Jon",
    reason: "No presence in room or Daily attendance log.",
  },
];

const ADJUSTMENTS: StatementAdjustment[] = [
  {
    id: "adj-nov-1",
    monthId: "2026-11",
    kind: "late_refund",
    reason: "Membership refund after the month was closed (−$125). Original statement kept.",
    amountCents: -12_500,
    preservesOriginalStatement: true,
  },
  {
    id: "adj-nov-2",
    monthId: "2026-11",
    kind: "points_correction",
    reason: "Attendance fixed later for Facilitator B. Points note only — original statement kept.",
    amountCents: 0,
    preservesOriginalStatement: true,
  },
];

const ADVANCES: FacilitatorAdvance[] = [
  {
    facilitatorId: "B",
    advanceCents: 20_000,
    note: "Production advance offset against future facilitator earnings.",
  },
];

const EDGE_CASES: EdgeCaseDemo[] = [
  {
    id: "no-show",
    title: "No-show",
    detail: "RSVP stayed active but the member did not attend — 1 point only.",
  },
  {
    id: "walk-in",
    title: "Walk-in",
    detail: "No RSVP; attendance, completion, and review still earn points.",
  },
  {
    id: "partial",
    title: "Partial attendee",
    detail: "Attended part of the session, rated and reviewed without completion points.",
  },
  {
    id: "review-edit",
    title: "Review edit",
    detail: "Latest valid response replaces the earlier one — points are never doubled.",
  },
  {
    id: "duplicate-share",
    title: "Duplicate share",
    detail: "One signed-in share per member per event; repeats do not add points.",
  },
  {
    id: "canceled",
    title: "Canceled event",
    detail: "Canceled and draft events are excluded from eligible count and points.",
  },
  {
    id: "zero-month",
    title: "Zero-point month",
    detail: "October sample: pool is recorded as undistributed with no facilitator allocations.",
  },
  {
    id: "host-zero",
    title: "Host actions",
    detail: "A facilitator’s own RSVP, attendance, review, and share earn zero for their event.",
  },
  {
    id: "cohost",
    title: "Co-host split",
    detail: "A 120-point event with 75% / 25% credits 90 and 30; the event still counts once in the monthly total.",
  },
  {
    id: "attendance-claim",
    title: "Missing attendance check",
    detail:
      "If the app did not record that someone was there, they can say “I was there.” That request waits for staff. This prototype only shows the idea — not a live approval screen.",
  },
];

export function loadEventPointsSample(): EventPointsSampleBundle {
  const november = novemberSample();
  const october = octoberZeroPoint();
  const december = decemberProvisional();
  const demo = buildDemoEvent();
  const cohost = buildCohostDemo();

  const novStatement = buildMonthStatement({
    monthId: "2026-11",
    events: november.events,
    memberSignals: november.signals,
    eligibleRevenueCents: 1_000_000,
    status: "finalized",
    updatedAt: "2026-12-08T06:00:00.000Z",
  });

  const octStatement = buildMonthStatement({
    monthId: "2026-10",
    events: october.events,
    memberSignals: october.signals,
    eligibleRevenueCents: 800_000,
    status: "finalized",
    updatedAt: "2026-11-08T06:00:00.000Z",
  });

  const decStatement = buildMonthStatement({
    monthId: "2026-12",
    events: december.events,
    memberSignals: december.signals,
    eligibleRevenueCents: 920_000,
    status: "provisional",
    updatedAt: "2026-12-20T09:30:00.000Z",
  });

  return {
    months: [decStatement, novStatement, octStatement],
    facilitators: FACILITATORS,
    edgeCases: EDGE_CASES,
    featuredEventId: november.featuredEventId,
    demoEvent: demo.totals,
    cohostEvent: cohost.totals,
    cohostCredits: cohost.credits,
    cohostEligibility: cohost.eligibility,
    eventHostShares: {
      [cohost.eligibility.id]: cohost.credits,
    },
    attendanceClaims: ATTENDANCE_CLAIMS,
    adjustments: ADJUSTMENTS,
    advances: ADVANCES,
    shareActionDemos: demo.shareDemos,
    defaultEarningsFacilitatorId: "B",
    payoutStatusByFacilitator: {
      A: "scheduled",
      B: "scheduled",
      C: "pending",
      D: "paid",
    },
  };
}

export function facilitatorName(bundle: EventPointsSampleBundle, id: string): string {
  return bundle.facilitators.find((row) => row.id === id)?.displayName ?? id;
}

export function creditsForEvent(
  bundle: EventPointsSampleBundle,
  event: EventPointTotals | null,
): FacilitatorCredit[] {
  if (!event) return [];
  if (event.eventId === bundle.cohostEvent.eventId) return bundle.cohostCredits;
  const mapped = bundle.eventHostShares[event.eventId];
  if (mapped) return mapped;
  return [{ facilitatorId: event.hostId, points: event.totalEventPoints, eventId: event.eventId, shareBps: 10_000 }];
}
