/**
 * Event Points and Facilitator Earnings — browser-safe prototype rules.
 * Versioned so past statements stay reproducible. Not adopted payout policy.
 */

export const ACCOUNTING_TIMEZONE = "Asia/Bangkok";

export const EVENT_POINTS_RULES = {
  version: "v1",
  label: "Event points v1",
  rsvp: 1,
  attend: 4,
  complete: 4,
  /** Awarded as max(0, stars − 1) when a 1–5 star rating is present. */
  ratingOffset: 1,
  writtenReview: 1,
  share: 1,
  maxPerMemberPerEvent: 15,
  poolPercent: 25,
  poolDenominator: 100,
  reviewWindowDaysAfterMonthEnd: 7,
  adopted: false,
} as const;

export type EventPointsActionType = "rsvp" | "attend" | "complete" | "rating" | "written_review" | "share";

export type MemberEventSignals = {
  eventId: string;
  memberId: string;
  /** Active RSVP still valid when the event started. */
  rsvp: boolean;
  /** Verified attendance (provider or authorized record). */
  attended: boolean;
  /** Verified attendee answered Yes to completing the session. */
  completed: boolean;
  /** Optional 1–5 stars. Written review requires a rating. */
  rating: number | null;
  /** Optional written comment with a rating. */
  writtenReview: boolean;
  /** One recorded share action for this member + event. */
  shared: boolean;
};

export type ScoredMemberEvent = {
  eventId: string;
  memberId: string;
  pointsByAction: {
    rsvp: number;
    attend: number;
    complete: number;
    rating: number;
    writtenReview: number;
    share: number;
  };
  totalPoints: number;
  capped: boolean;
};

export type HostShare = {
  facilitatorId: string;
  /** Basis points of the event, e.g. 7500 = 75%. Must sum to 10_000. */
  shareBps: number;
};

export type EventEligibility = {
  id: string;
  title: string;
  /** ISO end instant; accounting month is derived in Asia/Bangkok. */
  endsAt: string;
  status: "published" | "completed" | "cancelled" | "draft" | "unpublished" | "pending" | "rejected";
  /** Payable facilitator; first release credits 100% when splits omitted. */
  hostId: string;
  /** Explicit co-host split totaling 100%. Empty → 100% to hostId. */
  hostShares?: HostShare[];
  isTest?: boolean;
};

export type EventPointTotals = {
  eventId: string;
  title: string;
  monthId: string;
  hostId: string;
  eligible: boolean;
  uniqueRsvps: number;
  verifiedAttendees: number;
  completions: number;
  ratingCount: number;
  averageRating: number | null;
  writtenReviewCount: number;
  uniqueSharers: number;
  pointsByAction: ScoredMemberEvent["pointsByAction"];
  totalEventPoints: number;
  memberScores: ScoredMemberEvent[];
};

export type FacilitatorCredit = {
  facilitatorId: string;
  points: number;
  eventId: string;
  shareBps: number;
};

export type FacilitatorAllocation = {
  facilitatorId: string;
  points: number;
  shareOfPoints: number;
  allocatedCents: number;
};

export type MonthStatement = {
  monthId: string;
  rulesVersion: string;
  status: "provisional" | "finalized";
  updatedAt: string;
  eligibleRevenueCents: number;
  facilitatorPoolCents: number;
  totalEventPoints: number;
  undistributedCents: number;
  eligibleEventCount: number;
  leaderFacilitatorIds: string[];
  allocations: FacilitatorAllocation[];
  events: EventPointTotals[];
};

const ACTION_TYPES: EventPointsActionType[] = ["rsvp", "attend", "complete", "rating", "written_review", "share"];

export function actionKey(eventId: string, memberId: string, actionType: EventPointsActionType): string {
  return `${eventId}:${memberId}:${actionType}`;
}

/** Asia/Bangkok calendar month for an event end instant → YYYY-MM. */
export function accountingMonthId(endsAtIso: string, timeZone: string = ACCOUNTING_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(endsAtIso));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error(`Could not derive accounting month from ${endsAtIso}`);
  return `${year}-${month}`;
}

export function facilitatorPoolCents(eligibleRevenueCents: number, rules = EVENT_POINTS_RULES): number {
  if (!Number.isInteger(eligibleRevenueCents) || eligibleRevenueCents < 0) {
    throw new Error("Eligible revenue must be a non-negative whole number of cents.");
  }
  return Math.floor((eligibleRevenueCents * rules.poolPercent) / rules.poolDenominator);
}

/**
 * Score one member's actions for one event.
 * Host / credited co-host actions earn zero. Completion and rating require attendance.
 * Written review requires a rating. Cap at maxPerMemberPerEvent.
 */
