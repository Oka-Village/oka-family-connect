import { describe, expect, it } from "vitest";

import {
  accountingMonthId,
  allocateFacilitatorPool,
  buildMonthStatement,
  collapseMemberSignals,
  creditEventToFacilitators,
  EVENT_POINTS_RULES,
  facilitatorPoolCents,
  scoreMemberEvent,
  scoreReviewResponse,
  summarizeEventPoints,
  validateReviewResponse,
  type EventEligibility,
  type MemberEventSignals,
} from "./event-points";

const host = "host-a";
const member = "member-1";

function baseSignals(overrides: Partial<MemberEventSignals> = {}): MemberEventSignals {
  return {
    eventId: "evt-1",
    memberId: member,
    rsvp: false,
    attended: false,
    completed: false,
    rating: null,
    writtenReview: false,
    shared: false,
    ...overrides,
  };
}

function baseEvent(overrides: Partial<EventEligibility> = {}): EventEligibility {
  return {
    id: "evt-1",
    title: "Morning Circle",
    endsAt: "2026-11-15T10:00:00.000Z",
    status: "completed",
    hostId: host,
    ...overrides,
  };
}

describe("scoreMemberEvent", () => {
  it("awards RSVP-only as 1 point", () => {
    const score = scoreMemberEvent(baseSignals({ rsvp: true }), { creditedFacilitatorIds: [host] });
    expect(score.totalPoints).toBe(1);
    expect(score.pointsByAction.rsvp).toBe(1);
  });

  it("scores RSVP + attend + complete + written 5-star + share as 15", () => {
    const score = scoreMemberEvent(
      baseSignals({
        rsvp: true,
        attended: true,
        completed: true,
        rating: 5,
        writtenReview: true,
        shared: true,
      }),
      { creditedFacilitatorIds: [host] },
    );
    expect(score.totalPoints).toBe(15);
    expect(score.capped).toBe(false);
  });

  it("scores RSVP + attend + complete + written 5-star without share as 14", () => {
    const score = scoreMemberEvent(
      baseSignals({
        rsvp: true,
        attended: true,
        completed: true,
        rating: 5,
        writtenReview: true,
      }),
      { creditedFacilitatorIds: [host] },
    );
    expect(score.totalPoints).toBe(14);
  });

  it("awards written 1-star as 1 review point (stars − 1 = 0 + written 1)", () => {
    const score = scoreMemberEvent(
      baseSignals({ attended: true, rating: 1, writtenReview: true }),
      { creditedFacilitatorIds: [host] },
    );
    expect(score.pointsByAction.rating).toBe(0);
    expect(score.pointsByAction.writtenReview).toBe(1);
    expect(score.totalPoints).toBe(5); // attend 4 + written 1
  });

  it("allows walk-in attendance without RSVP", () => {
    const score = scoreMemberEvent(
      baseSignals({ attended: true, completed: true, rating: 4, writtenReview: true }),
      { creditedFacilitatorIds: [host] },
    );
    expect(score.pointsByAction.rsvp).toBe(0);
    expect(score.totalPoints).toBe(4 + 4 + 3 + 1);
  });

  it("zeros host and co-host actions", () => {
    const score = scoreMemberEvent(
      baseSignals({
        memberId: host,
        rsvp: true,
        attended: true,
        completed: true,
        rating: 5,
        writtenReview: true,
        shared: true,
      }),
      { creditedFacilitatorIds: [host, "co-host"] },
    );
    expect(score.totalPoints).toBe(0);
  });

  it("ignores completion and rating without attendance", () => {
    const score = scoreMemberEvent(
      baseSignals({ rsvp: true, completed: true, rating: 5, writtenReview: true }),
      { creditedFacilitatorIds: [host] },
    );
    expect(score.totalPoints).toBe(1);
  });
});

