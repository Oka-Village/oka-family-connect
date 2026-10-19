import { describe, expect, it } from "vitest";
import { canEditListing } from "./direct-edit";

describe("direct listing editing", () => {
  it("allows admins to edit another member's listing", () => {
    expect(canEditListing("admin", "member", true)).toBe(true);
  });
  it("preserves the owner's editing access", () => {
    expect(canEditListing("member", "member", false)).toBe(true);
  });
  it("does not allow ordinary members to edit others' listings", () => {
    expect(canEditListing("other", "member", false)).toBe(false);
  });
  it("does not grant editing before sign-in is available", () => {
    expect(canEditListing(null, "member", true)).toBe(false);
  });
});