export function scoreMemberEvent(
  signals: MemberEventSignals,
  options: { creditedFacilitatorIds: ReadonlySet<string> | readonly string[]; rules?: typeof EVENT_POINTS_RULES } = {
    creditedFacilitatorIds: [],
  },
): ScoredMemberEvent {
  const rules = options.rules ?? EVENT_POINTS_RULES;
  const credited = options.creditedFacilitatorIds instanceof Set
    ? options.creditedFacilitatorIds
    : new Set(options.creditedFacilitatorIds);

  if (credited.has(signals.memberId)) {
    return emptyScore(signals.eventId, signals.memberId);
  }

  const attended = signals.attended;
  const rating =
    attended && signals.rating !== null && Number.isInteger(signals.rating) && signals.rating >= 1 && signals.rating <= 5
      ? signals.rating
      : null;
  const writtenReview = attended && rating !== null && signals.writtenReview;

  const pointsByAction = {
    rsvp: signals.rsvp ? rules.rsvp : 0,
    attend: attended ? rules.attend : 0,
    complete: attended && signals.completed ? rules.complete : 0,
    rating: rating !== null ? Math.max(0, rating - rules.ratingOffset) : 0,
    writtenReview: writtenReview ? rules.writtenReview : 0,
    share: signals.shared ? rules.share : 0,
  };

  const raw =
    pointsByAction.rsvp +
    pointsByAction.attend +
    pointsByAction.complete +
    pointsByAction.rating +
    pointsByAction.writtenReview +
    pointsByAction.share;

  const totalPoints = Math.min(raw, rules.maxPerMemberPerEvent);
  return {
    eventId: signals.eventId,
    memberId: signals.memberId,
    pointsByAction,
    totalPoints,
    capped: raw > rules.maxPerMemberPerEvent,
  };
}

function emptyScore(eventId: string, memberId: string): ScoredMemberEvent {
  return {
    eventId,
    memberId,
    pointsByAction: { rsvp: 0, attend: 0, complete: 0, rating: 0, writtenReview: 0, share: 0 },
    totalPoints: 0,
    capped: false,
  };
}

/** Latest signal per member wins; duplicate share/RSVP inputs do not inflate. */
export function collapseMemberSignals(rows: MemberEventSignals[]): MemberEventSignals[] {
  const byKey = new Map<string, MemberEventSignals>();
  for (const row of rows) {
    byKey.set(`${row.eventId}:${row.memberId}`, row);
  }
  return [...byKey.values()];
}

export function isEligibleEvent(event: EventEligibility): boolean {
  if (event.isTest) return false;
  if (event.status === "cancelled" || event.status === "draft" || event.status === "pending" || event.status === "rejected" || event.status === "unpublished") {
    return false;
  }
  if (!event.hostId) return false;
  return event.status === "published" || event.status === "completed";
}

export function normalizeHostShares(event: EventEligibility): HostShare[] {
  const shares = event.hostShares?.length
    ? event.hostShares
    : [{ facilitatorId: event.hostId, shareBps: 10_000 }];
  const total = shares.reduce((sum, share) => sum + share.shareBps, 0);
  if (total !== 10_000) {
    throw new Error(`Host shares for event ${event.id} must total 100% (got ${total / 100}%).`);
  }
  for (const share of shares) {
    if (!Number.isInteger(share.shareBps) || share.shareBps < 0) {
      throw new Error(`Invalid host share for event ${event.id}.`);
    }
  }
  return shares;
}

export function creditedFacilitatorIds(event: EventEligibility): Set<string> {
  return new Set(normalizeHostShares(event).map((share) => share.facilitatorId));
}

