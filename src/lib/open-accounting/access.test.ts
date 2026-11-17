import { describe, expect, it } from "vitest";

import { canViewOpenAccountingBooks } from "./access";

describe("canViewOpenAccountingBooks", () => {
  it("allows every member", () => {
    expect(canViewOpenAccountingBooks()).toBe(true);
    expect(canViewOpenAccountingBooks({})).toBe(true);
    expect(canViewOpenAccountingBooks({ isStaff: false, paid: false, trialStartedAt: null })).toBe(true);
  });
});
