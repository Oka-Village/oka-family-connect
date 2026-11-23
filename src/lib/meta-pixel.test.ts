import { describe, expect, it } from "vitest";
import { eventContentId, membershipContent, normalizeContentId } from "./meta-pixel";

describe("meta-pixel content ids", () => {
  it("normalizes lowercase and hyphens to underscores", () => {
    expect(normalizeContentId("Micheline-Green")).toBe("micheline_green");
    expect(normalizeContentId("  Pod Nov  ")).toBe("pod_nov");
  });

  it("prefixes event ids", () => {
    expect(eventContentId("micheline-pod-nov")).toBe("evt_micheline_pod_nov");
  });

  it("maps membership products", () => {
    expect(membershipContent("monthly")).toEqual({
      content_ids: ["oka_monthly_29"],
      value: 29,
      content_name: "Monthly Membership",
    });
    expect(membershipContent("founding")).toEqual({
      content_ids: ["oka_founding_250"],
      value: 250,
      content_name: "Founding Membership",
    });
  });
});