export function summarizeEventPoints(
  event: EventEligibility,
  memberSignals: MemberEventSignals[],
): EventPointTotals {
  const monthId = accountingMonthId(event.endsAt);
  const eligible = isEligibleEvent(event);
  if (!eligible) {
    return {
      eventId: event.id,
      title: event.title,
      monthId,
      hostId: event.hostId,
      eligible: false,
      uniqueRsvps: 0,
      verifiedAttendees: 0,
      completions: 0,
      ratingCount: 0,
      averageRating: null,
      writtenReviewCount: 0,
      uniqueSharers: 0,
      pointsByAction: { rsvp: 0, attend: 0, complete: 0, rating: 0, writtenReview: 0, share: 0 },
      totalEventPoints: 0,
      memberScores: [],
    };
  }

  const credited = creditedFacilitatorIds(event);
  const collapsed = collapseMemberSignals(memberSignals.filter((row) => row.eventId === event.id));
  const memberScores = collapsed.map((row) => scoreMemberEvent(row, { creditedFacilitatorIds: credited }));

  let uniqueRsvps = 0;
  let verifiedAttendees = 0;
  let completions = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let writtenReviewCount = 0;
  let uniqueSharers = 0;
  const pointsByAction = { rsvp: 0, attend: 0, complete: 0, rating: 0, writtenReview: 0, share: 0 };

  for (const row of collapsed) {
    if (credited.has(row.memberId)) continue;
    if (row.rsvp) uniqueRsvps += 1;
    if (row.attended) verifiedAttendees += 1;
    if (row.attended && row.completed) completions += 1;
    if (row.attended && row.rating !== null && row.rating >= 1 && row.rating <= 5) {
      ratingCount += 1;
      ratingSum += row.rating;
      if (row.writtenReview) writtenReviewCount += 1;
    }
    if (row.shared) uniqueSharers += 1;
  }

  for (const score of memberScores) {
    pointsByAction.rsvp += score.pointsByAction.rsvp;
    pointsByAction.attend += score.pointsByAction.attend;
    pointsByAction.complete += score.pointsByAction.complete;
    pointsByAction.rating += score.pointsByAction.rating;
    pointsByAction.writtenReview += score.pointsByAction.writtenReview;
    pointsByAction.share += score.pointsByAction.share;
  }

  const totalEventPoints = memberScores.reduce((sum, score) => sum + score.totalPoints, 0);

  return {
    eventId: event.id,
    title: event.title,
    monthId,
    hostId: event.hostId,
    eligible: true,
    uniqueRsvps,
    verifiedAttendees,
    completions,
    ratingCount,
    averageRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    writtenReviewCount,
    uniqueSharers,
    pointsByAction,
    totalEventPoints,
    memberScores,
  };
}

/** Split event points across facilitators; event points counted once in monthly total. */
export function creditEventToFacilitators(totals: EventPointTotals, event: EventEligibility): FacilitatorCredit[] {
  if (!totals.eligible || totals.totalEventPoints === 0) return [];
  const shares = normalizeHostShares(event);
  const credits: FacilitatorCredit[] = [];
  let assigned = 0;
  for (let index = 0; index < shares.length; index += 1) {
    const share = shares[index]!;
    const points =
      index === shares.length - 1
        ? totals.totalEventPoints - assigned
        : Math.floor((totals.totalEventPoints * share.shareBps) / 10_000);
    assigned += points;
    credits.push({
      facilitatorId: share.facilitatorId,
      points,
      eventId: event.id,
      shareBps: share.shareBps,
    });
  }
  return credits;
}

/**
 * Round only at payout allocation. Floor each share, then assign leftover cents
 * by largest fractional remainder; stable facilitatorId breaks ties.
 */
export function allocateFacilitatorPool(
  poolCents: number,
  facilitatorPoints: ReadonlyArray<{ facilitatorId: string; points: number }>,
): { allocations: FacilitatorAllocation[]; undistributedCents: number } {
  if (!Number.isInteger(poolCents) || poolCents < 0) {
    throw new Error("Pool must be a non-negative whole number of cents.");
  }

  const merged = new Map<string, number>();
  for (const row of facilitatorPoints) {
    if (!Number.isInteger(row.points) || row.points < 0) {
      throw new Error("Facilitator points must be non-negative whole numbers.");
    }
    if (row.points === 0) continue;
    merged.set(row.facilitatorId, (merged.get(row.facilitatorId) ?? 0) + row.points);
  }

  const totalPoints = [...merged.values()].reduce((sum, points) => sum + points, 0);
  if (totalPoints === 0 || poolCents === 0) {
    return { allocations: [], undistributedCents: poolCents };
  }

  type Draft = {
    facilitatorId: string;
    points: number;
    shareOfPoints: number;
    floorCents: number;
    remainder: number;
  };

  const drafts: Draft[] = [...merged.entries()]
    .map(([facilitatorId, points]) => {
      const exact = (poolCents * points) / totalPoints;
      const floorCents = Math.floor(exact);
      return {
        facilitatorId,
        points,
        shareOfPoints: points / totalPoints,
        floorCents,
        remainder: exact - floorCents,
      };
    })
    .sort((a, b) => a.facilitatorId.localeCompare(b.facilitatorId));

  let leftover = poolCents - drafts.reduce((sum, draft) => sum + draft.floorCents, 0);
  const order = [...drafts].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.facilitatorId.localeCompare(b.facilitatorId);
  });

  const bonus = new Map<string, number>();
  for (const draft of order) {
    if (leftover <= 0) break;
    bonus.set(draft.facilitatorId, 1);
    leftover -= 1;
  }

  const allocations: FacilitatorAllocation[] = drafts.map((draft) => ({
    facilitatorId: draft.facilitatorId,
    points: draft.points,
    shareOfPoints: draft.shareOfPoints,
    allocatedCents: draft.floorCents + (bonus.get(draft.facilitatorId) ?? 0),
  }));

  return { allocations, undistributedCents: 0 };
}

