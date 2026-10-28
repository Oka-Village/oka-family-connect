// Browser-safe: on the membership page the plan choice comes first, terms acceptance second.
import type { MembershipKind } from "./membership";

export type PlanAction = "checkout" | "ask-terms";

/** A plan click always lands somewhere: straight into checkout, or onto the terms checkbox. */
export function planClickAction(agreed: boolean): PlanAction {
  return agreed ? "checkout" : "ask-terms";
}

/** The plan to start once terms are accepted — only one the visitor actually chose. */
export function chosenPlanToStart(selected: MembershipKind | null, agreed: boolean): MembershipKind | null {
  if (!agreed) return null;
  return selected;
}

export function planName(kind: MembershipKind): string {
  return kind === "founding" ? "the founding membership" : "the monthly membership";
}

export function termsPromptText(kind: MembershipKind): string {
  return `Please accept the membership terms to continue with ${planName(kind)}.`;
}
