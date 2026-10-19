import { describe, expect, test } from "vitest";
import {
  AGREEMENT_CONFIRMATION_COUNT, defaultConfirmations, ELIGIBILITY_CONFIRMATION_COUNT,
  MINIMUM_FACILITATOR_SESSIONS, PAYMENT_CONFIRMATION_COUNT, requiredConfirmationsComplete,
  validMinimumParticipants,
} from "./facilitator-rules";

describe("facilitator draft requirements", () => {
  test("all five eligibility confirmations start checked", () => {
    expect(defaultConfirmations(ELIGIBILITY_CONFIRMATION_COUNT)).toEqual([true, true, true, true, true]);
  });
  test("all five agreement acknowledgments including the new terms start checked", () => {
    expect(defaultConfirmations(AGREEMENT_CONFIRMATION_COUNT)).toEqual([true, true, true, true, true]);
  });
  test("payment confirmations start checked", () => {
    expect(defaultConfirmations(PAYMENT_CONFIRMATION_COUNT)).toEqual([true, true]);
  });
  test("unchecking any required confirmation blocks progression and persists", () => {
    for (const count of [5, 2]) {
      for (let i = 0; i < count; i++) {
        const checks = defaultConfirmations(count);
        checks[i] = false;
        expect(requiredConfirmationsComplete(checks, count)).toBe(false);
        expect(defaultConfirmations(count, checks)[i]).toBe(false);
      }
      expect(requiredConfirmationsComplete(defaultConfirmations(count), count)).toBe(true);
    }
    expect(requiredConfirmationsComplete([true, true, true, true], 5)).toBe(false);
  });
  test("existing drafts get the new acknowledgment checked without overriding unticked choices", () => {
    expect(defaultConfirmations(5, [false, true, true, true])).toEqual([false, true, true, true, true]);
  });
  test("minimum participants accepts chosen whole counts including one or two", () => {
    for (const value of ["1", "2", "3", "15"]) expect(validMinimumParticipants(value)).toBe(true);
    for (const value of ["", "0", "-1", "1.5", "NaN"]) expect(validMinimumParticipants(value)).toBe(false);
  });
  test("facilitators commit to a minimum of three sessions", () => {
    expect(MINIMUM_FACILITATOR_SESSIONS).toBe(3);
  });
});