export function buildMonthStatement(input: {
  monthId: string;
  events: EventEligibility[];
  memberSignals: MemberEventSignals[];
  eligibleRevenueCents: number;
  status: "provisional" | "finalized";
  updatedAt: string;
  rules?: typeof EVENT_POINTS_RULES;
}): MonthStatement {
  const rules = input.rules ?? EVENT_POINTS_RULES;
  const monthEvents = input.events.filter((event) => accountingMonthId(event.endsAt) === input.monthId);
  const eventTotals = monthEvents.map((event) =>
    summarizeEventPoints(
      event,
      input.memberSignals.filter((row) => row.eventId === event.id),
    ),
  );
  const eligibleEvents = eventTotals.filter((event) => event.eligible);
  const credits = monthEvents.flatMap((event, index) => creditEventToFacilitators(eventTotals[index]!, event));
  const totalEventPoints = eligibleEvents.reduce((sum, event) => sum + event.totalEventPoints, 0);
  const poolCents = facilitatorPoolCents(input.eligibleRevenueCents, rules);
  const { allocations, undistributedCents } = allocateFacilitatorPool(poolCents, credits);

  const maxPoints = allocations.reduce((max, row) => Math.max(max, row.points), 0);
  const leaderFacilitatorIds =
    maxPoints > 0 ? allocations.filter((row) => row.points === maxPoints).map((row) => row.facilitatorId).sort() : [];

  return {
    monthId: input.monthId,
    rulesVersion: rules.version,
    status: input.status,
    updatedAt: input.updatedAt,
    eligibleRevenueCents: input.eligibleRevenueCents,
    facilitatorPoolCents: poolCents,
    totalEventPoints,
    undistributedCents,
    eligibleEventCount: eligibleEvents.length,
    leaderFacilitatorIds,
    allocations: allocations.sort((a, b) => b.points - a.points || a.facilitatorId.localeCompare(b.facilitatorId)),
    events: eligibleEvents.sort((a, b) => b.totalEventPoints - a.totalEventPoints || a.title.localeCompare(b.title)),
  };
}

export function pointsActionLabels(): { type: EventPointsActionType; label: string; points: string }[] {
  return [
    { type: "rsvp", label: "RSVPs", points: String(EVENT_POINTS_RULES.rsvp) },
    { type: "attend", label: "Attends", points: String(EVENT_POINTS_RULES.attend) },
    { type: "complete", label: "Completes the session", points: String(EVENT_POINTS_RULES.complete) },
    { type: "rating", label: "Rates the event", points: `0–${5 - EVENT_POINTS_RULES.ratingOffset}` },
    { type: "written_review", label: "Writes a review", points: String(EVENT_POINTS_RULES.writtenReview) },
    { type: "share", label: "Shares the event", points: String(EVENT_POINTS_RULES.share) },
  ];
}

/** Post-event form answer — self-reported attendance is stored separately from verified attendance. */
export type EventReviewResponse = {
  eventId: string;
  memberId: string;
  selfReportedAttended: boolean | null;
  completed: boolean | null;
  rating: number | null;
  comment: string;
  shared: boolean;
  rsvp: boolean;
};

export function validateReviewResponse(response: EventReviewResponse): string | null {
  if (response.selfReportedAttended === null) return "Say whether you attended.";
  if (response.selfReportedAttended === false) return null;
  if (response.completed === null) return "Say whether you completed the session.";
  const trimmed = response.comment.trim();
  if (trimmed && (response.rating === null || response.rating < 1 || response.rating > 5)) {
    return "A written review needs a 1–5 star rating.";
  }
  if (response.rating !== null && (response.rating < 1 || response.rating > 5)) {
    return "Rating must be between 1 and 5 stars.";
  }
  return null;
}

/**
 * Score a review response for prototype display.
 * Completion and review points only apply when verified attendance is true.
 */
export function scoreReviewResponse(
  response: EventReviewResponse,
  options: {
    verifiedAttended: boolean;
    creditedFacilitatorIds?: ReadonlySet<string> | readonly string[];
  },
): ScoredMemberEvent {
  const attended = options.verifiedAttended;
  const wroteReview = Boolean(response.comment.trim()) && response.rating !== null;
  return scoreMemberEvent(
    {
      eventId: response.eventId,
      memberId: response.memberId,
      rsvp: response.rsvp,
      attended,
      completed: attended && response.completed === true,
      rating: attended ? response.rating : null,
      writtenReview: attended && wroteReview,
      shared: response.shared,
    },
    { creditedFacilitatorIds: options.creditedFacilitatorIds ?? [] },
  );
}

export { ACTION_TYPES };
