import { describe, expect, it } from "vitest";
import { chosenPlanToStart, planClickAction, termsPromptText } from "./membership-flow";

describe("membership plan-first flow", () => {
  it("asks for the terms when a plan is chosen without accepting them", () => {
    expect(planClickAction(false)).toBe("ask-terms");
  });

  it("goes straight to checkout when the terms are already accepted", () => {
    expect(planClickAction(true)).toBe("checkout");
  });

  it("starts the plan the visitor chose the moment the terms are accepted", () => {
    expect(chosenPlanToStart("founding", true)).toBe("founding");
    expect(chosenPlanToStart("monthly", true)).toBe("monthly");
  });

  it("starts nothing without a chosen plan or without acceptance", () => {
    expect(chosenPlanToStart(null, true)).toBeNull();
    expect(chosenPlanToStart("founding", false)).toBeNull();
    expect(chosenPlanToStart("monthly", false)).toBeNull();
  });

  it("names the chosen plan in the terms notice", () => {
    expect(termsPromptText("founding")).toBe(
      "Please accept the membership terms to continue with the founding membership.",
    );
    expect(termsPromptText("monthly")).toBe(
      "Please accept the membership terms to continue with the monthly membership.",
    );
  });
});
