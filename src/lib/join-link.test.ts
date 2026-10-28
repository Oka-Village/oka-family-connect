import { describe, expect, it } from "vitest";
import { joinPath } from "./join-link";

describe("joinPath", () => {
  it("adds the sharer's affiliate code as ?ref=", () => {
    expect(joinPath("abc123", "DAN50")).toBe("/join/abc123?ref=DAN50");
  });
  it("keeps the plain link when the sharer has no affiliate code", () => {
    expect(joinPath("abc123", null)).toBe("/join/abc123");
    expect(joinPath("abc123", "  ")).toBe("/join/abc123");
  });
});
