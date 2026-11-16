import { describe, expect, it } from "vitest";
import { canShareEventLink, joinPath, joinUrl } from "./join-link";

describe("joinUrl", () => {
  it("always uses the production origin for tagged event links", () => {
    expect(joinUrl("abc123", "DAN50")).toBe("https://www.oneworldfamily.app/join/abc123?ref=DAN50");
  });
  it("uses the production origin without adding a ref for plain event links", () => {
    expect(joinUrl("abc123", null)).toBe("https://www.oneworldfamily.app/join/abc123");
  });
});

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
  it("allows every signed-in member to share a published event without a prior code", () => {
    expect(canShareEventLink(true, "published")).toBe(true);
  });
  it("does not allow signed-out visitors to generate attributed links", () => {
    expect(canShareEventLink(false, "published")).toBe(false);
  });
  it("does not share unpublished events", () => {
    for (const status of ["pending_approval", "rejected", "cancelled"]) {
      expect(canShareEventLink(true, status)).toBe(false);
    }
  });
  it("keeps the event constant while changing the referral to the member sharing", () => {
    expect(joinUrl("micheline-session", "AMIT1234")).toBe("https://www.oneworldfamily.app/join/micheline-session?ref=AMIT1234");
    expect(joinUrl("micheline-session", "MICHELINE")).toBe("https://www.oneworldfamily.app/join/micheline-session?ref=MICHELINE");
  });
});
