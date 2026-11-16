import { describe, expect, it } from "vitest";

import { isPaymentExempt, paymentRedirect } from "./membership";
import { isFullMember } from "./member-access";
import { extendTrialEnd, TRIAL_ACCESS_LAUNCH_AT, trialEndDate, trialState } from "./trial-access";

const PRELAUNCH_START = "2026-10-31T12:08:00.000Z";

describe("launch-aware seven-day trials", () => {
  it("pauses a pre-launch trial through November 30 and ends it on December 8 at midnight UTC", () => {
    expect(TRIAL_ACCESS_LAUNCH_AT).toBe("2026-12-01T00:00:00.000Z");
    expect(trialState(PRELAUNCH_START, new Date("2026-11-15T14:35:00.000Z"))).toBe("active");
    expect(trialState(PRELAUNCH_START, new Date("2026-11-30T23:59:59.999Z"))).toBe("active");
    expect(trialEndDate(PRELAUNCH_START)?.toISOString()).toBe("2026-12-08T00:00:00.000Z");
    expect(trialState(PRELAUNCH_START, new Date("2026-12-07T23:59:59.999Z"))).toBe("active");
    expect(trialState(PRELAUNCH_START, new Date("2026-12-08T00:00:00.000Z"))).toBe("expired");
  });

  it("gives a December 4 onboarding exactly seven days, ending December 11 at the same time", () => {
    const started = "2026-12-04T10:30:00.000Z";
    expect(trialEndDate(started)?.toISOString()).toBe("2026-12-11T10:30:00.000Z");
    expect(trialState(started, new Date("2026-12-11T10:29:59.999Z"))).toBe("active");
    expect(trialState(started, new Date("2026-12-11T10:30:00.000Z"))).toBe("expired");
  });

  it("uses an admin's member-specific end date even when no standard trial started", () => {
    const customEnd = "2026-12-25T18:00:00.000Z";
    expect(trialState(null, new Date("2026-12-20T12:00:00.000Z"), customEnd)).toBe("active");
    expect(trialState(null, new Date("2026-12-25T18:00:00.000Z"), customEnd)).toBe("expired");
  });

  it("lets an admin end a trial immediately by overriding the standard end", () => {
    expect(trialState(PRELAUNCH_START, new Date("2026-11-15T14:35:00.000Z"), "2026-11-15T14:35:00.000Z")).toBe("expired");
  });

  it("adds an admin's 21 days to the current effective pre-launch end", () => {
    expect(extendTrialEnd(PRELAUNCH_START, null, 21, new Date("2026-11-15T00:00:00.000Z"))).toBe("2026-12-29T00:00:00.000Z");
  });

  it("starts an admin's 21-day grant from now when the member has no active trial", () => {
    expect(extendTrialEnd(null, null, 21, new Date("2026-12-04T10:30:00.000Z"))).toBe("2026-12-25T10:30:00.000Z");
  });

  it("opens both app access gates during an active trial and sends an expired trial to membership", () => {
    expect(paymentRedirect("/home", false, false, "active")).toBeNull();
    expect(paymentRedirect("/directory", false, false, "active")).toBeNull();
    expect(isFullMember({ member_status: "limited", trial_started_at: PRELAUNCH_START }, new Date("2026-11-15T14:35:00.000Z"), false)).toBe(true);
    expect(isFullMember({ member_status: "limited", trial_started_at: PRELAUNCH_START }, new Date("2026-12-08T00:00:00.000Z"), false)).toBe(false);
    expect(paymentRedirect("/home", false, false, "expired")).toBe("/membership");
  });

  it("exempts only explicitly complimentary members, not every stored full profile", () => {
    expect(isPaymentExempt({ member_status: "limited", complimentary_access: true })).toBe(true);
    expect(isFullMember({ member_status: "limited", complimentary_access: true }, new Date("2026-11-15T14:35:00.000Z"), false)).toBe(true);
    expect(isPaymentExempt({ member_status: "full", complimentary_access: false })).toBe(false);
    expect(isPaymentExempt({ member_status: "full" })).toBe(false);
  });
});
