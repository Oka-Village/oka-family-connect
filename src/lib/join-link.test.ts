import { describe, expect, it } from "vitest";
import { canShareEventLink, joinPath } from "./join-link";

describe("joinPath", () => {
  it("adds the sharer's affiliate code as ?ref=", () => {
    expect(joinPath("abc123", "DAN50")).toBe("/join/abc123?ref=DAN50");
  });
  it("keeps the plain link when the sharer has no affiliate code", () => {
    expect(joinPath("abc123", null)).toBe("/join/abc123");
    expect(joinPath("abc123", "  ")).toBe("/join/abc123");
  });
});

describe("canShareEventLink", () => {
  it("shows the share box to any member holding an active affiliate code", () => {
    expect(canShareEventLink(false, false, "DAN50")).toBe(true);
  });
  it("still shows it to the host and to staff without a code", () => {
    expect(canShareEventLink(true, false, null)).toBe(true);
    expect(canShareEventLink(false, true, null)).toBe(true);
  });
  it("hides it from a signed-in member with no affiliate code", () => {
    expect(canShareEventLink(false, false, null)).toBe(false);
    expect(canShareEventLink(false, false, "   ")).toBe(false);
  });
});