describe("collapseMemberSignals", () => {
  it("keeps one row per member per event so edits replace", () => {
    const collapsed = collapseMemberSignals([
      baseSignals({ rating: 3, writtenReview: false, attended: true }),
      baseSignals({ rating: 5, writtenReview: true, attended: true }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.rating).toBe(5);
    expect(collapsed[0]?.writtenReview).toBe(true);
  });
});

describe("accountingMonthId", () => {
  it("assigns Bangkok month from event end", () => {
    // 2026-11-30 20:00 UTC = 2026-12-01 03:00 Bangkok → December
    expect(accountingMonthId("2026-11-30T20:00:00.000Z")).toBe("2026-12");
    // 2026-11-30 10:00 UTC = 2026-11-30 17:00 Bangkok → November
    expect(accountingMonthId("2026-11-30T10:00:00.000Z")).toBe("2026-11");
  });
});

describe("facilitatorPoolCents", () => {
  it("takes 25% floored in cents", () => {
    expect(facilitatorPoolCents(1_000_000)).toBe(250_000);
    expect(facilitatorPoolCents(101)).toBe(25);
  });
});

describe("allocateFacilitatorPool", () => {
  it("matches the sample month dollar splits", () => {
    const { allocations, undistributedCents } = allocateFacilitatorPool(250_000, [
      { facilitatorId: "A", points: 480 },
      { facilitatorId: "B", points: 360 },
      { facilitatorId: "C", points: 240 },
      { facilitatorId: "D", points: 120 },
    ]);
    expect(undistributedCents).toBe(0);
    expect(allocations.reduce((sum, row) => sum + row.allocatedCents, 0)).toBe(250_000);
    const byId = Object.fromEntries(allocations.map((row) => [row.facilitatorId, row.allocatedCents]));
    expect(byId.A).toBe(100_000);
    expect(byId.B).toBe(75_000);
    expect(byId.C).toBe(50_000);
    expect(byId.D).toBe(25_000);
  });

  it("records the full pool as undistributed when points are zero", () => {
    const { allocations, undistributedCents } = allocateFacilitatorPool(250_000, []);
    expect(allocations).toEqual([]);
    expect(undistributedCents).toBe(250_000);
  });

  it("assigns leftover cents by largest remainder with stable id ties", () => {
    const { allocations } = allocateFacilitatorPool(100, [
      { facilitatorId: "b", points: 1 },
      { facilitatorId: "a", points: 1 },
      { facilitatorId: "c", points: 1 },
    ]);
    expect(allocations.reduce((sum, row) => sum + row.allocatedCents, 0)).toBe(100);
    // 100/3 = 33.333… → floors 33 each (99), leftover 1 → highest remainder tie → lowest id "a"
    const byId = Object.fromEntries(allocations.map((row) => [row.facilitatorId, row.allocatedCents]));
    expect(byId.a).toBe(34);
    expect(byId.b).toBe(33);
    expect(byId.c).toBe(33);
  });
});

describe("creditEventToFacilitators", () => {
  it("applies an explicit 75/25 co-host split", () => {
    const event = baseEvent({
      hostShares: [
        { facilitatorId: "A", shareBps: 7500 },
        { facilitatorId: "B", shareBps: 2500 },
      ],
    });
    const totals = summarizeEventPoints(event, [
      baseSignals({
        rsvp: true,
        attended: true,
        completed: true,
        rating: 5,
        writtenReview: true,
        shared: true,
      }),
    ]);
    expect(totals.totalEventPoints).toBe(15);
    const credits = creditEventToFacilitators(totals, event);
    expect(credits).toEqual([
      { facilitatorId: "A", points: 11, eventId: "evt-1", shareBps: 7500 },
      { facilitatorId: "B", points: 4, eventId: "evt-1", shareBps: 2500 },
    ]);
  });
});

describe("summarizeEventPoints", () => {
  it("excludes canceled events", () => {
    const totals = summarizeEventPoints(baseEvent({ status: "cancelled" }), [
      baseSignals({ rsvp: true, attended: true }),
    ]);
    expect(totals.eligible).toBe(false);
    expect(totals.totalEventPoints).toBe(0);
  });

  it("ignores duplicate share rows via collapse", () => {
    const totals = summarizeEventPoints(baseEvent(), [
      baseSignals({ shared: true }),
      baseSignals({ shared: true }),
    ]);
    expect(totals.uniqueSharers).toBe(1);
    expect(totals.pointsByAction.share).toBe(1);
  });
});

describe("review response helpers", () => {
  it("requires a rating when a written comment is present", () => {
    expect(
      validateReviewResponse({
        eventId: "evt-1",
        memberId: member,
        selfReportedAttended: true,
        completed: true,
        rating: null,
        comment: "Thanks",
        shared: false,
        rsvp: true,
      }),
    ).toMatch(/star rating/i);
  });

  it("scores completion only after verified attendance", () => {
    const response = {
      eventId: "evt-1",
      memberId: member,
      selfReportedAttended: true,
      completed: true,
      rating: 5,
      comment: "Great",
      shared: false,
      rsvp: true,
    };
    const unverified = scoreReviewResponse(response, { verifiedAttended: false, creditedFacilitatorIds: [host] });
    expect(unverified.totalPoints).toBe(1); // RSVP only until verified
    const verified = scoreReviewResponse(response, { verifiedAttended: true, creditedFacilitatorIds: [host] });
    expect(verified.totalPoints).toBe(14);
  });
});

describe("buildMonthStatement", () => {
  it("builds the example month with 1,200 points and a $2,500 pool", () => {
    const events: EventEligibility[] = [
      { id: "e-a1", title: "A1", endsAt: "2026-11-05T10:00:00.000Z", status: "completed", hostId: "A" },
      { id: "e-a2", title: "A2", endsAt: "2026-11-08T10:00:00.000Z", status: "completed", hostId: "A" },
      { id: "e-a3", title: "A3", endsAt: "2026-11-12T10:00:00.000Z", status: "completed", hostId: "A" },
      { id: "e-a4", title: "A4", endsAt: "2026-11-20T10:00:00.000Z", status: "completed", hostId: "A" },
      { id: "e-b1", title: "B1", endsAt: "2026-11-06T10:00:00.000Z", status: "completed", hostId: "B" },
      { id: "e-b2", title: "B2", endsAt: "2026-11-18T10:00:00.000Z", status: "completed", hostId: "B" },
      { id: "e-c1", title: "C1", endsAt: "2026-11-07T10:00:00.000Z", status: "completed", hostId: "C" },
      { id: "e-c2", title: "C2", endsAt: "2026-11-14T10:00:00.000Z", status: "completed", hostId: "C" },
      { id: "e-c3", title: "C3", endsAt: "2026-11-22T10:00:00.000Z", status: "completed", hostId: "C" },
      { id: "e-d1", title: "D1", endsAt: "2026-11-09T10:00:00.000Z", status: "completed", hostId: "D" },
    ];

    // Each full 15-point member contributes; craft counts: A 32, B 24, C 16, D 8 members of 15 pts
    // 32*15=480, 24*15=360, 16*15=240, 8*15=120
    const signals: MemberEventSignals[] = [];
    const plan: { eventId: string; count: number }[] = [
      { eventId: "e-a1", count: 8 },
      { eventId: "e-a2", count: 8 },
      { eventId: "e-a3", count: 8 },
      { eventId: "e-a4", count: 8 },
      { eventId: "e-b1", count: 12 },
      { eventId: "e-b2", count: 12 },
      { eventId: "e-c1", count: 6 },
      { eventId: "e-c2", count: 5 },
      { eventId: "e-c3", count: 5 },
      { eventId: "e-d1", count: 8 },
    ];
    for (const { eventId, count } of plan) {
      for (let i = 0; i < count; i += 1) {
        signals.push(
          baseSignals({
            eventId,
            memberId: `${eventId}-m${i}`,
            rsvp: true,
            attended: true,
            completed: true,
            rating: 5,
            writtenReview: true,
            shared: true,
          }),
        );
      }
    }

    const statement = buildMonthStatement({
      monthId: "2026-11",
      events,
      memberSignals: signals,
      eligibleRevenueCents: 1_000_000,
      status: "finalized",
      updatedAt: "2026-12-08T00:00:00.000Z",
    });

    expect(statement.eligibleEventCount).toBe(10);
    expect(statement.totalEventPoints).toBe(1_200);
    expect(statement.facilitatorPoolCents).toBe(250_000);
    expect(statement.undistributedCents).toBe(0);
    expect(statement.leaderFacilitatorIds).toEqual(["A"]);
    expect(statement.rulesVersion).toBe(EVENT_POINTS_RULES.version);

    const byId = Object.fromEntries(statement.allocations.map((row) => [row.facilitatorId, row]));
    expect(byId.A?.points).toBe(480);
    expect(byId.A?.allocatedCents).toBe(100_000);
    expect(byId.B?.points).toBe(360);
    expect(byId.B?.allocatedCents).toBe(75_000);
    expect(byId.C?.points).toBe(240);
    expect(byId.C?.allocatedCents).toBe(50_000);
    expect(byId.D?.points).toBe(120);
    expect(byId.D?.allocatedCents).toBe(25_000);
  });

  it("leaves the pool undistributed for a zero-point month", () => {
    const statement = buildMonthStatement({
      monthId: "2026-10",
      events: [baseEvent({ id: "empty", endsAt: "2026-10-15T10:00:00.000Z", status: "completed" })],
      memberSignals: [],
      eligibleRevenueCents: 1_000_000,
      status: "provisional",
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(statement.totalEventPoints).toBe(0);
    expect(statement.allocations).toEqual([]);
    expect(statement.undistributedCents).toBe(250_000);
  });
});
