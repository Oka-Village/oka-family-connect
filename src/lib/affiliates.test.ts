import { describe, expect, it } from "vitest";
import { inviteUrl, PRODUCTION_ORIGIN } from "./affiliate-share";

describe("invite links shared with other people", () => {
  it("always points a code at the production site", () => {
    expect(inviteUrl("95949302")).toBe("https://www.oneworldfamily.app/invite/95949302");
    expect(inviteUrl("TEST1234")).toBe("https://www.oneworldfamily.app/invite/TEST1234");
  });
  it("never carries the preview or a local host", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://www.oneworldfamily.app");
    expect(inviteUrl("ABC")).not.toContain("lovable");
    expect(inviteUrl("ABC")).not.toContain("localhost");
  });
  it("is a clean single path segment with no trailing slash", () => {
    expect(PRODUCTION_ORIGIN.endsWith("/")).toBe(false);
    expect(inviteUrl("ABC")).toBe(`${PRODUCTION_ORIGIN}/invite/ABC`);
  });
});
