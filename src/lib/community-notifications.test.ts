import { describe, expect, it } from "vitest";
import { formatUsd, paymentSlackText, planLabel } from "./community-notifications";

describe("payment alerts", () => {
  it("labels founding payments as Founding membership", () => {
    expect(planLabel("founding_lifetime")).toBe("Founding membership");
  });
  it("formats $250 founding amount with currency", () => {
    expect(formatUsd(25000)).toBe("$250.00 USD");
  });
  it("includes member, amount, reference and referrer in Slack", () => {
    const text = paymentSlackText({ memberName: "Ana", memberEmail: "a@x.com", purpose: "membership_monthly", amountCents: 2900, currency: "usd", reference: "cs_1", referrer: "Liran" });
    expect(text).toContain("$29.00 USD");
    expect(text).toContain("cs_1");
    expect(text).toContain("Referred by: Liran");
  });
});
